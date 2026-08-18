import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok', db: true };
    } catch {
      reply.code(503);
      return { status: 'degraded', db: false };
    }
  });
}
