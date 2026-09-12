import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/db/pool.js';
import { buildServer } from '../src/server.js';

test('settings persist provider choices, preserve LM Studio on legacy updates, and expose no token', async () => {
  const rows = new Map<string, string>();
  const originalQuery = pool.query;
  const originalConnection = pool.getConnection;
  let committed = 0;
  Object.defineProperty(pool, 'query', { configurable: true, value: async () => [[...rows].map(([setting_key, value]) => ({ setting_key, value })), []] });
  Object.defineProperty(pool, 'getConnection', { configurable: true, value: async () => ({
    beginTransaction: async () => {},
    query: async (_sql: string, values: string[]) => { for (let i = 0; i < values.length; i += 2) rows.set(values[i]!, values[i + 1]!); },
    commit: async () => { committed++; }, rollback: async () => {}, release: () => {},
  }) });
  const app = await buildServer({ logger: false });
  try {
    const value = { inferenceProvider: 'lmstudio', ollamaBaseUrl: 'http://localhost:11434', ollamaModel: 'llama3.1', lmStudioBaseUrl: 'http://localhost:1234', lmStudioModel: 'chosen' };
    const saved = await app.inject({ method: 'PUT', url: '/api/settings', payload: value });
    assert.equal(saved.statusCode, 200);
    assert.deepEqual(saved.json(), value);
    const legacy = await app.inject({ method: 'PUT', url: '/api/settings', payload: { ollamaBaseUrl: '', ollamaModel: 'other' } });
    assert.equal(legacy.json().inferenceProvider, 'lmstudio');
    assert.equal(legacy.json().lmStudioModel, 'chosen');
    assert.equal(committed, 2);
    const readback = await app.inject({ method: 'GET', url: '/api/settings' });
    assert.deepEqual(readback.json(), legacy.json());
    assert.deepEqual(Object.keys(readback.json()).sort(), Object.keys(value).sort());
    const invalid = await app.inject({ method: 'POST', url: '/api/settings/models', payload: { lmStudioBaseUrl: 'https://example.com' } });
    assert.equal(invalid.statusCode, 400);
  } finally {
    await app.close();
    Object.defineProperty(pool, 'query', { configurable: true, writable: true, value: originalQuery });
    Object.defineProperty(pool, 'getConnection', { configurable: true, writable: true, value: originalConnection });
  }
});
