import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../src/db/pool.js';
import { createOrGetActiveJob, getJobById } from '../../src/db/jobs.js';
import { createRepo, getRepoBySlug } from '../../src/db/repos.js';
import { canonicalizeGitHubUrl } from '../../src/lib/github.js';
import { startWorker } from '../../src/review/worker.js';
import { buildServer } from '../../src/server.js';
import type { ReviewJob } from '../../src/types.js';

const fixtureUrl = process.env.TASK3_REPOSITORY_URL;

test('worker clones a controlled public repository and persists a complete deterministic review', { skip: !fixtureUrl }, async () => {
  const github = canonicalizeGitHubUrl(fixtureUrl ?? '');
  await pool.query('DELETE FROM repos WHERE slug = ?', [github.slug]);
  const repository = await createRepo({
    slug: github.slug,
    name: 'Controlled Public Worker Fixture',
    url: github.canonicalUrl,
    canonicalUrl: github.canonicalUrl,
  });
  const queued = await createOrGetActiveJob(repository.id);
  assert.ok(queued);

  const app = await buildServer({ logger: false });
  startWorker(app);
  try {
    const deadline = Date.now() + 240_000;
    let job: ReviewJob | null = queued.job;
    while (job && (job.status === 'queued' || job.status === 'running') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      job = await getJobById(job.id);
    }
    assert.equal(job?.status, 'succeeded', job?.error?.message ?? 'Worker did not succeed.');
    assert.equal(job?.stage, 'complete');
    assert.ok(job.reviewId);

    const review = await getRepoBySlug(github.slug);
    assert.ok(review);
    assert.ok(review.score >= 0 && review.score <= 100);
    assert.equal(review.cats.length, 6);
    assert.ok(review.summary.length > 0);
    assert.ok(review.portfolio.checks.length > 0);
    assert.ok(review.quality.metrics.length > 0);
    assert.ok(review.structure.length > 0);
    assert.ok(review.security.length > 0);
    assert.doesNotMatch(JSON.stringify(review), /gh[pousr]_[A-Za-z0-9]{30,}/);
  } finally {
    await app.close();
    await pool.end();
  }
});
