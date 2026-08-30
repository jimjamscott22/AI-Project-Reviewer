import type { FastifyInstance } from 'fastify';
import { getReviewerSettings, saveReviewerSettings } from '../db/settings.js';
import { normalizeReviewerSettings } from '../lib/ollamaSettings.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', async () => getReviewerSettings());

  app.put<{ Body: unknown }>('/api/settings', async (request, reply) => {
    try {
      return await saveReviewerSettings(normalizeReviewerSettings(request.body));
    } catch (error) {
      if (error instanceof Error && (error.message.startsWith('"') || error.message === 'A settings object is required.')) {
        reply.code(400);
        return { error: 'invalid_settings', message: error.message };
      }
      throw error;
    }
  });
}
