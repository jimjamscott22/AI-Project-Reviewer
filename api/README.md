# AI Project Reviewer — API

Thin REST façade over MariaDB, per `../design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md`.
Node + TypeScript + Fastify + `mysql2/promise`. Browsers can't speak the
MariaDB wire protocol directly, so this layer is what the frontend actually
talks to.

## Status: M4 persisted local narrative pipeline

- MariaDB schema (`src/db/schema.sql`) implementing the plan's data model,
  extended with two tables the plan sketch didn't spell out
  (`review_summary_items` for the "Project Summary" cards, and
  `portfolio_readiness` for the verdict/blurb/footer) — see the comments at
  the top of that file.
- `GET /api/health` — DB, worker, and non-secret Ollama capability state.
- `GET /api/settings`, `PUT /api/settings` — validated server-side Ollama base
  URL/model settings. An empty base URL disables Ollama calls.
- `GET /api/repos`, `GET /api/repos/:id` — the reviews read path: repos
  joined with their latest review, reassembled from the normalized child
  tables into the exact JSON shape `frontend/src/data/sampleData.ts` already
  produces (verified by round-tripping the same five sample repos through
  the DB — see `src/db/seedData.ts`).
- `POST /api/repos` — connect a public GitHub repository. URLs are canonicalized;
  private repositories and credential-bearing/non-GitHub URLs are rejected.
- `GET /api/repositories` — management listing including unreviewed repositories
  and their latest durable job state.
- `POST /api/repos/:id/rerun`, `GET /api/jobs/:id` — create/reuse and poll a
  durable MariaDB review job. One queued/running job is allowed per repository,
  and interrupted running jobs are requeued on API startup.
- Repos with no review yet are still left out of `GET /api/repos` — there is
  nothing for the review UI to render until the worker persists the first review.
- A single in-process worker clones or refreshes validated public GitHub caches,
  inventories bounded text files, skips symlinks/binaries/generated content,
  checks npm/Python dependency freshness and redacted credential risks, applies
  the documented weighted rubric, and transactionally persists the full review.
- Registry outages produce `unknown` dependency state. Clone, filesystem,
  registry, optional gitleaks, and Git metadata work all have configured bounds.
  Repository package scripts and configuration are never executed.
- The worker sends only bounded deterministic metadata/findings to Ollama,
  requires a clamped JSON narrative, retries malformed JSON once, and persists
  the deterministic template when Ollama is disabled, unreachable, slow, or invalid.

Not implemented yet: repository/settings job UI, frontend polling,
and docker-compose packaging/authentication.

## Develop

Requires a MariaDB server reachable with the credentials in `.env` (copy
`.env.example`). Locally:

```bash
npm install
cp .env.example .env      # adjust DB_* for your MariaDB
npm run migrate           # creates the database + tables (idempotent)
npm run seed               # loads the 5 sample repos (safe to re-run)
npm run dev                 # http://localhost:8080, restarts on change
```

Then point the frontend at it — `frontend/.env.development` already sets
`VITE_API_BASE=http://localhost:8080` for `npm run dev` in `frontend/`.

```bash
npm run build && npm start  # compiled, for parity with the Pi deployment
npm run lint
npm run typecheck
npm test
```

## Structure

- `src/db/schema.sql` — DDL, applied by `src/db/migrate.ts`.
- `src/db/repos.ts` — the query layer: joins each repo to its latest review
  and reassembles the child tables into the frontend's `Repo` shape.
- `src/db/seedData.ts` / `src/db/seed.ts` — the ported sample data and the
  script that loads it.
- `src/routes/` — Fastify route modules (`health.ts`, `repos.ts`).
- `src/review/workspace.ts` — bounded argument-array Git clone/cache handling.
- `src/review/analyze.ts`, `dependencies.ts`, `security.ts` — read-only static
  evidence gathering with filesystem, network, output, and redaction limits.
- `src/review/scoring.ts` — the single deterministic weighted rubric.
- `src/review/narrative.ts` — bounded Ollama JSON generation, validation,
  malformed-output retry, health probe, and deterministic fallback.
- `src/review/worker.ts` — sequential durable-job execution and persistence.
- `src/lib/` — small helpers: relative-time formatting, grade thresholds
  (kept in sync with the frontend's `scoreVar()` — ≥65 green, 40–64 amber,
  <40 red), slugify.
- `src/types.ts` — mirrors `frontend/src/data/types.ts`; this is the JSON
  shape the routes return.
