# AI Project Reviewer — API

Thin REST façade over MariaDB, per `../design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md`.
Node + TypeScript + Fastify + `mysql2/promise`. Browsers can't speak the
MariaDB wire protocol directly, so this layer is what the frontend actually
talks to.

## Status: M2 — API + DB

- MariaDB schema (`src/db/schema.sql`) implementing the plan's data model,
  extended with two tables the plan sketch didn't spell out
  (`review_summary_items` for the "Project Summary" cards, and
  `portfolio_readiness` for the verdict/blurb/footer) — see the comments at
  the top of that file.
- `GET /api/health` — DB connectivity check.
- `GET /api/repos`, `GET /api/repos/:id` — the reviews read path: repos
  joined with their latest review, reassembled from the normalized child
  tables into the exact JSON shape `frontend/src/data/sampleData.ts` already
  produces (verified by round-tripping the same five sample repos through
  the DB — see `src/db/seedData.ts`).
- `POST /api/repos` — connect a repo (`{ url, name?, visibility?, language?,
  framework? }`). Repos with no review yet are left out of `GET /api/repos`
  — there's nothing to render for them until the review pipeline (M3) runs.

Not in this milestone: `POST /api/repos/:id/rerun` and `GET /api/jobs/:id`
(the review pipeline and re-run flow are M3), the LLM narrative step (M4),
and docker-compose packaging (M5).

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
```

## Structure

- `src/db/schema.sql` — DDL, applied by `src/db/migrate.ts`.
- `src/db/repos.ts` — the query layer: joins each repo to its latest review
  and reassembles the child tables into the frontend's `Repo` shape.
- `src/db/seedData.ts` / `src/db/seed.ts` — the ported sample data and the
  script that loads it.
- `src/routes/` — Fastify route modules (`health.ts`, `repos.ts`).
- `src/lib/` — small helpers: relative-time formatting, grade thresholds
  (kept in sync with the frontend's `scoreVar()` — ≥65 green, 40–64 amber,
  <40 red), slugify.
- `src/types.ts` — mirrors `frontend/src/data/types.ts`; this is the JSON
  shape the routes return.
