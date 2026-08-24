import type { FastifyInstance } from 'fastify';
import { getJobById } from '../db/jobs.js';

export async function jobRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/api/jobs/:id', async (req, reply) => {
    const job = await getJobById(req.params.id);
    if (!job) {
      reply.code(404);
      return { error: 'not_found', message: `No review job with id "${req.params.id}"` };
    }
    return job;
  });
}
