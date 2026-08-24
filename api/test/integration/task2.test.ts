import assert from 'node:assert/strict';
import test from 'node:test';
import type { RowDataPacket } from 'mysql2/promise';
import { claimNextJob, completeJob, getJobById, recoverRunningJobs } from '../../src/db/jobs.js';
import { pool } from '../../src/db/pool.js';
import { persistReview } from '../../src/db/reviews.js';
import { buildServer } from '../../src/server.js';
import type { DependencyStatus, Repo, RepositorySummary, ReviewResult } from '../../src/types.js';

const REVIEW: ReviewResult = {
  overallScore: 76,
  aiSummary: 'The integration fixture has a clear structure and a complete persisted review.',
  summary: [
    ['code', 'Type', 'TypeScript project', 'good'],
    ['readme', 'README', 'Present', 'good'],
  ],
  categories: [
    ['Documentation', 'book-open', 80],
    ['Testing', 'flask', 70],
    ['Docker', 'cube', 65],
    ['CI/CD', 'git-branch', 75],
    ['Security', 'shield-check', 85],
    ['Maintainability', 'wrench', 80],
  ],
  strengths: ['The repository can be reviewed deterministically.'],
  improvements: ['Add broader integration coverage.'],
  nextSteps: ['Run the persisted job worker.'],
  portfolio: {
    verdict: 'Good',
    blurb: 'A useful integration fixture.',
    checks: [
      ['Clear project purpose', 1],
      ['Automated tests', 1],
    ],
    footer: 'Ready for the next milestone.',
  },
  quality: { metrics: [['Lint issues', '0']], findings: [['ok', 'No lint issues detected.']] },
  structure: ['src/', '  index.ts'],
  dependencies: [['fastify', '5.12.0', '5.12.0', 'ok']],
  security: [['ok', 'No exposed secrets', 'No high-confidence secrets were found.']],
  stats: { loc: 140, openIssues: 0, pullRequests: 0, contributors: 1, commits14d: 4 },
};

test('Task 2 persists repositories, deduplicated jobs, recovery, complete reviews, and rollback', async () => {
  await pool.query("DELETE FROM repos WHERE slug IN ('codex-fixture-task2', 'codex-fixture-rollback')");
  let app = await buildServer({ logger: false });
  try {
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(health.statusCode, 200);

    const seededReviews = await app.inject({ method: 'GET', url: '/api/repos' });
    assert.equal(seededReviews.statusCode, 200);
    assert.equal((seededReviews.json() as Repo[]).length, 5);

    const connect = await app.inject({
      method: 'POST',
      url: '/api/repos',
      payload: { url: 'https://github.com/Codex-Fixture/Task2.git' },
    });
    assert.equal(connect.statusCode, 201);
    const connected = connect.json() as RepositorySummary;
    assert.equal(connected.id, 'codex-fixture-task2');
    assert.equal(connected.url, 'https://github.com/codex-fixture/task2');
    assert.equal(connected.latestReviewId, null);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/repos',
      payload: { url: 'https://github.com/codex-fixture/task2' },
    });
    assert.equal(duplicate.statusCode, 409);

    const managementBefore = (await app.inject({ method: 'GET', url: '/api/repositories' })).json() as RepositorySummary[];
    assert.equal(managementBefore.length, 6);
    assert.equal(managementBefore.find((repo) => repo.id === connected.id)?.latestReviewId, null);
    assert.equal(((await app.inject({ method: 'GET', url: '/api/repos' })).json() as Repo[]).length, 5);

    const enqueue = await app.inject({ method: 'POST', url: `/api/repos/${connected.id}/rerun` });
    assert.equal(enqueue.statusCode, 202);
    const queued = enqueue.json() as { jobId: string; status: string };
    assert.equal(queued.status, 'queued');

    const duplicateEnqueue = await app.inject({ method: 'POST', url: `/api/repos/${connected.id}/rerun` });
    assert.equal(duplicateEnqueue.statusCode, 202);
    assert.equal((duplicateEnqueue.json() as { jobId: string }).jobId, queued.jobId);

    const claimed = await claimNextJob();
    assert.equal(claimed?.id, queued.jobId);
    assert.equal(claimed?.status, 'running');
    assert.equal(await recoverRunningJobs(), 1);
    assert.equal((await getJobById(queued.jobId))?.status, 'queued');

    const reclaimed = await claimNextJob();
    assert.equal(reclaimed?.id, queued.jobId);
    const reviewId = await persistReview(reclaimed!.repositoryDatabaseId, REVIEW, new Date('2026-08-23T12:00:00Z'));
    await completeJob(queued.jobId, reviewId);

    await app.close();
    app = await buildServer({ logger: false });

    const completedJob = await app.inject({ method: 'GET', url: `/api/jobs/${queued.jobId}` });
    assert.equal(completedJob.statusCode, 200);
    assert.equal(completedJob.json().status, 'succeeded');
    assert.equal(completedJob.json().reviewId, reviewId);

    const persistedReview = await app.inject({ method: 'GET', url: `/api/repos/${connected.id}` });
    assert.equal(persistedReview.statusCode, 200);
    assert.equal((persistedReview.json() as Repo).score, REVIEW.overallScore);
    assert.equal(((await app.inject({ method: 'GET', url: '/api/repos' })).json() as Repo[]).length, 6);

    const rollbackConnect = await app.inject({
      method: 'POST',
      url: '/api/repos',
      payload: { url: 'https://github.com/Codex-Fixture/Rollback' },
    });
    assert.equal(rollbackConnect.statusCode, 201);
    const rollbackRepo = rollbackConnect.json() as RepositorySummary;
    const [repoRows] = await pool.query<(RowDataPacket & { id: number })[]>('SELECT id FROM repos WHERE slug = ?', [rollbackRepo.id]);
    const rollbackRepoId = repoRows[0]?.id;
    assert.ok(rollbackRepoId);

    const invalidReview: ReviewResult = {
      ...REVIEW,
      dependencies: [['fastify', '5.12.0', '5.12.0', 'broken' as DependencyStatus]],
    };
    await assert.rejects(() => persistReview(rollbackRepoId, invalidReview));
    const [reviewRows] = await pool.query<(RowDataPacket & { count: number })[]>('SELECT COUNT(*) AS count FROM reviews WHERE repo_id = ?', [
      rollbackRepoId,
    ]);
    assert.equal(Number(reviewRows[0]?.count), 0);
  } finally {
    await app.close();
    await pool.end();
  }
});
