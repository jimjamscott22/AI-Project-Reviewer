# Portable App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task by task. (The project owner has disabled test-first loops, worktrees and subagents; see Global Constraints.) Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Raspberry Pi / LAN-server deployment target so AI Project Reviewer is a single-user app that builds and runs on any device, with host-run inference and a localhost-only default.

**Architecture:** Keep Fastify + MariaDB + the Compose packaging. Fix the URL validator so containers can reach host inference (`host.docker.internal`), bind the API to loopback by default (natively and in Compose), let the session cookie work over plain-HTTP LAN access when deliberately exposed, drop the bundled Ollama container, and rewrite the docs and smoke test to match.

**Tech Stack:** Node 22, TypeScript, Fastify 5, `node:test` via `tsx`, React 19 + Vitest, Docker Compose, bash.

**Spec:** `docs/superpowers/specs/2026-10-22-portable-app-design.md`

## Global Constraints

- Work sequentially in `D:\Code\Web Dev\AI-Project-Reviewer` on the current branch (`main`). No worktrees, no subagents.
- Implement directly, then add the regression tests for that change; do not use a test-first loop.
- Commit once per task (messages below). End every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push.
- Inference traffic stays local: never loosen the URL validator to "any dotted hostname".
- Do not touch the review pipeline, schema, worker, or the existing auth behavior beyond the cookie `secure` override in Task 2.
- Do not edit historical records `docs/2026-08-28-current-state-review.md` and `docs/checkpoints/*`.
- `.env.example` (repo root) is covered by a permission deny rule. Task 3 Step 4 cannot be completed by the agent unless the owner pastes the file's contents or lifts the rule. Do not read or edit it through any other tool.
- Baseline gates that must pass at the end: in `api/` `npm run lint`, `npm run typecheck`, `npm test`; in `frontend/` `npm run lint` (one pre-existing warning at `src/screens/SettingsScreen.tsx:27` is expected), `npm test`, `npm run build`.

## File Map

| File | Responsibility in this plan |
| --- | --- |
| `api/src/lib/ollamaSettings.ts` | URL validator: add Docker host aliases (Task 1) |
| `api/src/config.ts` | Add `host`, `auth.cookieSecure` and their pure resolvers (Task 2) |
| `api/src/index.ts` | Listen on `config.host` (Task 2) |
| `api/src/routes/auth.ts` | Cookie `secure` from config (Task 2) |
| `frontend/src/screens/SettingsScreen.tsx` | Server-address help text (Task 1) |
| `docker-compose.yml`, `Dockerfile`, `.env.example` | Packaging changes (Task 3) |
| `scripts/docker-smoke-test.sh` | Loopback + host-inference assertions, wording (Task 3) |
| `README.md` | Rewrite deployment sections (Task 4) |
| `design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md`, `api/README.md`, `frontend/README.md`, `docs/superpowers/plans/2026-08-23-finish-ai-project-reviewer.md` | Remove Pi framing (Task 5) |
| `api/test/inference-url.test.ts`, `api/test/config.test.ts` | New tests (Tasks 1, 2) |

---

### Task 1: Let containers reach host inference

**Files:**
- Modify: `api/src/lib/ollamaSettings.ts:1-11, 26-28`
- Modify: `frontend/src/screens/SettingsScreen.tsx:76`
- Create: `api/test/inference-url.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `normalizeOllamaBaseUrl(value: string, label?: string): string` (unchanged signature) now accepts `host.docker.internal` and `gateway.docker.internal`. Used by `api/src/config.ts`, `api/src/lib/lmStudio.ts`, and the settings route.

Background: the current Compose default `OLLAMA_BASE_URL=http://host.docker.internal:11434` is rejected by this validator (it contains dots, is not `.local`, and is not an IP), and `config.ts` runs the validator at startup, so the container would fail to start.

- [ ] **Step 1: Add the allow-list to the validator**

In `api/src/lib/ollamaSettings.ts`, replace lines 3-5 (the function head and first `if`) so the file begins:

```ts
import type { ReviewerSettings } from '../types.js';

// Names Docker injects so a container can reach the machine it runs on. An explicit
// allow-list (not "any dotted hostname") keeps public hosts out of the inference path.
const DOCKER_HOST_ALIASES = new Set(['host.docker.internal', 'gateway.docker.internal']);

function isLocalHostname(rawHostname: string): boolean {
  const hostname = rawHostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (DOCKER_HOST_ALIASES.has(hostname)) return true;
  if (hostname === 'localhost' || hostname.endsWith('.local') || !hostname.includes('.')) return true;
```

Leave the remaining lines of `isLocalHostname` unchanged.

- [ ] **Step 2: Update the rejection message**

In the same file, replace the `throw new Error(...)` inside `if (!isLocalHostname(parsed.hostname))` with:

```ts
    throw new Error(`${label} must target localhost, a Docker host alias (host.docker.internal), a private/link-local IP, a .local host, or a single-label LAN/container host.`);
```

- [ ] **Step 3: Update the Settings screen help text**

In `frontend/src/screens/SettingsScreen.tsx` line 76, replace the paragraph text

`Use the server address reachable from the review API. For LM Studio on another machine, enter its LAN address.`

with

`Use the server address reachable from the review API. Running natively, that is usually localhost; in Docker, use host.docker.internal.`

- [ ] **Step 4: Add the regression tests**

Create `api/test/inference-url.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOllamaBaseUrl } from '../src/lib/ollamaSettings.js';

test('Docker host aliases are accepted and normalized', () => {
  assert.equal(normalizeOllamaBaseUrl('http://host.docker.internal:11434'), 'http://host.docker.internal:11434');
  assert.equal(normalizeOllamaBaseUrl('http://gateway.docker.internal:1234/'), 'http://gateway.docker.internal:1234');
  assert.equal(normalizeOllamaBaseUrl('HTTP://Host.Docker.Internal:11434'), 'http://host.docker.internal:11434');
});

test('existing local forms are still accepted', () => {
  for (const url of ['http://localhost:11434', 'http://127.0.0.1:1234', 'http://192.168.1.5:1234', 'http://10.0.0.2:11434', 'http://[::1]:11434', 'http://mybox:1234', 'http://printer.local:1234']) {
    assert.doesNotThrow(() => normalizeOllamaBaseUrl(url), url);
  }
});

test('public hosts and look-alikes of the Docker aliases are rejected', () => {
  for (const url of [
    'https://example.com',
    'http://host.docker.internal.example.com:11434',
    'http://evil.host.docker.internal:11434',
    'http://host.docker.internal.evil:11434',
    'http://docker.internal:11434',
  ]) {
    assert.throws(() => normalizeOllamaBaseUrl(url), /must target localhost/, url);
  }
});

test('an empty URL still disables inference', () => {
  assert.equal(normalizeOllamaBaseUrl('   '), '');
});
```

- [ ] **Step 5: Run the checks**

Run: `cd api && npx tsx --test test/inference-url.test.ts test/settings.test.ts`
Expected: all tests pass (4 new, 1 existing).

Run: `cd api && npm run lint && npm run typecheck && npm test`
Expected: lint and typecheck clean; all tests pass (56 total: 52 existing + 4 new).

Run: `cd frontend && npm test`
Expected: 27 tests pass (no test references the old help text).

- [ ] **Step 6: Commit**

```bash
git add api/src/lib/ollamaSettings.ts api/test/inference-url.test.ts frontend/src/screens/SettingsScreen.tsx
git commit -m "fix: accept Docker host aliases as local inference hosts

host.docker.internal was rejected by the base-URL validator, which would stop
the API container from starting with the Compose default.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Localhost-by-default bind address and cookie override

**Files:**
- Modify: `api/src/config.ts` (top-level exports, `auth` block)
- Modify: `api/src/index.ts:18`
- Modify: `api/src/routes/auth.ts:44`
- Modify: `api/test/auth.test.ts:13` (test title only)
- Create: `api/test/config.test.ts`

**Interfaces:**
- Produces from `api/src/config.ts`:
  - `resolveBindHost(value: string | undefined): string` returns the trimmed value, or `'127.0.0.1'` when unset/blank.
  - `resolveCookieSecure(value: string | undefined, nodeEnv: string): boolean` returns `true` for `'true'`, `false` for `'false'` (case-insensitive, trimmed), otherwise `nodeEnv === 'production'`.
  - `config.host: string` and `config.auth.cookieSecure: boolean`.
- Consumes: nothing from Task 1.

Background: `index.ts` binds `0.0.0.0` today, so a native `npm start` is reachable network-wide. The container still needs `0.0.0.0` (Task 3 sets `HOST=0.0.0.0` there). The session cookie is `secure` in production, which browsers discard over `http://<lan-ip>`; the override makes deliberate plain-HTTP LAN use possible.

- [ ] **Step 1: Add the resolvers and config fields**

In `api/src/config.ts`, directly after the `boundedInteger` function (before `export const config`), add:

```ts
/** Loopback unless HOST is set; the Docker image sets HOST=0.0.0.0 and Compose restricts publishing instead. */
export function resolveBindHost(value: string | undefined): string {
  return value?.trim() || '127.0.0.1';
}

/** Defaults to secure cookies in production; AUTH_COOKIE_SECURE=false allows plain-HTTP LAN use. */
export function resolveCookieSecure(value: string | undefined, nodeEnv: string): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return nodeEnv === 'production';
}
```

Inside `export const config = {`, change the first lines to:

```ts
export const config = {
  port: Number(required('PORT', '8080')),
  host: resolveBindHost(process.env.HOST),
```

and in the `auth` block replace the comment and add the field so it reads:

```ts
  auth: {
    // Empty token means no login is required; setting it protects mutation/data/settings routes.
    token: required('AUTH_TOKEN', ''),
    cookieSecure: resolveCookieSecure(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV ?? 'development'),
    sessionTtlMs: boundedInteger('AUTH_SESSION_TTL_MS', 12 * 60 * 60 * 1000, 60_000, 30 * 24 * 60 * 60 * 1000),
  },
```

- [ ] **Step 2: Use them**

In `api/src/index.ts` line 18 change to:

```ts
  await app.listen({ port: config.port, host: config.host });
```

In `api/src/routes/auth.ts` line 44 change to:

```ts
      secure: config.auth.cookieSecure,
```

- [ ] **Step 3: Rename the misleading test title**

In `api/test/auth.test.ts` line 13 change the title to `'with AUTH_TOKEN unset, no login is required'`.

- [ ] **Step 4: Add the regression tests**

Create `api/test/config.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBindHost, resolveCookieSecure } from '../src/config.js';

test('the bind host defaults to loopback and honors HOST', () => {
  assert.equal(resolveBindHost(undefined), '127.0.0.1');
  assert.equal(resolveBindHost(''), '127.0.0.1');
  assert.equal(resolveBindHost('   '), '127.0.0.1');
  assert.equal(resolveBindHost('0.0.0.0'), '0.0.0.0');
  assert.equal(resolveBindHost(' 192.168.1.20 '), '192.168.1.20');
});

test('session cookies are secure in production unless explicitly overridden', () => {
  assert.equal(resolveCookieSecure(undefined, 'production'), true);
  assert.equal(resolveCookieSecure('', 'production'), true);
  assert.equal(resolveCookieSecure(undefined, 'development'), false);
  assert.equal(resolveCookieSecure('false', 'production'), false);
  assert.equal(resolveCookieSecure(' FALSE ', 'production'), false);
  assert.equal(resolveCookieSecure('true', 'development'), true);
  assert.equal(resolveCookieSecure('nonsense', 'production'), true);
});
```

- [ ] **Step 5: Run the checks**

Run: `cd api && npx tsx --test test/config.test.ts test/auth.test.ts`
Expected: pass.

Run: `cd api && npm run lint && npm run typecheck && npm test`
Expected: clean; 58 tests pass.

- [ ] **Step 6: Commit**

```bash
git add api/src/config.ts api/src/index.ts api/src/routes/auth.ts api/test/auth.test.ts api/test/config.test.ts
git commit -m "feat: bind to loopback by default and allow AUTH_COOKIE_SECURE override

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Compose, Dockerfile, env template, smoke test

**Files:**
- Modify: `docker-compose.yml` (replace whole file)
- Modify: `Dockerfile:3-6, 49-51`
- Modify: `.env.example` (owner action, see Step 4)
- Modify: `scripts/docker-smoke-test.sh:2-6, 64, after line 88`

**Interfaces:**
- Consumes: `HOST` and `AUTH_COOKIE_SECURE` environment variables from Task 2; `host.docker.internal` acceptance from Task 1.

- [ ] **Step 1: Replace `docker-compose.yml`**

```yaml
services:
  mariadb:
    image: mariadb:11
    restart: unless-stopped
    environment:
      MARIADB_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-change-me-root}
      MARIADB_DATABASE: ${DB_NAME:-apr}
      MARIADB_USER: ${DB_USER:-apr}
      MARIADB_PASSWORD: ${DB_PASSWORD:-change-me}
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "healthcheck.sh --connect --innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    mem_limit: 512m
    networks: [apr]

  api:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      mariadb:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 8080
      # Bind all interfaces inside the container; the port mapping below is what
      # keeps it private to this device.
      HOST: 0.0.0.0
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:8080}
      AUTH_TOKEN: ${AUTH_TOKEN:-}
      AUTH_COOKIE_SECURE: ${AUTH_COOKIE_SECURE:-}
      AUTH_SESSION_TTL_MS: ${AUTH_SESSION_TTL_MS:-43200000}
      DB_HOST: mariadb
      DB_PORT: 3306
      DB_USER: ${DB_USER:-apr}
      DB_PASSWORD: ${DB_PASSWORD:-change-me}
      DB_NAME: ${DB_NAME:-apr}
      # Inference servers run on the host (for GPU access), not in a container.
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
      OLLAMA_MODEL: ${OLLAMA_MODEL:-llama3.1}
      LMSTUDIO_BASE_URL: ${LMSTUDIO_BASE_URL:-http://host.docker.internal:1234}
      LMSTUDIO_MODEL: ${LMSTUDIO_MODEL:-}
      LMSTUDIO_API_TOKEN: ${LMSTUDIO_API_TOKEN:-}
      LMSTUDIO_TIMEOUT_MS: ${LMSTUDIO_TIMEOUT_MS:-120000}
    ports:
      # Loopback only. To reach the app from other devices, see "Exposing to your
      # LAN" in the README before removing the 127.0.0.1 prefix.
      - "127.0.0.1:${API_PORT:-8080}:8080"
    volumes:
      - review_work:/app/.review-work
    # Only the repository-work cache needs to be writable; everything else
    # in the image (compiled code, node_modules, the built frontend) is
    # read-only at runtime, and /tmp gets a small tmpfs for any incidental
    # scratch writes.
    read_only: true
    tmpfs:
      - /tmp:size=64m
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8080/api/health').then((r) => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    mem_limit: 768m
    networks: [apr]

networks:
  apr: {}

volumes:
  db_data:
  review_work:
```

- [ ] **Step 2: Update the Dockerfile**

Replace the header comment lines 3-6 with:

```dockerfile
# Builds a single image that serves the whole app (API + frontend) from one
# origin: Fastify answers /api/* itself and serves the built frontend (with
# an SPA fallback) for everything else. See docker-compose.yml for how this
# image is run alongside MariaDB; Ollama/LM Studio run on the host.
```

Replace `ENV NODE_ENV=production` (line 49) with:

```dockerfile
ENV NODE_ENV=production
# Bind all interfaces inside the container; docker-compose.yml publishes the
# port on 127.0.0.1 only.
ENV HOST=0.0.0.0
```

- [ ] **Step 3: Validate the Compose file**

Run: `docker compose config --quiet`
Expected: exits 0 with no output. If Docker is not installed on this machine, record "not run: no Docker" and continue; the smoke test in Task 6 covers it.

Run: `grep -n "ollama:" docker-compose.yml`
Expected: no match for a service named `ollama` (only the `OLLAMA_*` variable lines contain "OLLAMA").

- [ ] **Step 4: Update the root `.env.example` (owner action)**

The agent cannot read or edit this file (permission deny rule). The owner pasted its contents on 2026-10-22, so the exact replacement is below. Ask the owner to either replace the file's contents with this block by hand, or lift the deny rule so the agent can write it. The changes versus the current file: the Pi hostname hint and "LAN-open" wording are gone, the `with-ollama` comment is gone, and `AUTH_COOKIE_SECURE` and the `LMSTUDIO_*` keys are new. Every other line is unchanged.

```dotenv
# Copy to .env before running `docker compose up`. These variables are read
# by docker-compose.yml; see api/.env.example for the full set of variables
# the API itself understands (most have sane defaults and don't need to be
# repeated here).

# Host port the app is published on, on this machine only
# (http://localhost:<this>). See "Exposing to your LAN" in the README to
# change that.
API_PORT=8080

# MariaDB credentials, shared between the mariadb and api services.
DB_ROOT_PASSWORD=change-me-root
DB_NAME=apr
DB_USER=apr
DB_PASSWORD=change-me

# Optional single-user access token. Leave empty on a single-user local
# install (no login). Set a long random value before exposing the app
# beyond this device.
AUTH_TOKEN=

# Empty marks the session cookie Secure in production, which is correct for
# localhost and HTTPS. Set to false ONLY for plain-HTTP LAN access, and only
# together with AUTH_TOKEN; the token then travels unencrypted.
AUTH_COOKIE_SECURE=

# Origin allowed to call the API with credentials. The bundled frontend is
# served from the same origin as the API, so the default below (matching
# API_PORT) is normally correct; change it only if you put a reverse proxy
# or a different frontend origin in front of this deployment.
CORS_ORIGIN=http://localhost:8080

# Local narrative generation. Ollama and LM Studio run natively on the host
# (for GPU access); host.docker.internal reaches them from the container
# (works on Linux via the extra_hosts entry in docker-compose.yml).
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1
LMSTUDIO_BASE_URL=http://host.docker.internal:1234
LMSTUDIO_MODEL=
LMSTUDIO_API_TOKEN=
```

Mark this step done only after the file has been updated. If the owner declines, note it in the final summary; the stack still works because every variable has a default in `docker-compose.yml`.

- [ ] **Step 5: Update the smoke test**

In `scripts/docker-smoke-test.sh` replace the header comment (lines 2-6) with:

```bash
# Smoke-tests the Docker Compose packaging end to end: non-root execution,
# loopback-only publishing, MariaDB/API health ordering, host-inference
# reachability (when Ollama runs on the host), data persistence across a
# restart, optional auth enabled/disabled, and an SPA deep link. Run this from
# any machine with Docker and normal container-registry access after
# `docker compose build`; it is not run automatically anywhere.
```

Replace line 64 with:

```bash
echo "==> Building and starting the stack (AUTH_TOKEN unset: no login required)"
```

Insert after the non-root check (after the `fi` that closes it, currently line 81) the two new checks:

```bash
echo "==> Checking the API port is published on loopback only"
PUBLISHED="$("${COMPOSE[@]}" port api 8080 | tr -d '\r')"
case "$PUBLISHED" in
  127.0.0.1:*) pass "api port is published on ${PUBLISHED} (loopback only)" ;;
  *) fail "api port is published on '${PUBLISHED}', expected 127.0.0.1:<port>" ;;
esac

echo "==> Checking the API container can reach host-run Ollama (skipped if Ollama is not running on the host)"
if curl -fsS -m 3 -o /dev/null http://localhost:11434/api/tags 2>/dev/null; then
  if curl -fsS "${BASE_URL}/api/health" | grep -Eq '"inference":\{[^}]*"reachable":true'; then
    pass "API container reaches host Ollama through host.docker.internal"
  else
    fail "host Ollama is running but the API container could not reach it (on Linux, start Ollama with OLLAMA_HOST=0.0.0.0)"
  fi
else
  echo "  SKIP: no Ollama on http://localhost:11434"
fi
```

- [ ] **Step 6: Check the script parses**

Run: `bash -n scripts/docker-smoke-test.sh`
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml Dockerfile scripts/docker-smoke-test.sh
# add .env.example too only if the owner updated it in Step 4
git commit -m "feat: make the Compose stack loopback-only with host-run inference

Drop the bundled Ollama service, publish the API on 127.0.0.1, pass through
LM Studio and cookie settings, and extend the smoke test.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Rewrite the README deployment sections

**Files:**
- Modify: `README.md`

**Interfaces:** Consumes the behavior defined in Tasks 1-3 (`HOST`, `AUTH_COOKIE_SECURE`, loopback publishing, `host.docker.internal`).

- [ ] **Step 1: Replace the Docker section**

In `README.md`, delete everything from the line `## Docker / Raspberry Pi Deployment` up to, but not including, the line `### Token setup`, and insert this in its place:

````markdown
## Running with Docker

The app ships as a Docker Compose stack: one image serves the API and the built frontend from the same origin (Fastify answers `/api/*` itself and serves the SPA, with a client-side-route fallback, for everything else) alongside a MariaDB container. Ollama or LM Studio run natively on the same machine, not in a container, so they keep direct GPU access. The stack listens on `127.0.0.1` only; see [Exposing to your LAN](#exposing-to-your-lan) to change that.

> [!NOTE]
> This packaging (`Dockerfile`, `docker-compose.yml`, the static-serving/SPA-fallback code, and the migration entrypoint) was authored and unit-tested in this repository — see `api/test/static.test.ts` — but a live `docker compose up --build` has not been run yet. Run `scripts/docker-smoke-test.sh` on a machine with Docker to validate a real build; it checks non-root execution, loopback-only publishing, MariaDB/API health ordering, host-inference reachability (when Ollama is running), data persistence across a restart, auth enabled/disabled, and an SPA deep link.

### Prerequisites

- Docker Engine or Docker Desktop with the Compose plugin (`docker compose version`)
- Any x86_64 or ARM64 machine; the Node and MariaDB images are multi-arch, so `docker compose build` produces a native image with no cross-compilation
- About 2 GB of free RAM for MariaDB and the API
- Optionally, Ollama and/or LM Studio running on the host; without one, reviews use the deterministic template narrative

### First boot

```bash
git clone https://github.com/jimjamscott22/AI-Project-Reviewer.git
cd AI-Project-Reviewer
cp .env.example .env
```

Edit `.env`: set real values for `DB_ROOT_PASSWORD` and `DB_PASSWORD`, and leave `AUTH_TOKEN` empty for a single-user local install. Then build and start:

```bash
docker compose up -d --build
```

The `api` container applies the database schema automatically on every start (idempotently — see `api/docker-entrypoint.sh`); it never runs the sample-data seed in production. Once `docker compose ps` shows `mariadb` and `api` as `healthy`, open <http://localhost:8080>.

### Reaching host inference

Inside the container, `localhost` is the container itself. Compose maps `host.docker.internal` to the host, and the defaults use it: `http://host.docker.internal:11434` for Ollama and `http://host.docker.internal:1234` for LM Studio. If the Settings screen or `/api/health` reports the server unreachable, make sure it accepts connections from Docker: on Linux, start Ollama with `OLLAMA_HOST=0.0.0.0`; in LM Studio, enable serving on the local network. Pull or download a model on the host as usual (for example `ollama pull llama3.1`). Until one is available, narratives fall back to the deterministic template text.

````

Then in the retained `### Token setup` section, replace the final sentence

`Leave `AUTH_TOKEN` empty to keep the app open to anyone on the LAN.`

with

`Leave `AUTH_TOKEN` empty for a single-user local install; set it before exposing the app beyond this device (see [Exposing to your LAN](#exposing-to-your-lan)).`

Leave `### Backups`, `### Upgrades`, `### Logs`, `### Health checks` and `### Rollback` unchanged.

- [ ] **Step 2: Add the LAN section**

Insert this immediately before the line `## Configuration`:

````markdown
## Exposing to your LAN

By default the app is reachable only from the device it runs on. To use it from another device on your network:

1. Set a long random `AUTH_TOKEN` (for example `openssl rand -hex 32`) in `.env` (Docker) or `api/.env` (native). Do not expose the app without one.
2. Docker: in `docker-compose.yml`, change the API port mapping from `"127.0.0.1:${API_PORT:-8080}:8080"` to `"${API_PORT:-8080}:8080"`. Native: set `HOST=0.0.0.0` in `api/.env`.
3. The session cookie is marked `Secure` in production, and browsers discard `Secure` cookies over plain `http://<lan-ip>`. Either put the app behind an HTTPS reverse proxy (recommended), or set `AUTH_COOKIE_SECURE=false` and accept that the token then travels unencrypted on your local network.
4. Restart (`docker compose up -d`, or restart `npm start`) and allow the port through the host firewall.

Compose never publishes MariaDB; keep it that way.

````

- [ ] **Step 3: Targeted line edits**

Apply each replacement exactly (each old string is unique in `README.md`):

1. Intro blockquote (line 10): replace `and Docker/Raspberry Pi packaging are implemented.` with `and Docker Compose packaging are implemented.`, and replace `see [Docker / Raspberry Pi Deployment](#docker--raspberry-pi-deployment).` with `see [Running with Docker](#running-with-docker).`
2. Line 26: replace `while staying LAN-open by default` with `while requiring no login by default on a single-user local install`
3. Line 29: replace `with MariaDB and an optional bundled-Ollama profile, for Raspberry Pi deployment` with `with MariaDB, published on localhost only and reaching host-run Ollama or LM Studio, for any x86_64 or ARM64 machine`
4. Config table: replace the `AUTH_TOKEN` row's `Empty keeps the API LAN-open (no login); setting it requires` with `Empty requires no login; setting it requires`
5. Config table: insert this row directly after the `PORT` row, and this row after the `AUTH_TOKEN` row:
   - `| `HOST` | `127.0.0.1` | Interface the API binds to. The Docker image sets `0.0.0.0` inside the container; Compose publishes it on `127.0.0.1` only |`
   - `| `AUTH_COOKIE_SECURE` | empty | `true`/`false`. Empty marks the session cookie `Secure` in production only; set `false` for plain-HTTP LAN access (see [Exposing to your LAN](#exposing-to-your-lan)) |`
6. Local Inference paragraph (line ~279): replace the sentence `For an API on a Raspberry Pi and LM Studio on a desktop, use the desktop's LAN address and enable LM Studio's network server access; `localhost:1234` means the API's own machine.` with `Running natively, use `localhost` (for example `http://localhost:1234`); in Docker, use `host.docker.internal` (the Compose default), because `localhost` there means the container itself. If the inference server is on a different machine, use its LAN address and enable its network server access.`
7. API section (line ~305): replace `the API stays LAN-open and every route above is reachable without a session` with `no login is required and every route above is reachable without a session`
8. Project structure (line ~371): replace `API + MariaDB (+ optional bundled Ollama profile)` with `API + MariaDB (inference runs on the host)`
9. Roadmap (line ~385): replace `M5: Docker Compose packaging and Raspberry Pi deployment — ` with `M5: Docker Compose packaging for any device — ` and replace `(see [Docker / Raspberry Pi Deployment](#docker--raspberry-pi-deployment))` with `(see [Running with Docker](#running-with-docker))`
10. Add a short "Running natively" subsection to Quick Start: after the `### Frontend with MariaDB` section's final paragraph (the one beginning `` `npm run migrate` creates ``), append:

````markdown
### Production build, no Docker

Build both workspaces, then serve the built frontend from the API on one origin:

```bash
cd frontend && npm install && npm run build && cd ..
cd api && npm install && npm run build
STATIC_DIR="$(pwd)/../frontend/dist" npm start
```

Open <http://localhost:8080>. The API binds to `127.0.0.1` by default (set `HOST` to change it) and reaches Ollama/LM Studio at `localhost`. On Windows PowerShell, set `$env:STATIC_DIR = (Resolve-Path ..\frontend\dist).Path` before `npm start`.
````

- [ ] **Step 4: Verify no stale wording remains**

Run: `grep -n -i "raspberry\|\bpi\b\|arm64 linux\|with-ollama\|bundled.ollama\|LAN-open" README.md`
Expected: no matches. (The word "Pi" must not appear anywhere in `README.md`.)

Run: `grep -n "](#" README.md | grep -i "docker\|lan"`
Expected: every anchor used (`#running-with-docker`, `#exposing-to-your-lan`, `#token-setup`, `#local-inference`) corresponds to an existing heading.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README deployment sections for a portable single-user app

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Remove Pi framing from the remaining docs

**Files:**
- Modify: `design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md:3, 7, 9, 39, 61, 64`
- Modify: `api/README.md:63`
- Modify: `frontend/README.md:6`
- Modify: `docs/superpowers/plans/2026-08-23-finish-ai-project-reviewer.md` (insert one line after the title)

- [ ] **Step 1: Edit the design handoff plan**

Apply each replacement exactly:

- Line 3: replace
  `Self-hosted on the user's Raspberry Pi (LAN): MariaDB for persistence, Ollama for review generation, no cloud dependencies. Read `README.md` first for the full UI spec.`
  with
  `A single-user app that builds and runs on any device: MariaDB for persistence, a host-run local inference server (Ollama or LM Studio) for review narratives, no cloud dependencies. See `../docs/superpowers/specs/2026-10-22-portable-app-design.md` for the current deployment design (this document predates it). Read `README.md` first for the full UI spec.`
- Line 7: replace `Node (Fastify or Express) on the Pi — a thin` with `Node (Fastify or Express) — a thin`
- Line 9: replace
  `- **Deploy**: docker-compose on the Pi — `api`, `mariadb`, `ollama` (or Ollama native), frontend served as static files by the API.`
  with
  `- **Deploy**: docker-compose on any x86_64 or ARM64 machine — `api` and `mariadb`, frontend served as static files by the API, published on localhost only. Ollama / LM Studio run natively on the host. A native `npm run build && npm start` path is also supported.`
- Line 39: replace `CORS: allow the frontend origin; everything stays on the LAN.` with `CORS: allow the frontend origin; the API listens on localhost by default and LAN exposure is an explicit opt-in.`
- Line 61: replace `auth (single-user token is enough on a LAN), docker-compose.` with `optional single-user token auth, docker-compose packaging for any device.`
- Line 64: replace `public exposure of the Pi.` with `hosted or multi-device deployment (a home server or Pi is possible but not designed for or tested against).`

- [ ] **Step 2: Edit the sub-READMEs**

In `api/README.md` line 63 replace `# compiled, for parity with the Pi deployment` with `# compiled, same as the Docker image runs`.

In `frontend/README.md` line 6 replace `and backend plan (MariaDB + Ollama on a Raspberry Pi).` with `and backend plan (MariaDB + a host-run local inference server).`

- [ ] **Step 3: Point the completion plan at the new spec**

In `docs/superpowers/plans/2026-08-23-finish-ai-project-reviewer.md`, insert immediately after the first line (`# AI Project Reviewer Completion Implementation Plan`) and a blank line:

```markdown
> **Superseded in part (2026-10-22):** the Raspberry Pi / LAN deployment target in this plan was dropped. See `docs/superpowers/specs/2026-10-22-portable-app-design.md` and `docs/superpowers/plans/2026-10-22-portable-app.md`. The rest of this plan is kept as a historical record.
```

- [ ] **Step 4: Verify**

Run: `grep -rn -i "raspberry\|\bthe Pi\b\|on the Pi" README.md api/README.md frontend/README.md design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md api/README.md frontend/README.md docs/superpowers/plans/2026-08-23-finish-ai-project-reviewer.md
git commit -m "docs: remove Raspberry Pi framing from the design plan and sub-READMEs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Final verification and live smoke test

**Files:** none modified unless a check fails.

- [ ] **Step 1: Run every baseline gate**

Run: `cd api && npm run lint && npm run typecheck && npm test`
Expected: clean; 58 tests pass.

Run: `cd frontend && npm run lint && npm test && npm run build`
Expected: 27 tests pass; build succeeds; lint shows only the pre-existing `SettingsScreen.tsx:27` warning.

- [ ] **Step 2: Confirm the working tree**

Run: `git status --short && git log --oneline -6`
Expected: clean tree; the five commits from Tasks 1-5 on top of `docs: add portable-app design spec`.

- [ ] **Step 3: Live Docker smoke test (owner's machine)**

Requires Docker with registry access. With Ollama running on the host and a model pulled, run:

```bash
bash scripts/docker-smoke-test.sh
```

Expected: every line `PASS` (the host-Ollama line prints `SKIP` if Ollama is not running), final line `N passed, 0 failed`.

If the host-Ollama check fails, fix the cause (README "Reaching host inference" wording, `OLLAMA_HOST` guidance, or Compose networking) and re-run before continuing. On Windows, run the script from Git Bash or WSL.

- [ ] **Step 4: Close M5 only if Step 3 passed**

If, and only if, the smoke test passed with 0 failures, in `README.md`:
- remove the `> [!NOTE]` paragraph beginning `This packaging (` under "Running with Docker" and replace it with: `> [!NOTE]` / `> `scripts/docker-smoke-test.sh` passes on a clean build (verified YYYY-MM-DD on <OS>, Docker <version>).` filling in the real date, OS and version;
- change the roadmap line to `- [x] M5: Docker Compose packaging for any device`;
- change the intro blockquote to drop the "has not had a live `docker compose up --build` run" sentence.

Then:

```bash
git add README.md
git commit -m "docs: record a passing live Docker smoke test and close M5

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

If Step 3 was not run, leave the README caveats in place and say so in the summary.
