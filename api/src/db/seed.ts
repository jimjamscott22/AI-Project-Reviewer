import mysql from 'mysql2/promise';
import { config } from '../config.js';
import { SEED_REPOS } from './seedData.js';
import { grade } from '../lib/grade.js';

async function main() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  const slugs = SEED_REPOS.map((r) => r.id);
  await conn.query('DELETE FROM repos WHERE slug IN (?)', [slugs]); // cascades to reviews + all child tables

  for (const repo of SEED_REPOS) {
    const generatedAt = new Date(Date.now() - repo.ageMs);
    const connectedAt = new Date(generatedAt.getTime() - 24 * 60 * 60 * 1000);

    const [repoResult] = await conn.query<mysql.ResultSetHeader>(
      'INSERT INTO repos (slug, name, url, visibility, language, framework, hue, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [repo.id, repo.name, repo.url, repo.vis, repo.lang, repo.framework, repo.hue, connectedAt],
    );
    const repoId = repoResult.insertId;

    const [reviewResult] = await conn.query<mysql.ResultSetHeader>(
      'INSERT INTO reviews (repo_id, overall_score, grade, ai_summary, generated_at) VALUES (?, ?, ?, ?, ?)',
      [repoId, repo.score, grade(repo.score), repo.ai, generatedAt],
    );
    const reviewId = reviewResult.insertId;

    await Promise.all([
      ...repo.summary.map(([icon, label, value, tone], position) =>
        conn.query('INSERT INTO review_summary_items (review_id, position, icon, label, value, tone) VALUES (?, ?, ?, ?, ?, ?)', [
          reviewId, position, icon, label, value, tone,
        ]),
      ),
      ...repo.cats.map(([category, icon, score], position) =>
        conn.query('INSERT INTO review_categories (review_id, position, category, icon, score) VALUES (?, ?, ?, ?, ?)', [
          reviewId, position, category, icon, score,
        ]),
      ),
      ...repo.strengths.map((body, position) =>
        conn.query('INSERT INTO review_items (review_id, kind, position, body) VALUES (?, ?, ?, ?)', [reviewId, 'strength', position, body]),
      ),
      ...repo.improves.map((body, position) =>
        conn.query('INSERT INTO review_items (review_id, kind, position, body) VALUES (?, ?, ?, ?)', [reviewId, 'improvement', position, body]),
      ),
      ...repo.steps.map((body, position) =>
        conn.query('INSERT INTO review_items (review_id, kind, position, body) VALUES (?, ?, ?, ?)', [reviewId, 'next_step', position, body]),
      ),
      conn.query('INSERT INTO portfolio_readiness (review_id, verdict, blurb, footer) VALUES (?, ?, ?, ?)', [
        reviewId, repo.portfolio.verdict, repo.portfolio.blurb, repo.portfolio.footer,
      ]),
      ...repo.portfolio.checks.map(([label, done], position) =>
        conn.query('INSERT INTO portfolio_checks (review_id, position, label, done) VALUES (?, ?, ?, ?)', [reviewId, position, label, done]),
      ),
      ...repo.quality.metrics.map(([label, value], position) =>
        conn.query('INSERT INTO quality_metrics (review_id, position, label, value) VALUES (?, ?, ?, ?)', [reviewId, position, label, value]),
      ),
      ...repo.quality.findings.map(([severity, text], position) =>
        conn.query('INSERT INTO findings (review_id, tab, position, severity, title, detail) VALUES (?, ?, ?, ?, ?, NULL)', [
          reviewId, 'quality', position, severity, text,
        ]),
      ),
      ...repo.security.map(([severity, title, detail], position) =>
        conn.query('INSERT INTO findings (review_id, tab, position, severity, title, detail) VALUES (?, ?, ?, ?, ?, ?)', [
          reviewId, 'security', position, severity, title, detail,
        ]),
      ),
      ...repo.deps.map(([pkg, installed, latest, status], position) =>
        conn.query('INSERT INTO dependencies (review_id, position, package, installed, latest, status) VALUES (?, ?, ?, ?, ?, ?)', [
          reviewId, position, pkg, installed, latest, status,
        ]),
      ),
      conn.query('INSERT INTO repo_stats (review_id, loc, open_issues, prs, contributors, commits_14d, structure) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        reviewId,
        Number(repo.loc.replace(/,/g, '')),
        repo.issues,
        repo.prs,
        repo.contributors,
        0,
        repo.structure.join('\n'),
      ]),
    ]);

    console.log(`Seeded ${repo.name} (repo_id=${repoId}, review_id=${reviewId})`);
  }

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
