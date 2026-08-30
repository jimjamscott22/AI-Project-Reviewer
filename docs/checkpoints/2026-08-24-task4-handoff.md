# Task 4 checkpoint handoff

Date: 2026-08-24

Base commit: `4fbc398` (`feat: add durable deterministic repository reviews`)

## Completed

- Ollama base URL and model settings moved behind Fastify and persisted in `app_settings` through `GET /api/settings` and `PUT /api/settings`.
- Ollama endpoints are restricted to credential-free local/LAN targets: loopback, private/link-local IPs, `.local`, or single-label LAN/container hostnames. An empty base URL disables Ollama.
- The worker now sends only bounded deterministic metadata and redacted finding titles to Ollama. Repository structure/source and security-detail values are excluded from prompts.
- Narrative requests have timeout, prompt-size, and response-size limits.
- Ollama must return JSON containing `aiSummary`, `strengths`, `improvements`, `nextSteps`, `portfolioBlurb`, and `portfolioFooter`.
- Narrative fields are type-checked, count/length-clamped, de-duplicated, and stripped of HTML-like/control content.
- Malformed narrative JSON is retried once with a correction prompt. Timeouts, HTTP failures, two invalid responses, oversized output, or disabled Ollama use the complete deterministic template.
- The selected narrative is transactionally persisted with the deterministic scores, findings, dependencies, structure, and statistics.
- `/api/health` exposes database, worker, Ollama enabled/reachable, and model state without exposing the configured base URL.
- Browser code no longer contains an Ollama port, `VITE_LLM_*` setting, or direct `/api/generate` call. Reruns are queued through Fastify.

## Verification evidence

- API lint, source/test typecheck, unit tests, and production build pass.
- API unit/safety suite: 35 of 35 tests pass, covering valid output, timeout, HTTP failure, malformed retry, two-response fallback, output cap, unsafe HTML-like text, disabled mode, prompt redaction, and settings validation.
- Frontend lint, component tests, and production build pass; the frontend suite contains 11 tests across 5 files.
- Existing Task 2 MariaDB compatibility and Task 3 controlled-public-repository worker integrations pass.
- Task 4 live integration uses a bounded local Ollama stub plus MariaDB and proves:
  - settings save/read and health capability reporting;
  - valid local-model narrative persistence;
  - a second successful persisted deterministic review after Ollama is disabled;
  - exactly one model generation call across those two jobs;
  - no secret-shaped content in the model prompt.
- `git diff --check` is expected to show only the repository's existing LF-to-CRLF notices.

The disposable `apr-task4-mariadb` container was removed after the final verification pass. The ignored `api/.review-work/` public repository cache remains intentionally reusable.

## Resume point

Continue with Task 5 in `docs/superpowers/plans/2026-08-23-finish-ai-project-reviewer.md` only after review:

1. Replace the Repositories stub with connection and persisted job-management UI.
2. Poll queued/running jobs and refresh/navigate after success without leaking timers.
3. Replace Settings with the API-owned Ollama configuration and capability state.
4. Make embedded samples opt-in demo mode rather than an automatic production fallback.

Authentication, Compose/Pi packaging, and final end-to-end truth checks remain later approved-plan checkpoints.
