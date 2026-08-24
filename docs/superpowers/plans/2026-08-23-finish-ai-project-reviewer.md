# AI Project Reviewer Completion Implementation Plan

> **For implementation:** Execute this plan inline and sequentially in the current workspace. Do not use worktrees, subagents, test-first loops, commits, or pushes unless the user separately requests them. Implement each task before adding its regression tests, then stop for review at the checkpoint.

**Goal:** Complete the documented M3-M5 roadmap so a user can connect a public GitHub repository, run a persisted deterministic and Ollama-assisted review, inspect the result in a responsive UI, configure the local reviewer, and deploy the application on a Raspberry Pi.

**Architecture:** Keep Fastify as the only privileged service boundary: it owns repository cloning, analysis, Ollama calls, MariaDB persistence, job state, and optional authentication. A single sequential in-process worker consumes durable MariaDB jobs, so the first Pi release needs no second queue service. React polls the job API and refreshes the latest persisted review; it never calls Ollama or executes repository code directly.

**Tech Stack:** React 19, Vite 8, TypeScript, Fastify 5, MariaDB, mysql2, Node child processes, Ollama, Docker Compose.

**Spec:** `README.md` and `design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md`

## Global Constraints

- Work sequentially in `D:\Code\Web Dev\AI-Project-Reviewer`; do not create a worktree or dispatch subagents.
- Implement directly, then add regression tests; do not use a test-driven loop.
- Do not commit or push unless the user explicitly asks.
- Preserve the current M1/M2 routes and joined `Repo` response shape for reviewed repositories.
- Support public GitHub HTTPS repository URLs in this release; private-repository credentials and GitHub OAuth remain out of scope.
- Never run package scripts, repository configuration, or arbitrary code from a reviewed repository.
- Bound every clone, filesystem scan, registry lookup, secret scan, and Ollama call with timeouts and output/size limits.
- Keep all LLM traffic local through Ollama; deterministic results must still produce a complete persisted review when Ollama is unavailable or returns invalid JSON.
- Serve the production frontend and API from one origin; keep the development two-origin setup working.
- Treat 390 px as the minimum supported viewport with no page-level horizontal overflow.

---

## Current-State Evidence

- `main` is clean at `191652b`; M1 and M2 are the only completed roadmap milestones.
- Frontend `npm run lint` and `npm run build` pass.
- API `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- Both npm workspaces audit with zero known vulnerabilities at install time.
- Desktop Browser smoke checks pass with no console warnings/errors; Dashboard, Reviews, tab routing, repository search, theme, and the current fallback rerun interaction render.
- At 390 x 844 the document is 682 px wide. The desktop sidebar stays fixed and the main content is squeezed behind horizontal scrolling, contradicting the README's responsive claim.
- Repositories and Settings are placeholder routes. Connect GitHub, Add Repo, View all repositories, View full insights, and repository URL controls are inert.
- The browser currently calls Ollama directly and only replaces the visible summary; it does not create a review or persist anything.
- With MariaDB unavailable, `/api/health` correctly returns 503 but `/api/repos` leaks a generic raw database-driven 500 response.
- There is no automated test suite, job model, review writer, repository analyzer, authentication layer, container packaging, or Pi runbook.

## File and Interface Map

### API files to modify

- `api/package.json` - add test/static-serving/cookie dependencies and scripts.
- `api/.env.example` - add `REPO_WORK_ROOT`, clone/analyzer/Ollama limits, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `AUTH_TOKEN`, and production static-root settings.
- `api/src/config.ts` - parse and validate the new settings once at startup.
- `api/src/index.ts` - register auth, settings, jobs, static frontend, error handling, and worker lifecycle.
- `api/src/types.ts` - add management, settings, job, analyzer, and narrative contracts while preserving `Repo`.
- `api/src/db/schema.sql` - add durable review jobs and app settings; extend dependency status with `unknown` through an idempotent migration step.
- `api/src/db/migrate.ts` - apply the existing base schema plus ordered versioned migrations safely.
- `api/src/db/repos.ts` - list connected repositories even when they have no review, validate duplicates by canonical URL, and retain reviewed-repo assembly.
- `api/src/routes/health.ts` - return explicit database/Ollama/worker/auth capability state without exposing secrets.
- `api/src/routes/repos.ts` - validate canonical public GitHub URLs, expose management listing, and enqueue reruns.

### API files to create

- `api/src/db/migrations/002-review-pipeline.sql` - `review_jobs`, `app_settings`, indexes, and dependency-status migration.
- `api/src/db/jobs.ts` - create, claim, update, recover, and read jobs.
- `api/src/db/reviews.ts` - transactionally persist a complete review and all child rows.
- `api/src/routes/jobs.ts` - `GET /api/jobs/:id` polling endpoint.
- `api/src/routes/settings.ts` - read/update the non-secret Ollama settings.
- `api/src/routes/session.ts` - optional token login/logout and session check.
- `api/src/auth.ts` - constant-time token comparison, opaque HttpOnly session cookie, and protected-route hook.
- `api/src/review/contracts.ts` - internal normalized analysis and narrative types.
- `api/src/review/workspace.ts` - bounded clone/pull and cleanup using an argument-array subprocess wrapper.
- `api/src/review/analyze.ts` - safe filesystem inventory, language/framework detection, document/CI/test/Docker/license checks, LOC, structure, and commit activity.
- `api/src/review/dependencies.ts` - parse npm/Python manifests and lockfiles; perform bounded npm/PyPI freshness lookups with `unknown` offline state.
- `api/src/review/security.ts` - safe built-in secret/file-risk checks and optional redacted gitleaks integration without executing repository code.
- `api/src/review/scoring.ts` - the single deterministic weighted rubric, grade, findings, checklist, and fallback narrative inputs.
- `api/src/review/narrative.ts` - Ollama JSON request, strict validation/clamping, one retry, and deterministic template fallback.
- `api/src/review/worker.ts` - sequential durable job runner and startup recovery.
- `api/src/server.ts` - build and return Fastify without listening so route tests can use `app.inject()`.

### Frontend files to modify

- `frontend/package.json` - add post-implementation component/unit test tooling and scripts.
- `frontend/src/App.tsx` - own load/error/auth state, job polling, refresh reviews after success, and render safe empty states.
- `frontend/src/data/api.ts` - use the Fastify job/settings/session endpoints with credentials and remove direct browser-to-Ollama generation.
- `frontend/src/data/types.ts` - add `RepositorySummary`, `ReviewJob`, `ReviewerSettings`, and `HealthStatus`.
- `frontend/src/screens/ReviewRoute.tsx` and `ReviewScreen.tsx` - validate repository/tab routes, link the real repository URL, show job progress/failure, and avoid empty-list crashes.
- `frontend/src/components/Sidebar.tsx`, `RepoRail.tsx`, `InsightCol.tsx`, and `TopBar.tsx` - wire every visible control and expose compact responsive states.
- `frontend/src/styles/app.css` - add tablet/mobile layout rules and focused overflow containment.
- `frontend/src/vite-env.d.ts` and `frontend/.env.development` - remove browser Ollama settings and support same-origin production API fallback.

### Frontend files to create

- `frontend/src/screens/RepositoriesScreen.tsx` - list all connected repos, distinguish pending/running/reviewed/failed, and connect a public GitHub URL.
- `frontend/src/screens/SettingsScreen.tsx` - Ollama endpoint/model, health check, optional login, and explanatory limits.
- `frontend/src/components/EmptyState.tsx` - shared no-data/error state with a real navigation action.
- `frontend/src/components/JobStatus.tsx` - accessible queued/running/failed progress display.

### Deployment and documentation files to create/modify

- `Dockerfile` - multi-stage frontend/API build and ARM64-compatible runtime with Git and optional pinned gitleaks.
- `docker-compose.yml` - API, MariaDB, and optional Ollama profile with health checks and persistent volumes.
- `.dockerignore` - exclude local dependencies, builds, Git data, caches, and secrets.
- `.env.example` - compose-safe non-secret defaults and required-token guidance.
- `README.md`, `api/README.md`, and `frontend/README.md` - replace milestone disclaimers with truthful setup, security model, limitations, and verification commands.

## Public Contracts

```ts
export type ReviewJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface RepositorySummary {
  id: string;
  name: string;
  url: string;
  connectedAt: string;
  latestReviewId: number | null;
  latestScore: number | null;
  latestReviewAt: string | null;
  latestJob: { id: string; status: ReviewJobStatus; error: string | null } | null;
}

export interface ReviewJob {
  id: string;
  repoId: string;
  status: ReviewJobStatus;
  stage: 'queued' | 'cloning' | 'analyzing' | 'narrating' | 'persisting' | 'complete';
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  reviewId: number | null;
  error: { code: string; message: string } | null;
}

export interface ReviewerSettings {
  ollamaBaseUrl: string;
  ollamaModel: string;
}
```

```text
GET    /api/health                 -> 200 or 503 HealthStatus
POST   /api/session                -> 204 + HttpOnly cookie when AUTH_TOKEN is enabled
GET    /api/session                -> { authRequired, authenticated }
DELETE /api/session                -> 204 and clear the local session
GET    /api/repositories           -> RepositorySummary[] including unreviewed repos
POST   /api/repos                  -> 201 RepositorySummary
GET    /api/repos                  -> Repo[] containing reviewed repos only (existing contract)
GET    /api/repos/:id              -> Repo (existing contract)
POST   /api/repos/:id/rerun        -> 202 { jobId, status: 'queued' }
GET    /api/jobs/:id               -> ReviewJob
GET    /api/settings               -> ReviewerSettings
PUT    /api/settings               -> ReviewerSettings
```

## Task 1: Repair the M1/M2 foundation

**Files:** frontend shell/components/styles listed above; `api/src/server.ts`, `api/src/index.ts`, and route files.

**Interfaces:** Preserve existing reviewed `Repo` reads. Add a central API error envelope `{ error: string, message: string }` and a server factory `buildServer(options?): Promise<FastifyInstance>`.

- [ ] Extract Fastify construction into `buildServer()` and install a production-safe error handler that logs the underlying error but returns stable 503 `database_unavailable` responses for DB outages.
- [ ] Add explicit loading, API-unavailable fallback, no-reviewed-repositories, invalid-repository, and invalid-tab states so no route dereferences an undefined repo.
- [ ] Wire existing repository links to their real HTTPS URLs and wire placeholder navigation controls to `/repos` or `/insights`.
- [ ] Add mobile rules: fixed five-item bottom navigation below 700 px, no fake identity/pro-tip rail on mobile, wrapping/condensed top bar, single-column review layout, horizontally scrollable repo/tab strips, stacked AI/Insights grids, and locally scrollable tables.
- [ ] Add regression tests after implementation for error mapping, empty reviewed lists, invalid tab normalization, and navigation targets.
- [ ] Verify `document.documentElement.scrollWidth === document.documentElement.clientWidth` at 390 x 844 on Dashboard, Repositories, Review, Insights, and Settings.

**Checkpoint acceptance:** Existing desktop screens still match the handoff closely; all visible controls navigate or perform an action; 390 px pages have no document-level horizontal overflow; frontend/API lint, typecheck, tests, and builds pass.

## Task 2: Add durable repository and job persistence

**Files:** schema/migration, `db/jobs.ts`, `db/reviews.ts`, `db/repos.ts`, `routes/repos.ts`, `routes/jobs.ts`, and shared types.

**Interfaces:** Implement `createJob(repoId): Promise<ReviewJob>`, `claimNextJob(): Promise<ClaimedJob | null>`, `updateJobStage(id, stage)`, `completeJob(id, reviewId)`, `failJob(id, error)`, and `persistReview(repoId, result): Promise<number>`.

- [ ] Add ordered migration tracking and the review-job/settings schema without deleting or reseeding existing reviews.
- [ ] Canonicalize and validate only `https://github.com/<owner>/<repo>[.git]`; reject credentials, query strings, fragments, non-HTTPS schemes, empty slugs, and duplicate canonical URLs with specific 400/409 errors.
- [ ] Return all registered repositories from `/api/repositories`, including those awaiting a first review.
- [ ] Enqueue exactly one active job per repository and return the existing queued/running job on duplicate rerun requests.
- [ ] Persist review parents and every child table in one MariaDB transaction; roll back completely on any failure.
- [ ] On service startup, requeue jobs left `running` by a crash and preserve their audit timestamps.
- [ ] Add post-implementation unit/route tests plus MariaDB integration tests for migration idempotence, duplicate jobs, restart recovery, transaction rollback, and latest-review reads.

**Checkpoint acceptance:** A connected repo is visible before review; rerun returns 202; polling survives API restart; failed persistence leaves no partial review; old seeded reviews remain readable.

## Task 3: Implement the safe deterministic review engine

**Files:** `api/src/review/workspace.ts`, `analyze.ts`, `dependencies.ts`, `security.ts`, `scoring.ts`, `worker.ts`, contracts, config, and fixtures.

**Interfaces:** `analyzeRepository(root, context): Promise<DeterministicAnalysis>`, `scoreAnalysis(analysis): ScoredReview`, and `startWorker(app): { wake(): void; stop(): Promise<void> }`.

- [ ] Clone with argument arrays, `--depth 50`, no submodules, no hooks, a configured timeout, an output cap, and a validated child path under `REPO_WORK_ROOT`; update an existing cache with a bounded fetch/reset.
- [ ] Refuse symlink escapes, skip `.git`, dependencies, build outputs, binaries, and files above the configured limit; cap total files/bytes before analysis.
- [ ] Detect language/framework, Docker/README/CI/tests/LICENSE/environment examples, LOC, file tree, Git activity, and basic quality signals without loading repo config or running repo commands.
- [ ] Parse npm and Python dependency inputs; classify semantic-version deltas and return `unknown` when the registry is unreachable instead of claiming packages are current.
- [ ] Scan risky committed filenames and high-confidence secret patterns with redaction; optionally merge redacted gitleaks JSON when the pinned binary exists.
- [ ] Calculate all six category scores and overall score from one documented weighted rubric; derive summary cards, deterministic findings, readiness checks, improvements, and next steps.
- [ ] Run one job at a time, update stages, clean temporary data, persist success, and store bounded user-safe failure details.
- [ ] Add tests after implementation using small fixture repositories for Node, Python, sparse/empty, oversized, symlink, offline-registry, timeout, secret-redaction, and score-boundary cases.

**Checkpoint acceptance:** A public fixture repository produces a complete repeatable persisted review without executing its code; scores stay 0-100; secrets never appear in API/log output; offline services degrade to explicit findings rather than failing the job.

## Task 4: Integrate Ollama inside the review pipeline

**Files:** `review/narrative.ts`, settings DB/route, worker, health, config, and API tests.

**Interfaces:** `generateNarrative(scored, settings): Promise<{ narrative: ValidatedNarrative; source: 'ollama' | 'template' }>`.

- [ ] Move Ollama base/model configuration to the API and remove browser-to-Ollama calls.
- [ ] Send only bounded deterministic metadata/findings, never repository source or detected secret values.
- [ ] Require a JSON object with `aiSummary`, `strengths`, `improvements`, `nextSteps`, `portfolioBlurb`, and `portfolioFooter`; validate types/counts/lengths and clamp all output.
- [ ] Retry malformed JSON once with a correction prompt, then use deterministic template text.
- [ ] Expose Ollama reachability and configured model through health/settings without exposing credentials.
- [ ] Add tests after implementation for success, timeout, HTTP failure, malformed JSON, oversized output, unsafe HTML-like text, retry, and fallback.

**Checkpoint acceptance:** Successful Ollama output is persisted with the review; disabling Ollama still yields a complete review; the UI never contacts port 11434 directly.

## Task 5: Complete Repositories, Settings, and persisted reruns

**Files:** new frontend screens/components plus `App.tsx`, `data/api.ts`, types, existing controls, and CSS.

**Interfaces:** Add `listRepositories()`, `connectRepository(url)`, `enqueueReview(id)`, `getReviewJob(id)`, `loadSettings()`, and `saveSettings(settings)`; all fetches use `credentials: 'include'`.

- [ ] Replace the Repositories stub with management cards/table, connect form, inline URL validation, empty state, job status, last score/date, Review, and Re-run actions.
- [ ] Make Connect GitHub, Add Repo, and View all repositories land on the same form/screen rather than launching OAuth.
- [ ] Poll queued/running jobs with capped exponential intervals, stop on success/failure/unmount, refresh both repository and reviewed-repo data on success, and navigate first-review successes to their new Review route.
- [ ] Replace the direct-summary simulation with persisted job progress and a clear failed-job retry state.
- [ ] Replace Settings stub with Ollama URL/model configuration, current health, save feedback, and documented public-GitHub/no-code-execution boundaries.
- [ ] Keep sample fallback only as an explicit demo mode (`VITE_DEMO_MODE=true`); an unreachable production API must show an error, not silently display fake portfolio data.
- [ ] Add post-implementation component tests for connect validation, pending/failed/succeeded jobs, polling cleanup, settings save, demo mode, empty data, and 401 login prompts.

**Checkpoint acceptance:** A new repo appears immediately, moves through visible job states, becomes a real persisted review, and remains after reload; no production state is mislabeled sample data.

## Task 6: Add optional single-user protection and Pi packaging

**Files:** auth/session API, frontend login surface, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, root `.env.example`, server static hosting, and docs.

**Interfaces:** If `AUTH_TOKEN` is empty, preserve LAN-open behavior. If set, protect all mutation/data/settings routes with an opaque HttpOnly SameSite session cookie; leave health and session login reachable.

- [ ] Compare the submitted token in constant time, issue an in-memory expiring opaque session, clear it on logout, and rate-limit failed login attempts.
- [ ] Configure credentialed exact-origin CORS for development and same-origin requests in production.
- [ ] Build frontend and API in multi-stage Docker layers; run as a non-root user with only the repository-work volume writable.
- [ ] Add MariaDB and API health checks, named database/Ollama/repository volumes, restart policy, resource-conscious defaults, and an optional bundled-Ollama Compose profile.
- [ ] Ensure production Fastify serves the Vite assets and SPA fallback without shadowing `/api/*`.
- [ ] Document Pi ARM64 prerequisites, first boot, model pull, token setup, backups, upgrades, logs, health checks, and rollback.
- [ ] Add image/container smoke checks for non-root execution, health ordering, persistence across restart, auth enabled/disabled, and frontend deep links.

**Checkpoint acceptance:** `docker compose up --build` starts a usable single-origin app; MariaDB data and reviewed repo cache survive restart; optional auth blocks unauthenticated API access; the documented Pi steps have no unstated cloud service.

## Task 7: Final end-to-end verification and truth pass

**Files:** tests, docs, and only defects found during this verification.

- [ ] Run frontend lint, component tests, production build, and Browser smoke tests at desktop, 768 px tablet, and 390 px mobile.
- [ ] Run API lint, typecheck, unit tests, build, route injection tests, MariaDB integration tests, and worker fixture tests.
- [ ] Run Compose end to end: login if enabled, connect a controlled public fixture repo, observe every job stage, verify persisted review after restart, change Ollama settings, and verify deterministic fallback with Ollama stopped.
- [ ] Confirm no secrets/source content appear in logs or API errors; confirm repo code/package scripts never execute.
- [ ] Compare README claims, endpoints, environment variables, commands, screenshots, placeholder references, and roadmap checkboxes against observed behavior.
- [ ] Run `git diff --check` and `git status --short`; report tracked changes, generated ignored artifacts, targeted evidence, and any environmental check that remains manual.

**Final acceptance:** All roadmap boxes are supported by passing evidence; every visible UI action is functional; production uses real persisted data; failure states are explicit; desktop/mobile have no relevant console errors or page-level overflow; documentation matches the verified product.

## Verification Commands

```powershell
Set-Location 'D:\Code\Web Dev\AI-Project-Reviewer\frontend'
npm ci --cache .npm-cache
npm run lint
npm test
npm run build

Set-Location 'D:\Code\Web Dev\AI-Project-Reviewer\api'
npm ci --cache .npm-cache
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build

Set-Location 'D:\Code\Web Dev\AI-Project-Reviewer'
docker compose config
docker compose up --build -d
docker compose ps
git diff --check
git status --short
```

Remove only the two verified workspace-local `.npm-cache` directories after the run. Do not remove `node_modules`, database volumes, or repository work volumes during normal verification.

## Approval Decisions Embedded in This Plan

1. “Finish” means M3, M4, and M5, plus repairing false responsive/fallback claims before extending the product.
2. Repository connection means public GitHub HTTPS URL entry, not GitHub OAuth or private-repository credential storage.
3. The API owns Ollama and review generation; the browser never calls Ollama directly.
4. The first deployment uses a durable MariaDB queue with one in-process worker, not Redis or a separate worker service.
5. Demo sample fallback becomes opt-in; production API failure is shown honestly.
6. Authentication is optional and token-based so the LAN-open development experience remains available.

