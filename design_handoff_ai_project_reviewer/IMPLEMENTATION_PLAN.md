# Implementation Plan: AI Project Reviewer

Self-hosted on the user's Raspberry Pi (LAN): MariaDB for persistence, Ollama for review generation, no cloud dependencies. Read `README.md` first for the full UI spec.

## Recommended stack
- **Frontend**: React + Vite + TypeScript. Plain CSS with the Nocturne tokens (`styles.css`) — no Tailwind needed; the token sheet is the design system.
- **API**: Node (Fastify or Express) on the Pi — a thin REST façade over MariaDB via `mysql2/promise`. Browsers cannot speak the MariaDB wire protocol, so this layer is mandatory.
- **Review engine**: a worker in the same Node service that clones/pulls repos, runs static checks, and calls Ollama (`llama3.1`) for the narrative parts.
- **Deploy**: docker-compose on the Pi — `api`, `mariadb`, `ollama` (or Ollama native), frontend served as static files by the API.

## Data model (MariaDB)
```sql
repos      (id PK, name, url, visibility, language, framework, connected_at)
reviews    (id PK, repo_id FK, overall_score TINYINT, grade VARCHAR(16),
            ai_summary TEXT, generated_at DATETIME)
review_categories (review_id FK, category VARCHAR(32), score TINYINT)   -- 6 rows/review
review_items      (review_id FK, kind ENUM('strength','improvement','next_step'),
                   position TINYINT, body TEXT)
portfolio_checks  (review_id FK, label VARCHAR(64), done BOOL)
quality_metrics   (review_id FK, label VARCHAR(32), value VARCHAR(16))
findings          (review_id FK, tab ENUM('quality','security'),
                   severity ENUM('high','med','warn','info','ok'), title VARCHAR(128), detail TEXT)
dependencies      (review_id FK, package VARCHAR(64), installed VARCHAR(24),
                   latest VARCHAR(24), status ENUM('ok','outdated','major'))
repo_stats        (review_id FK, loc INT, open_issues INT, prs INT, contributors INT,
                   commits_14d INT, structure TEXT)                     -- structure = rendered tree
```
The prototype's `APR_SAMPLE` in `reviewer-data.js` is the canonical joined shape the frontend expects — one JSON object per repo with its latest review.

## API surface
```
GET  /api/health                    → 200 (used by the frontend status chip)
GET  /api/repos                     → repo list joined with latest review (APR_SAMPLE shape)
GET  /api/repos/:id                 → one repo, same shape
POST /api/repos                     → connect a repo {url}
POST /api/repos/:id/rerun           → enqueue review; 202 + job id
GET  /api/jobs/:id                  → {status, review?} for polling the re-run spinner
```
CORS: allow the frontend origin; everything stays on the LAN.

## Review pipeline (worker)
1. `git clone --depth 50` (or pull) into a work dir.
2. **Deterministic checks** (no LLM): detect framework/type; presence of Dockerfile, README, CI workflows, tests, LICENSE, .env.example; LOC; commit activity (14d); dependency freshness (parse lockfiles, query registry); lint via ruff/eslint; secret scan (gitleaks).
3. **Scoring**: category scores 0–100 from weighted deterministic signals (keep the rubric in one module so it's tunable). Overall = weighted mean. Grade: ≥80 Excellent, ≥65 Good, ≥50 Fair, else Needs work — must match the frontend's `scoreVar()` thresholds (≥65 green, 40–64 amber, <40 red).
4. **LLM narrative**: send the deterministic findings to Ollama (`POST /api/generate`, `stream:false`) with a JSON-output prompt to produce strengths, improvements, next steps, portfolio blurb, and the 2-sentence AI summary. Validate/clamp the JSON; on parse failure retry once, then fall back to templated text from the deterministic findings.
5. Persist; the frontend polls the job endpoint.

## Frontend build order
1. **Shell**: sidebar + top bar + routes (`/`, `/reviews/:repoId?tab=`, `/insights`, stubs). Port the layout CSS from the prototype HTML `<style>` block nearly verbatim; link `styles.css`.
2. **Theme**: `data-theme` on `<html>` + localStorage; copy the light-theme override block.
3. **Review screen**: rail → header/ring → summary → tabs → insights column (component-per-tab, as in `reviewer-review.jsx`).
4. **Dashboard & Insights**: pure derivations over `repos[]` — port the aggregation logic from `reviewer-screens.jsx` as-is.
5. **Data layer**: replace `APR.load/ping/rerun` with real fetches + health checks; keep the sample-data fallback for dev mode.
6. **Settings screen** (new): endpoint URLs + model picker, persisted server-side; replaces `APR_CONFIG` constants.

## Milestones
1. **M1 — static UI** with sample data (everything in the prototype, ported).
2. **M2 — API + DB**: repos CRUD, reviews read path, health chips live.
3. **M3 — review pipeline**: deterministic checks + scoring, re-run flow end to end.
4. **M4 — LLM narrative** via Ollama with fallback text.
5. **M5 — polish**: Settings screen, Repositories screen, auth (single-user token is enough on a LAN), docker-compose.

## Non-goals (for now)
- Cloud LLM providers, multi-user accounts, GitHub webhooks (poll instead), public exposure of the Pi.
