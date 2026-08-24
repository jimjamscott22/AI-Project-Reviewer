import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/db/pool.js';
import { buildServer } from '../src/server.js';

test('database connection failures return a stable 503 envelope', async () => {
  const app = await buildServer({ logger: false });
  app.get('/test/database-error', async () => {
    const connectionError = Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' });
    throw new AggregateError([connectionError], 'database unavailable');
  });

  const response = await app.inject({ method: 'GET', url: '/test/database-error' });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    error: 'database_unavailable',
    message: 'The review database is unavailable. Try again after MariaDB is running.',
  });
  await app.close();
});

test('unexpected failures return a generic 500 envelope', async () => {
  const app = await buildServer({ logger: false });
  app.get('/test/internal-error', async () => {
    throw new Error('private implementation detail');
  });

  const response = await app.inject({ method: 'GET', url: '/test/internal-error' });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), {
    error: 'internal_error',
    message: 'An unexpected server error occurred.',
  });
  assert.doesNotMatch(response.body, /private implementation detail/);
  await app.close();
});

test('repository registration rejects a missing URL before touching the database', async () => {
  const app = await buildServer({ logger: false });

  const response = await app.inject({ method: 'POST', url: '/api/repos', payload: {} });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: 'invalid_body', message: '"url" is required' });
  await app.close();
});

test('repository registration rejects unsupported URLs before touching the database', async () => {
  const app = await buildServer({ logger: false });

  const response = await app.inject({
    method: 'POST',
    url: '/api/repos',
    payload: { url: 'http://github.com/example/project' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'invalid_repository_url');
  await app.close();
});

test('repository registration rejects private repository metadata', async () => {
  const app = await buildServer({ logger: false });

  const response = await app.inject({
    method: 'POST',
    url: '/api/repos',
    payload: { url: 'https://github.com/example/project', visibility: 'Private' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'unsupported_repository');
  await app.close();
});

test('the real repository route uses the database-unavailable envelope', async () => {
  const originalQuery = pool.query;
  Object.defineProperty(pool, 'query', {
    configurable: true,
    writable: true,
    value: async () => {
      throw Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' });
    },
  });
  const app = await buildServer({ logger: false });

  try {
    const response = await app.inject({ method: 'GET', url: '/api/repos' });

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error, 'database_unavailable');
  } finally {
    Object.defineProperty(pool, 'query', { configurable: true, writable: true, value: originalQuery });
    await app.close();
  }
});
