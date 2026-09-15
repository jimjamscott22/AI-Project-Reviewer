import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import {
  SESSION_COOKIE_NAME,
  authEnabled,
  clearFailedAttempts,
  createSession,
  destroySession,
  isRateLimited,
  recordFailedAttempt,
  touchSession,
  verifyToken,
} from '../lib/auth.js';

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/session', async (request) => ({
    authRequired: authEnabled(),
    authenticated: !authEnabled() || touchSession(request.cookies[SESSION_COOKIE_NAME]),
  }));

  app.post<{ Body: { token?: unknown } }>('/api/session/login', async (request, reply) => {
    if (!authEnabled()) {
      reply.code(404);
      return { error: 'not_found', message: 'Authentication is not enabled on this server.' };
    }

    const attemptKey = request.ip;
    if (isRateLimited(attemptKey)) {
      reply.code(429);
      return { error: 'too_many_attempts', message: 'Too many failed sign-in attempts. Try again in a few minutes.' };
    }

    const token = typeof request.body?.token === 'string' ? request.body.token : '';
    if (!verifyToken(token)) {
      recordFailedAttempt(attemptKey);
      reply.code(401);
      return { error: 'invalid_token', message: 'Incorrect access token.' };
    }

    clearFailedAttempts(attemptKey);
    reply.setCookie(SESSION_COOKIE_NAME, createSession(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.nodeEnv === 'production',
      path: '/',
      maxAge: Math.floor(config.auth.sessionTtlMs / 1000),
    });
    return { authenticated: true };
  });

  app.post('/api/session/logout', async (request, reply) => {
    destroySession(request.cookies[SESSION_COOKIE_NAME]);
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { authenticated: false };
  });
}
