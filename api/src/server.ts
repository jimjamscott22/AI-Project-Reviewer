import path from 'node:path';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { config } from './config.js';
import { SESSION_COOKIE_NAME, authEnabled, touchSession } from './lib/auth.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { jobRoutes } from './routes/jobs.js';
import { repoRoutes } from './routes/repos.js';
import { settingsRoutes } from './routes/settings.js';

// Reachable without a session even when AUTH_TOKEN is set.
const PUBLIC_API_PATHS = new Set(['/api/health', '/api/session', '/api/session/login', '/api/session/logout']);

function isPublicPath(pathname: string): boolean {
  // Only the API surface is gated; static asset serving (added by Task 6's
  // Docker packaging) is left untouched here.
  return !pathname.startsWith('/api/') || PUBLIC_API_PATHS.has(pathname);
}

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

  await app.register(cors, { origin: config.corsOrigin, credentials: true });
  await app.register(cookie);

  app.addHook('onRequest', async (request, reply) => {
    if (!authEnabled()) return;
    const pathname = request.url.split('?')[0] ?? request.url;
    if (isPublicPath(pathname)) return;
    if (!touchSession(request.cookies[SESSION_COOKIE_NAME])) {
      reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
    }
  });

  await app.register(authRoutes);
  await app.register(healthRoutes);
  await app.register(repoRoutes);
  await app.register(jobRoutes);
  await app.register(settingsRoutes);

  if (config.staticDir) {
    const staticRoot = path.resolve(config.staticDir);
    await app.register(staticFiles, { root: staticRoot, index: 'index.html' });

    // Any GET that doesn't match a static asset or a registered /api/* route
    // is an SPA client-side route (e.g. /reviews/some-repo) and gets the app
    // shell; a miss under /api/* stays a real 404 instead of falling back.
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        reply.code(404).send({ error: 'not_found', message: 'Not found.' });
        return;
      }
      reply.type('text/html').sendFile('index.html');
    });
  }

  return app;
}
