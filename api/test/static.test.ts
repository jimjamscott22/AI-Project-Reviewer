import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { config } from '../src/config.js';
import { buildServer } from '../src/server.js';

function withStaticDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(path.join(tmpdir(), 'apr-static-'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>APR</title><div id="root">shell</div>');
  writeFileSync(path.join(dir, 'app.js'), 'console.log("asset");');
  const original = config.staticDir;
  config.staticDir = dir;
  return run(dir).finally(() => {
    config.staticDir = original;
    rmSync(dir, { recursive: true, force: true });
  });
}

test('serves a real static asset by its exact path', () =>
  withStaticDir(async () => {
    const app = await buildServer({ logger: false });
    try {
      const response = await app.inject({ method: 'GET', url: '/app.js' });
      assert.equal(response.statusCode, 200);
      assert.match(response.body, /asset/);
    } finally {
      await app.close();
    }
  }));

test('falls back to the SPA shell for an unrecognized client-side route', () =>
  withStaticDir(async () => {
    const app = await buildServer({ logger: false });
    try {
      const response = await app.inject({ method: 'GET', url: '/reviews/some-repo' });
      assert.equal(response.statusCode, 200);
      assert.match(response.headers['content-type'] ?? '', /text\/html/);
      assert.match(response.body, /id="root"/);
    } finally {
      await app.close();
    }
  }));

test('an unmatched /api/* route stays a JSON 404 instead of falling back to the SPA shell', () =>
  withStaticDir(async () => {
    const app = await buildServer({ logger: false });
    try {
      const response = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
      assert.equal(response.statusCode, 404);
      assert.deepEqual(response.json(), { error: 'not_found', message: 'Not found.' });
    } finally {
      await app.close();
    }
  }));

test('static serving is off by default, so local dev is unaffected', async () => {
  assert.equal(config.staticDir, '');
  const app = await buildServer({ logger: false });
  try {
    const response = await app.inject({ method: 'GET', url: '/reviews/some-repo' });
    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
  }
});
