import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { listLMStudioModels, ModelDiscoveryError } from '../src/lib/lmStudio.js';
import { normalizeReviewerSettings } from '../src/lib/ollamaSettings.js';

const settings = { ollamaBaseUrl: 'http://localhost:11434', ollamaModel: 'llama3.1' };
test('legacy requests do not supply or overwrite new provider settings', () => {
  assert.deepEqual(normalizeReviewerSettings(settings), settings);
  const full = { ...settings, inferenceProvider: 'lmstudio', lmStudioBaseUrl: 'http://localhost:1234/', lmStudioModel: 'vendor/model@q4' };
  assert.equal(normalizeReviewerSettings(full).lmStudioBaseUrl, 'http://localhost:1234');
  assert.throws(() => normalizeReviewerSettings({ ...full, lmStudioModel: '' }));
  assert.throws(() => normalizeReviewerSettings({ ...full, lmStudioBaseUrl: 'https://example.com' }));
  assert.throws(() => normalizeReviewerSettings({ ...full, lmStudioBaseUrl: 'http://user:pass@localhost:1234' }));
});
test('discovery normalizes text models, excludes embeddings, and uses bounded nonredirecting requests', async () => {
  const models = await listLMStudioModels('http://localhost:1234', async (url, init) => {
    assert.equal(url, 'http://localhost:1234/api/v1/models');
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    return Response.json({ models: [
      { type: 'embedding' },
      { type: 'llm', key: 'z', display_name: 'Zeta', loaded_instances: [] },
      { type: 'llm', key: 'a', display_name: 'Alpha', loaded_instances: [{ id: 'a' }] },
    ] });
  });
  assert.deepEqual(models, [{ id: 'a', name: 'Alpha', loaded: true }, { id: 'z', name: 'Zeta', loaded: false }]);
});
test('discovery differentiates authentication, malformed data, size, and connection failures', async () => {
  const cases: [() => Promise<Response>, string][] = [
    [async () => new Response('', { status: 401 }), 'model_authentication_failed'],
    [async () => new Response('not json'), 'invalid_model_response'],
    [async () => Response.json({ models: [{}] }), 'invalid_model_response'],
    [async () => new Response('x'.repeat(1_048_577)), 'invalid_model_response'],
    [async () => { throw new Error('private details'); }, 'model_server_unreachable'],
  ];
  for (const [fetchImpl, code] of cases) await assert.rejects(listLMStudioModels('http://localhost:1234', fetchImpl), error => error instanceof ModelDiscoveryError && error.code === code && !error.message.includes('private details'));
});
test('mock HTTP server discovery rejects redirects and times out', async () => {
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/redirect')) response.writeHead(302, { location: 'http://example.com' }).end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const base = `http://127.0.0.1:${address.port}`;
    await assert.rejects(listLMStudioModels(base + '/redirect'), error => error instanceof ModelDiscoveryError && error.code === 'model_server_unreachable');
    await assert.rejects(listLMStudioModels(base, fetch, 30), error => error instanceof ModelDiscoveryError && error.code === 'model_server_timeout');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
