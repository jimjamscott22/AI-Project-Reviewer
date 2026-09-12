import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { getReviewerSettings } from '../db/settings.js';
import { listLMStudioModels } from '../lib/lmStudio.js';
import { config } from '../config.js';
import { probeOllama } from '../review/narrative.js';
import type { HealthStatus } from '../types.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      const settings = await getReviewerSettings();
      const provider = settings.inferenceProvider ?? 'ollama';
      const enabled = provider !== 'disabled' && Boolean(provider === 'lmstudio' ? settings.lmStudioBaseUrl && settings.lmStudioModel : settings.ollamaBaseUrl);
      let reachable = false;
      if (enabled && provider === 'lmstudio') {
        try { reachable = (await listLMStudioModels(settings.lmStudioBaseUrl ?? '', fetch, 1500)).some(model => model.id === settings.lmStudioModel); }
        catch { reachable = false; }
      } else if (enabled) reachable = await probeOllama(settings);
      const response: HealthStatus = {
        status: !enabled || reachable ? 'ok' : 'degraded',
        inference: { provider, enabled, reachable, model: provider === 'lmstudio' ? settings.lmStudioModel ?? '' : provider === 'ollama' ? settings.ollamaModel : '' },
        db: true,
        worker: true,
        ollama: {
          enabled: provider === 'ollama' && enabled,
          reachable: provider === 'ollama' && reachable,
          model: settings.ollamaModel,
        },
      };
      return response;
    } catch {
      reply.code(503);
      const response: HealthStatus = {
        status: 'degraded',
        db: false,
        worker: true,
        ollama: {
          enabled: Boolean(config.ollama.baseUrl),
          reachable: false,
          model: config.ollama.model,
        },
      };
      return response;
    }
  });
}
