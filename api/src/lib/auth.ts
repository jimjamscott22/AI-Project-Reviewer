import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export const SESSION_COOKIE_NAME = 'apr_session';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000;

interface Session {
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

export function authEnabled(): boolean {
  return config.auth.token.length > 0;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function verifyToken(candidate: string): boolean {
  if (!authEnabled() || !candidate) return false;
  // Both operands are fixed-length SHA-256 digests, so the comparison itself
  // reveals nothing about where a mismatch occurs.
  return timingSafeEqual(digest(config.auth.token), digest(candidate));
}

export function isRateLimited(key: string): boolean {
  const entry = failedAttempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failedAttempts.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    failedAttempts.set(key, { count: 1, resetAt: now + LOCKOUT_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearFailedAttempts(key: string): void {
  failedAttempts.delete(key);
}

export function createSession(): string {
  const id = randomBytes(32).toString('hex');
  sessions.set(id, { expiresAt: Date.now() + config.auth.sessionTtlMs });
  return id;
}

/** Validates a session and slides its expiry forward; returns whether it is (still) valid. */
export function touchSession(id: string | undefined): boolean {
  if (!id) return false;
  const session = sessions.get(id);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(id);
    return false;
  }
  session.expiresAt = Date.now() + config.auth.sessionTtlMs;
  return true;
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

/** Test-only: drops all in-memory auth state so suites don't leak sessions/lockouts into each other. */
export function resetAuthStateForTests(): void {
  sessions.clear();
  failedAttempts.clear();
}
