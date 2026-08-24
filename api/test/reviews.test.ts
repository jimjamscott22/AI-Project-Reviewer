import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../src/db/pool.js';
import { persistReview } from '../src/db/reviews.js';
import type { ReviewResult } from '../src/types.js';

const REVIEW: ReviewResult = {
  overallScore: 72,
  aiSummary: 'A deterministic summary.',
  summary: [['code', 'Type', 'TypeScript', 'good']],
  categories: [['Documentation', 'book-open', 72]],
  strengths: ['Clear structure.'],
  improvements: ['Add tests.'],
  nextSteps: ['Create a test suite.'],
  portfolio: { verdict: 'Good', blurb: 'Solid foundation.', checks: [['README', 1]], footer: 'Keep improving.' },
  quality: { metrics: [['Lint issues', '0']], findings: [['ok', 'No lint issues found.']] },
  structure: ['src/', '  index.ts'],
  dependencies: [['fastify', '5.0.0', '5.0.0', 'ok']],
  security: [['ok', 'No committed secrets', 'No high-confidence secret patterns were found.']],
  stats: { loc: 120, openIssues: 0, pullRequests: 0, contributors: 1, commits14d: 3 },
};

function installFakeConnection(failOn?: string) {
  const originalGetConnection = pool.getConnection;
  const state = { committed: false, rolledBack: false, released: false, queries: [] as string[] };
  const connection = {
    beginTransaction: async () => undefined,
    query: async (sql: string) => {
      state.queries.push(sql);
      if (failOn && sql.includes(failOn)) throw new Error('simulated insert failure');
      return [sql.startsWith('INSERT INTO reviews') ? { insertId: 41 } : {}, []];
    },
    commit: async () => {
      state.committed = true;
    },
    rollback: async () => {
      state.rolledBack = true;
    },
    release: () => {
      state.released = true;
    },
  } as unknown as PoolConnection;
  Object.defineProperty(pool, 'getConnection', { configurable: true, writable: true, value: async () => connection });
  return {
    state,
    restore: () => Object.defineProperty(pool, 'getConnection', { configurable: true, writable: true, value: originalGetConnection }),
  };
}

test('persists a complete review in one committed transaction', async () => {
  const fake = installFakeConnection();
  try {
    const reviewId = await persistReview(7, REVIEW, new Date('2026-08-23T12:00:00Z'));
    assert.equal(reviewId, 41);
    assert.equal(fake.state.committed, true);
    assert.equal(fake.state.rolledBack, false);
    assert.equal(fake.state.released, true);
    assert.ok(fake.state.queries.some((sql) => sql.includes('INSERT INTO repo_stats')));
  } finally {
    fake.restore();
  }
});

test('rolls back the entire review when a child insert fails', async () => {
  const fake = installFakeConnection('INSERT INTO portfolio_readiness');
  try {
    await assert.rejects(() => persistReview(7, REVIEW), /simulated insert failure/);
    assert.equal(fake.state.committed, false);
    assert.equal(fake.state.rolledBack, true);
    assert.equal(fake.state.released, true);
  } finally {
    fake.restore();
  }
});

test('rejects invalid scores before opening a transaction', async () => {
  await assert.rejects(() => persistReview(7, { ...REVIEW, overallScore: 101 }), /0 to 100/);
});
