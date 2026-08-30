import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { getReviewerSettings } from '../db/settings.js';
import { config } from '../config.js';
import { probeOllama } from '../review/narrative.js';
import type { HealthStatus } from '../types.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      const settings = await getReviewerSettings();
      const reachable = await probeOllama(settings);
      const response: HealthStatus = {
        status: !settings.ollamaBaseUrl || reachable ? 'ok' : 'degraded',
        db: true,
        worker: true,
        ollama: {
          enabled: Boolean(settings.ollamaBaseUrl),
          reachable,
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
