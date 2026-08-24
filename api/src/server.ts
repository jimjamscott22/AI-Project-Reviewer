import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { jobRoutes } from './routes/jobs.js';
import { repoRoutes } from './routes/repos.js';

const DATABASE_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
]);

function hasDatabaseErrorCode(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('code' in error && typeof error.code === 'string' && DATABASE_ERROR_CODES.has(error.code)) {
    return true;
  }

  if (error instanceof AggregateError) {
    return error.errors.some(hasDatabaseErrorCode);
  }

  return false;
}

export interface BuildServerOptions {
  logger?: boolean;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (hasDatabaseErrorCode(error)) {
      reply.code(503).send({
        error: 'database_unavailable',
        message: 'The review database is unavailable. Try again after MariaDB is running.',
      });
      return;
    }

    reply.code(500).send({
      error: 'internal_error',
      message: 'An unexpected server error occurred.',
    });
  });

  await app.register(cors, { origin: config.corsOrigin });
  await app.register(healthRoutes);
  await app.register(repoRoutes);
  await app.register(jobRoutes);

  return app;
}
