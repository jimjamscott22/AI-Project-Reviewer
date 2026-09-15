import assert from 'node:assert/strict';
import test from 'node:test';
import { config } from '../src/config.js';
import { SESSION_COOKIE_NAME, resetAuthStateForTests } from '../src/lib/auth.js';
import { buildServer } from '../src/server.js';

function extractSessionCookie(response: { cookies: { name: string; value: string }[] }): string {
  const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE_NAME);
  assert.ok(cookie, 'expected a session cookie to be set');
  return `${SESSION_COOKIE_NAME}=${cookie.value}`;
}

test('with AUTH_TOKEN unset, the API stays LAN-open', async () => {
  config.auth.token = '';
  const app = await buildServer({ logger: false });
  try {
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    assert.notEqual(health.statusCode, 401);

    const repos = await app.inject({ method: 'GET', url: '/api/repos' });
    assert.notEqual(repos.statusCode, 401);

    const session = await app.inject({ method: 'GET', url: '/api/session' });
    assert.deepEqual(session.json(), { authRequired: false, authenticated: true });
  } finally {
    await app.close();
  }
});

test('with AUTH_TOKEN set, protected routes require a session while health and session endpoints stay reachable', async () => {
  config.auth.token = 'correct-horse-battery-staple';
  resetAuthStateForTests();
  const app = await buildServer({ logger: false });
  try {
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    assert.notEqual(health.statusCode, 401);

    const status = await app.inject({ method: 'GET', url: '/api/session' });
    assert.deepEqual(status.json(), { authRequired: true, authenticated: false });

    const repos = await app.inject({ method: 'GET', url: '/api/repos' });
    assert.equal(repos.statusCode, 401);
    assert.equal(repos.json().error, 'unauthenticated');
  } finally {
    config.auth.token = '';
    await app.close();
  }
});

test('a correct token issues a session cookie that authorizes subsequent requests', async () => {
  config.auth.token = 'correct-horse-battery-staple';
  resetAuthStateForTests();
  const app = await buildServer({ logger: false });
  try {
    const login = await app.inject({ method: 'POST', url: '/api/session/login', payload: { token: 'correct-horse-battery-staple' } });
    assert.equal(login.statusCode, 200);
    const cookie = extractSessionCookie(login);

    const repos = await app.inject({ method: 'GET', url: '/api/repos', headers: { cookie } });
    assert.notEqual(repos.statusCode, 401);

    const status = await app.inject({ method: 'GET', url: '/api/session', headers: { cookie } });
    assert.deepEqual(status.json(), { authRequired: true, authenticated: true });

    const logout = await app.inject({ method: 'POST', url: '/api/session/logout', headers: { cookie } });
    assert.equal(logout.statusCode, 200);

    const afterLogout = await app.inject({ method: 'GET', url: '/api/repos', headers: { cookie } });
    assert.equal(afterLogout.statusCode, 401);
  } finally {
    config.auth.token = '';
    await app.close();
  }
});

test('an incorrect token is rejected without ever creating a session', async () => {
  config.auth.token = 'correct-horse-battery-staple';
  resetAuthStateForTests();
  const app = await buildServer({ logger: false });
  try {
    const login = await app.inject({ method: 'POST', url: '/api/session/login', payload: { token: 'wrong-guess' } });
    assert.equal(login.statusCode, 401);
    assert.equal(login.json().error, 'invalid_token');
    assert.equal(login.cookies.find((c) => c.name === SESSION_COOKIE_NAME), undefined);
  } finally {
    config.auth.token = '';
    await app.close();
  }
});

test('repeated failed logins from the same client are rate-limited', async () => {
  config.auth.token = 'correct-horse-battery-staple';
  resetAuthStateForTests();
  const app = await buildServer({ logger: false });
  try {
    let lastResponse;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      lastResponse = await app.inject({ method: 'POST', url: '/api/session/login', payload: { token: 'wrong-guess' } });
    }
    assert.equal(lastResponse?.statusCode, 429);
    assert.equal(lastResponse?.json().error, 'too_many_attempts');

    // Even the correct token is refused while the lockout window is active.
    const stillLocked = await app.inject({ method: 'POST', url: '/api/session/login', payload: { token: 'correct-horse-battery-staple' } });
    assert.equal(stillLocked.statusCode, 429);
  } finally {
    config.auth.token = '';
    await app.close();
  }
});

test('login is disabled entirely when AUTH_TOKEN is unset', async () => {
  config.auth.token = '';
  const app = await buildServer({ logger: false });
  try {
    const login = await app.inject({ method: 'POST', url: '/api/session/login', payload: { token: 'anything' } });
    assert.equal(login.statusCode, 404);
  } finally {
    await app.close();
  }
});
