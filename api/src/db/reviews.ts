import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { pool } from './pool.js';
import { grade } from '../lib/grade.js';
import type { ReviewResult } from '../types.js';

async function insertRows(connection: PoolConnection, sql: string, rows: unknown[][]): Promise<void> {
  for (const values of rows) await connection.query(sql, values);
}

function validateScore(score: number): void {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new RangeError(`Review score must be an integer from 0 to 100; received ${score}.`);
  }
}

export async function persistReview(repoId: number, review: ReviewResult, generatedAt: Date = new Date()): Promise<number> {
  validateScore(review.overallScore);
  review.categories.forEach(([, , score]) => validateScore(score));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [reviewResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO reviews (repo_id, overall_score, grade, ai_summary, generated_at) VALUES (?, ?, ?, ?, ?)',
      [repoId, review.overallScore, grade(review.overallScore), review.aiSummary, generatedAt],
    );
    const reviewId = reviewResult.insertId;

    await insertRows(
      connection,
      'INSERT INTO review_summary_items (review_id, position, icon, label, value, tone) VALUES (?, ?, ?, ?, ?, ?)',
      review.summary.map(([icon, label, value, tone], position) => [reviewId, position, icon, label, value, tone]),
    );
    await insertRows(
      connection,
      'INSERT INTO review_categories (review_id, position, category, icon, score) VALUES (?, ?, ?, ?, ?)',
      review.categories.map(([category, icon, score], position) => [reviewId, position, category, icon, score]),
    );
    await insertRows(
      connection,
      'INSERT INTO review_items (review_id, kind, position, body) VALUES (?, ?, ?, ?)',
      [
        ...review.strengths.map((body, position) => [reviewId, 'strength', position, body]),
        ...review.improvements.map((body, position) => [reviewId, 'improvement', position, body]),
        ...review.nextSteps.map((body, position) => [reviewId, 'next_step', position, body]),
      ],
    );
    await connection.query('INSERT INTO portfolio_readiness (review_id, verdict, blurb, footer) VALUES (?, ?, ?, ?)', [
      reviewId,
      review.portfolio.verdict,
      review.portfolio.blurb,
      review.portfolio.footer,
    ]);
    await insertRows(
      connection,
      'INSERT INTO portfolio_checks (review_id, position, label, done) VALUES (?, ?, ?, ?)',
      review.portfolio.checks.map(([label, done], position) => [reviewId, position, label, done]),
    );
    await insertRows(
      connection,
      'INSERT INTO quality_metrics (review_id, position, label, value) VALUES (?, ?, ?, ?)',
      review.quality.metrics.map(([label, value], position) => [reviewId, position, label, String(value)]),
    );
    await insertRows(
      connection,
      'INSERT INTO findings (review_id, tab, position, severity, title, detail) VALUES (?, ?, ?, ?, ?, ?)',
      [
        ...review.quality.findings.map(([severity, title], position) => [reviewId, 'quality', position, severity, title, null]),
        ...review.security.map(([severity, title, detail], position) => [reviewId, 'security', position, severity, title, detail]),
      ],
    );
    await insertRows(
      connection,
      'INSERT INTO dependencies (review_id, position, package, installed, latest, status) VALUES (?, ?, ?, ?, ?, ?)',
      review.dependencies.map(([name, installed, latest, status], position) => [reviewId, position, name, installed, latest, status]),
    );
    await connection.query(
      `INSERT INTO repo_stats
       (review_id, loc, open_issues, prs, contributors, commits_14d, structure)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        reviewId,
        review.stats.loc,
        review.stats.openIssues,
        review.stats.pullRequests,
        review.stats.contributors,
        review.stats.commits14d,
        review.structure.join('\n'),
      ],
    );

    await connection.commit();
    return reviewId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
