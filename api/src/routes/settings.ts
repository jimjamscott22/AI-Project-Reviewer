import type { FastifyInstance } from 'fastify';
import { getReviewerSettings, saveReviewerSettings } from '../db/settings.js';
import { listLMStudioModels, ModelDiscoveryError } from '../lib/lmStudio.js';
import { normalizeReviewerSettings } from '../lib/ollamaSettings.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.post<{ Body: { lmStudioBaseUrl?: unknown } }>('/api/settings/models', async (request, reply) => {
    try {
      if (typeof request.body?.lmStudioBaseUrl !== 'string') throw new Error('"lmStudioBaseUrl" must be a string.');
      return { models: await listLMStudioModels(request.body.lmStudioBaseUrl) };
    } catch (error) {
      if (error instanceof ModelDiscoveryError) return reply.code(error.status).send({ error: error.code, message: error.message });
      if (error instanceof Error && error.message.startsWith('"')) return reply.code(400).send({ error: 'invalid_settings', message: error.message });
      throw error;
    }
  });
  app.get('/api/settings', async () => getReviewerSettings());

  app.put<{ Body: unknown }>('/api/settings', async (request, reply) => {
    try {
      await saveReviewerSettings(normalizeReviewerSettings(request.body));
      return getReviewerSettings();
    } catch (error) {
      if (error instanceof Error && (error.message.startsWith('"') || error.message === 'A settings object is required.')) {
        reply.code(400);
        return { error: 'invalid_settings', message: error.message };
      }
      throw error;
    }
  });
}
