import { afterEach, describe, expect, it, vi } from 'vitest';
import { ping, rerun } from './api';
import { APR_SAMPLE } from './sampleData';

describe('Fastify service boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads Ollama capability through Fastify health', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ok',
      db: true,
      worker: true,
      ollama: { enabled: true, reachable: true, model: 'llama3.1' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const health = await ping();

    expect(health?.ollama.reachable).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/health');
  });

  it('queues reruns through Fastify and never contacts the Ollama port', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobId: 'job-1', status: 'queued' }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await rerun(APR_SAMPLE[0]!);

    expect(result.queued).toBe(true);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/repos/threatstream/rerun');
    expect(url).not.toContain('11434');
  });
});
