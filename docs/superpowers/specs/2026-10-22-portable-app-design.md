# Portable App Design: Drop the Raspberry Pi Deployment Target

**Date:** 2026-10-22
**Status:** Approved design, awaiting implementation plan
**Supersedes:** the Raspberry Pi / LAN-server framing in `design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md` and in the M5 section of `README.md`

## Background

The original design targeted a Raspberry Pi on the user's LAN: MariaDB for persistence, Ollama for review narratives, a docker-compose stack, and a LAN-open default. The Pi cannot run local inference, so that target is dropped.

AI Project Reviewer is now a **single-user, build-anywhere app**. It runs on one device (Windows, macOS or Linux; x86_64 or ARM64) next to a locally run inference server (Ollama or LM Studio). It is no longer a server for other devices on a LAN.

## Decisions

| Question | Decision |
| --- | --- |
| Database and packaging | Keep MariaDB. Docker Compose remains the generic any-machine packaging, plus a native `npm run build && npm start` path against a local MariaDB. No SQLite port, no db adapter. |
| Inference topology | Ollama and LM Studio always run natively on the host (GPU access). The API reaches them at `localhost` natively and at `host.docker.internal` from the container. The bundled Ollama container is removed. |
| Network posture | Localhost by default. LAN exposure is a deliberate opt-in, documented together with setting `AUTH_TOKEN`. Existing optional auth is unchanged. |

## Unchanged

Fastify API and all routes, MariaDB schema and migrations, the sequential worker and review pipeline, the React frontend (including Settings, demo mode, and optional login), and the same-origin production build in which the API serves the built SPA.

## Changes

### 1. Compose and Docker

- `docker-compose.yml`
  - Remove the `ollama` service, the `with-ollama` profile, and the `ollama_data` volume.
  - Publish the API as `127.0.0.1:${API_PORT:-8080}:8080`. MariaDB stays unpublished.
  - Pass through `LMSTUDIO_BASE_URL`, `LMSTUDIO_MODEL`, `LMSTUDIO_API_TOKEN` and `LMSTUDIO_TIMEOUT_MS`, defaulting the base URL to `http://host.docker.internal:1234`. The current file passes only `OLLAMA_*`, so inside the container LM Studio would default to `localhost:1234`, which is the container itself.
  - Keep `extra_hosts: host.docker.internal:host-gateway` (already present, needed on Linux).
- `Dockerfile`: reword the header comment that mentions a bundled Ollama. No functional change; the base images are multi-arch.
- Root `.env.example`: drop the bundled-Ollama notes and add the LM Studio variables.

### 2. URL validator fix (the only code change)

`normalizeOllamaBaseUrl` in `api/src/lib/ollamaSettings.ts` accepts only `localhost`, `.local` hosts, single-label hosts, and private or link-local IPs. `host.docker.internal` contains dots, is not `.local`, and is not an IP, so it is rejected. Because `api/src/config.ts` runs the validator on `OLLAMA_BASE_URL` at startup, **the current Compose default (`http://host.docker.internal:11434`) would stop the API container from starting**, and the Settings screen could not save that host either. This is verified, not suspected: the validator was run against that value and rejected it.

Fix: allow `host.docker.internal` and `gateway.docker.internal` through an explicit named allow-list. Do not relax the rule to "any dotted hostname", which would let public hosts through and break the guarantee that inference traffic stays local.

Tests: extend the existing settings tests to cover accepted hosts (`host.docker.internal`, `gateway.docker.internal`, existing local forms) and rejected hosts (a public hostname, a look-alike such as `host.docker.internal.example.com`).

### 2b. Native bind address (found while planning)

`api/src/index.ts` calls `app.listen({ port, host: '0.0.0.0' })`, so a native `npm start` is reachable from the whole network regardless of the Compose port mapping. To make "localhost by default" true on both paths:

- Add `HOST` to `api/src/config.ts`, default `127.0.0.1`, and have `index.ts` listen on `config.host`.
- The container must still bind all interfaces for the published port to work, so the `Dockerfile` and `docker-compose.yml` set `HOST=0.0.0.0`. Compose's `127.0.0.1:` publish prefix is what keeps the container private to the device.
- Exposing a native install to the LAN means setting `HOST=0.0.0.0` (documented with `AUTH_TOKEN` in "Exposing to your LAN").

### 2c. Session cookie over plain-HTTP LAN access (found while planning)

`api/src/routes/auth.ts` sets `secure: config.nodeEnv === 'production'`, and the container always runs with `NODE_ENV=production`. Browsers store `Secure` cookies on `http://localhost` but discard them on `http://<lan-ip>`, so LAN exposure with `AUTH_TOKEN` would log in successfully and then lose the session on every request.

- Add `AUTH_COOKIE_SECURE` (`true` / `false`; empty or unset keeps today's behavior: secure in production).
- The "Exposing to your LAN" section documents setting `AUTH_COOKIE_SECURE=false` only for plain-HTTP LAN use, notes that the token then travels unencrypted on the local network, and recommends an HTTPS reverse proxy as the better option.
- Pass the variable through `docker-compose.yml`.

### 3. Documentation

| File | Change |
| --- | --- |
| `README.md` | Replace "Docker / Raspberry Pi Deployment" with "Running with Docker" and "Running natively". Remove Pi prerequisites and the bundled-Ollama steps. Add a short "Exposing to your LAN" section (publish address, `AUTH_TOKEN`, firewall). Rewrite the M5 roadmap line. Update the Local Inference text that suggests a desktop's LAN address; recommend `localhost`, or `host.docker.internal` in Docker. |
| `design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md` | Rewrite the intro, the "Deploy" bullet, the CORS line, M5, and the non-goals to match this spec. |
| `api/README.md` | Remove "for parity with the Pi deployment". |
| `frontend/README.md` | Remove "MariaDB + Ollama on a Raspberry Pi". |
| `docs/superpowers/plans/2026-08-23-finish-ai-project-reviewer.md`, `docs/2026-08-28-current-state-review.md` | Leave as historical records. Add one line to the plan pointing at this spec. |

### 4. Smoke test

`scripts/docker-smoke-test.sh`: reword the "target Pi" comment and the "LAN-open" echo, and add an assertion that the published API port is bound to loopback only.

## Verification

The Compose stack is not trusted until `scripts/docker-smoke-test.sh` passes on a real machine. The developer's Windows machine is now a valid place to run it. That run closes M5, and it must also confirm that the API container reaches host-run Ollama. Until it passes, the README keeps stating that the packaging is implemented and unit-tested but not live-validated.

Existing gates must stay green: `npm run lint`, `npm run typecheck`, `npm test` in `api/`, and `npm run lint`, `npm test`, `npm run build` in `frontend/`.

## Non-goals

Cloud LLM providers, multi-user accounts, GitHub webhooks (poll instead), any hosted or multi-device deployment, and a SQLite or db-adapter port. A Pi or home-server deployment is not forbidden; it is simply no longer designed for or tested against.

## Out of scope

No changes to the review pipeline, schema, worker, auth implementation, or frontend UI.
