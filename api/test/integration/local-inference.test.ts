import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createServer } from 'node:http';
import path from 'node:path';
import Fastify from 'fastify';
import type { ReviewerSettings, ReviewResult } from '../../src/types.js';

test('worker snapshots the model before preparation and picks up saved changes for its next job', async () => {
  process.env.REGISTRY_MAX_PACKAGES = '0';
  const requests: string[] = [];
  const server = createServer((request, response) => {
    assert.equal(request.url, '/v1/chat/completions');
    let body = '';
    request.on('data', chunk => { body += String(chunk); });
    request.on('end', () => {
      const model = JSON.parse(body).model;
      requests.push(model);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ aiSummary: `Narrated by ${model}.`, strengths: ['Clear structure.'], improvements: ['More tests.'], nextSteps: ['Add tests.'], portfolioBlurb: 'A useful project.', portfolioFooter: 'Keep improving.' }) } }] }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  let saved: ReviewerSettings = { inferenceProvider: 'lmstudio', lmStudioBaseUrl: `http://127.0.0.1:${address.port}`, lmStudioModel: 'first', ollamaBaseUrl: '', ollamaModel: 'unused' };
  let prepared!: () => void;
  const preparationStarted = new Promise<void>(resolve => { prepared = resolve; });
  let release!: () => void;
  const preparationGate = new Promise<void>(resolve => { release = resolve; });
  let finished!: () => void;
  const completed = new Promise<void>(resolve => { finished = resolve; });
  let claimed = 0;
  let preparations = 0;
  const reviews: ReviewResult[] = [];
  const mocks = [
    mock.module('../../src/db/settings.js', { namedExports: { getReviewerSettings: async () => ({ ...saved }) } }),
    mock.module('../../src/db/jobs.js', { namedExports: {
      claimNextJob: async () => ++claimed <= 2 ? { id: String(claimed), repositoryUrl: 'https://github.com/example/fixture', repositoryName: 'Fixture', repositoryDatabaseId: 1 } : null,
      updateJobStage: async () => {}, completeJob: async (id: string) => { if (id === '2') finished(); },
      failJob: async (_id: string, error: unknown) => { assert.fail(JSON.stringify(error)); },
    } }),
    mock.module('../../src/db/repos.js', { namedExports: { updateRepositoryMetadata: async () => {} } }),
    mock.module('../../src/db/reviews.js', { namedExports: { persistReview: async (_id: number, review: ReviewResult) => { reviews.push(review); return reviews.length; } } }),
  ];
  const workspace = await import('../../src/review/workspace.js');
  mocks.push(mock.module('../../src/review/workspace.js', { namedExports: { ...workspace, prepareRepository: async () => {
    if (++preparations === 1) { prepared(); await preparationGate; }
    return { root: path.resolve('test/fixtures/python-project'), cleanup: async () => {} };
  } } }));
  const app = Fastify({ logger: false });
  try {
    const { startWorker } = await import('../../src/review/worker.js');
    const worker = startWorker(app);
    await preparationStarted;
    saved = { ...saved, lmStudioModel: 'second' };
    release();
    await Promise.race([completed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Worker timed out')), 10_000); timer.unref(); })]);
    await worker.stop();
    assert.deepEqual(requests, ['first', 'second']);
    assert.deepEqual(reviews.map(review => review.aiSummary), ['Narrated by first.', 'Narrated by second.']);
  } finally {
    release(); await app.close(); server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const entry of mocks) entry.restore();
  }
});
