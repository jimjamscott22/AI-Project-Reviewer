import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from './pool.js';
import type { ReviewJob, ReviewJobStage, ReviewJobStatus } from '../types.js';

interface ReviewJobRow extends RowDataPacket {
  id: string;
  repo_id: number;
  repo_slug: string;
  status: ReviewJobStatus;
  stage: ReviewJobStage;
  review_id: number | null;
  error_code: string | null;
  error_message: string | null;
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

interface RepositoryLockRow extends RowDataPacket {
  id: number;
  slug: string;
}

export interface ClaimedReviewJob extends ReviewJob {
  repositoryDatabaseId: number;
  repositoryUrl: string;
  repositoryName: string;
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function mapJob(row: ReviewJobRow): ReviewJob {
  return {
    id: row.id,
    repoId: row.repo_slug,
    status: row.status,
    stage: row.stage,
    createdAt: row.requested_at.toISOString(),
    startedAt: toIso(row.started_at),
    completedAt: toIso(row.completed_at),
    reviewId: row.review_id,
    error:
      row.error_code || row.error_message
        ? { code: row.error_code ?? 'review_failed', message: row.error_message ?? 'The review failed.' }
        : null,
  };
}

async function selectJob(connection: PoolConnection, id: string): Promise<ReviewJobRow | null> {
  const [rows] = await connection.query<ReviewJobRow[]>(
    `SELECT j.id, j.repo_id, r.slug AS repo_slug, j.status, j.stage, j.review_id,
            j.error_code, j.error_message, j.requested_at, j.started_at, j.completed_at
     FROM review_jobs j
     JOIN repos r ON r.id = j.repo_id
     WHERE j.id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getJobById(id: string): Promise<ReviewJob | null> {
  const connection = await pool.getConnection();
  try {
    const row = await selectJob(connection, id);
    return row ? mapJob(row) : null;
  } finally {
    connection.release();
  }
}

export async function createOrGetActiveJob(repoSlug: string): Promise<{ job: ReviewJob; created: boolean } | null> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [repoRows] = await connection.query<RepositoryLockRow[]>('SELECT id, slug FROM repos WHERE slug = ? FOR UPDATE', [repoSlug]);
    const repository = repoRows[0];
    if (!repository) {
      await connection.rollback();
      return null;
    }

    const [activeRows] = await connection.query<ReviewJobRow[]>(
      `SELECT j.id, j.repo_id, r.slug AS repo_slug, j.status, j.stage, j.review_id,
              j.error_code, j.error_message, j.requested_at, j.started_at, j.completed_at
       FROM review_jobs j
       JOIN repos r ON r.id = j.repo_id
       WHERE j.repo_id = ? AND j.active = 1
       LIMIT 1`,
      [repository.id],
    );
    if (activeRows[0]) {
      await connection.commit();
      return { job: mapJob(activeRows[0]), created: false };
    }

    const jobId = randomUUID();
    await connection.query('INSERT INTO review_jobs (id, repo_id, status, stage, active) VALUES (?, ?, ?, ?, 1)', [
      jobId,
      repository.id,
      'queued',
      'queued',
    ]);
    const created = await selectJob(connection, jobId);
    if (!created) throw new Error(`Review job "${jobId}" was inserted but could not be read back.`);
    await connection.commit();
    return { job: mapJob(created), created: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function claimNextJob(): Promise<ClaimedReviewJob | null> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<
      (ReviewJobRow & { repository_url: string; repository_name: string })[]
    >(
      `SELECT j.id, j.repo_id, r.slug AS repo_slug, j.status, j.stage, j.review_id,
              j.error_code, j.error_message, j.requested_at, j.started_at, j.completed_at,
              COALESCE(r.canonical_url, r.url) AS repository_url, r.name AS repository_name
       FROM review_jobs j
       JOIN repos r ON r.id = j.repo_id
       WHERE j.status = 'queued'
       ORDER BY j.requested_at, j.id
       LIMIT 1
       FOR UPDATE`,
    );
    const row = rows[0];
    if (!row) {
      await connection.commit();
      return null;
    }

    await connection.query(
      `UPDATE review_jobs
       SET status = 'running', stage = 'cloning', started_at = CURRENT_TIMESTAMP,
           completed_at = NULL, attempt_count = attempt_count + 1, error_code = NULL, error_message = NULL
       WHERE id = ?`,
      [row.id],
    );
    await connection.commit();
    return {
      ...mapJob({ ...row, status: 'running', stage: 'cloning', started_at: new Date(), completed_at: null }),
      repositoryDatabaseId: row.repo_id,
      repositoryUrl: row.repository_url,
      repositoryName: row.repository_name,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateJobStage(id: string, stage: Exclude<ReviewJobStage, 'queued' | 'complete'>): Promise<void> {
  await pool.query("UPDATE review_jobs SET stage = ? WHERE id = ? AND status = 'running'", [stage, id]);
}

export async function completeJob(id: string, reviewId: number): Promise<void> {
  await pool.query(
    `UPDATE review_jobs
     SET status = 'succeeded', stage = 'complete', active = NULL, review_id = ?, completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'running'`,
    [reviewId, id],
  );
}

export async function failJob(id: string, error: { code: string; message: string }): Promise<void> {
  await pool.query(
    `UPDATE review_jobs
     SET status = 'failed', active = NULL, error_code = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status IN ('queued','running')`,
    [error.code.slice(0, 64), error.message.slice(0, 512), id],
  );
}

export async function recoverRunningJobs(): Promise<number> {
  const [result] = await pool.query<import('mysql2').ResultSetHeader>(
    `UPDATE review_jobs
     SET status = 'queued', stage = 'queued', started_at = NULL, completed_at = NULL,
         error_code = NULL, error_message = NULL
     WHERE status = 'running'`,
  );
  return result.affectedRows;
}
