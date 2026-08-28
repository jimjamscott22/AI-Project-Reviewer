# AI Project Reviewer Current-State Review

**Review date:** 2026-08-28
**Repository:** `AI-Project-Reviewer`
**Reviewed branch:** `main`
**Reviewed commit:** `4fbc39880c6889af83adf28570a5a339e0f9ed2d`

## Executive Summary

The application should not be rewritten from scratch. The current `main` branch already contains a substantial M3 implementation covering the responsive frontend foundation, durable repository-review jobs, MariaDB persistence, and a bounded deterministic repository-analysis worker.

The latest commit changed 71 files with 4,352 insertions and 171 deletions. Approximately 1,614 of those additions are API source code and 436 are frontend source and test code. Replacing this work without first comparing the other device's changes would create significant avoidable rework and could remove safety boundaries, persistence behavior, and regression coverage.

The safest next action is to preserve the other device's work as a commit, backup branch, or patch and compare it against commit `4fbc398` before editing either version.

## Repository and Git State

At the time of review:

- The working tree and index were clean.
- `main` was at `4fbc398` with no local commits ahead of or behind its tracked `origin/main` reference.
- A direct remote-reference check confirmed that GitHub's `main` also pointed to `4fbc398`.
- GitHub exposed no additional remote branches containing the conflicting work.
- The local reflog showed that this checkout was cloned on 2026-08-28.
- The immediately preceding commit was `191652b`, an August 21 README refactor.

This means the work from the other device is not represented in the currently visible GitHub branches and should be backed up before attempting reconciliation.

## Latest Implemented Scope

The latest commit is:

```text
4fbc398 feat: add durable deterministic repository reviews
```

The most reliable completion record is the [Task 3 checkpoint handoff](checkpoints/2026-08-24-task3-handoff.md). It records Tasks 1 through 3 as complete.

### Task 1: Frontend Foundation Repairs

The frontend now includes:

- A responsive application shell with desktop and mobile navigation behavior.
- Working navigation for existing repository and insight controls.
- Explicit loading, API-unavailable demo, empty-data, invalid-repository, and invalid-tab behavior.
- Dark and light themes with saved theme preference.
- Review, dashboard, and insights routes backed by shared review data.
- Frontend regression tests for application states, navigation, dependency display, and review routing.

Notable implementation files include:

- `frontend/src/App.tsx`
- `frontend/src/components/EmptyState.tsx`
- `frontend/src/screens/ReviewRoute.tsx`
- `frontend/src/App.test.tsx`
- `frontend/src/components/navigation.test.tsx`
- `frontend/src/screens/ReviewRoute.test.tsx`

### Task 2: Durable Repository and Job Persistence

The API now supports:

- Ordered MariaDB migrations.
- Canonical validation of public GitHub HTTPS repository URLs.
- Repository registration that rejects private repositories, embedded credentials, query strings, and unsupported hosts.
- Durable review jobs with queued, running, succeeded, and failed state.
- Deduplication so a repository has at most one active review job.
- Recovery of jobs left running when the API process previously stopped.
- Transactional persistence of a complete review and its related category, dependency, finding, checklist, and recommendation rows.
- Safe database-unavailable API responses instead of exposing raw database errors.

Implemented management and polling endpoints include:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/repositories` | List all registered repositories, including repositories without reviews |
| `GET` | `/api/repos` | List repositories with their latest completed reviews |
| `GET` | `/api/repos/:id` | Retrieve one repository and its latest review |
| `POST` | `/api/repos` | Register a supported public GitHub repository |
| `POST` | `/api/repos/:id/rerun` | Create or reuse an active durable review job |
| `GET` | `/api/jobs/:id` | Retrieve review-job progress and outcome |

Notable implementation files include:

- `api/src/db/migrations/002-review-pipeline.sql`
- `api/src/db/jobs.ts`
- `api/src/db/reviews.ts`
- `api/src/routes/repos.ts`
- `api/src/routes/jobs.ts`
- `api/src/server.ts`

### Task 3: Safe Deterministic Review Engine

The API contains a sequential in-process worker that:

1. Claims a durable queued job.
2. Safely clones or refreshes a shallow public repository cache.
3. Performs bounded static analysis without executing repository code.
4. Updates detected repository metadata.
5. Generates a deterministic review and six category scores.
6. Persists the review transactionally.
7. Marks the job complete or stores a bounded, user-safe failure.

The review engine is divided into focused modules under `api/src/review/`:

| File | Responsibility |
| --- | --- |
| `workspace.ts` | Bounded argument-array Git commands, validated cache paths, shallow clone/fetch, and disabled hooks/submodules |
| `analyze.ts` | Bounded file inventory, exclusions, language/framework detection, project evidence, LOC, structure, and Git activity |
| `dependencies.ts` | npm and Python dependency parsing, bounded registry checks, semantic deltas, and explicit offline `unknown` state |
| `security.ts` | Risky-file checks, redacted high-confidence patterns, and optional bounded gitleaks integration |
| `scoring.ts` | Deterministic weighted rubric, category scores, findings, recommendations, and fallback narrative |
| `worker.ts` | Sequential queue draining, job-stage updates, failure handling, and persistence orchestration |

Important safety boundaries include:

- Only public `https://github.com/<owner>/<repository>` URLs are supported.
- Repository package scripts, hooks, configuration modules, submodules, and arbitrary code are not executed.
- Clone, command output, filesystem scan, registry lookup, and analysis operations are bounded.
- Symlinks, generated directories, dependencies, binaries, and oversized files are excluded from source analysis.
- Detected secret-shaped values are redacted and are not persisted in findings or logs.
- Registry outages produce `unknown` dependency status rather than failing the entire review.

## Verification Evidence

The committed checkpoint records the following successful verification from August 24:

- API lint, source/test type-checking, and production build passed.
- The API unit and safety suite passed 27 of 27 tests.
- The existing MariaDB integration suite passed.
- A controlled public-repository worker integration passed through both initial clone and existing-cache refresh paths.
- The live worker result was persisted as a complete successful review with six category rows.
- React and Vite were detected, 16 dependencies were classified, and no token-shaped values appeared in findings.
- Frontend lint and production build passed.
- The frontend component suite passed 9 of 9 tests.
- `git diff --check` passed.

These are historical results recorded in the repository, not a fresh verification from this review. The current checkout does not contain `api/node_modules` or `frontend/node_modules`, so tests and builds were not rerun as part of this read-only assessment.

## Functionality Still Missing

The next implementation point is Task 4 in the [completion plan](superpowers/plans/2026-08-23-finish-ai-project-reviewer.md).

### Ollama Pipeline Integration

Ollama has not been integrated into the persisted API review pipeline. The frontend still calls Ollama's `/api/generate` endpoint directly and replaces only the visible summary. That generated text is not validated as a structured narrative and is not persisted as part of a durable review.

Task 4 is intended to:

- Move Ollama URL and model configuration into the API.
- Send only bounded deterministic evidence, never source text or detected secret values.
- Validate and clamp structured narrative JSON.
- Retry malformed JSON once.
- Fall back to the existing deterministic narrative when Ollama is unavailable or invalid.
- Expose non-secret Ollama configuration and health state.

### Repository and Settings Interfaces

The `/repos` and `/settings` frontend routes still render placeholder screens. Although the backend supports registration, reruns, and job polling, the frontend does not yet provide:

- A repository management list or connect form.
- Inline repository URL validation.
- Durable rerun submission.
- Job progress polling.
- Completed-review refresh.
- Failed-job retry handling.
- Ollama health and configuration controls.

### Authentication and Deployment

The following are also unimplemented:

- Optional single-user token authentication.
- Session cookies and protected API routes.
- Production same-origin frontend/API serving.
- Docker images and Docker Compose orchestration.
- MariaDB, Ollama, API, and repository-cache volumes and health checks.
- Raspberry Pi ARM64 deployment, backup, upgrade, and troubleshooting documentation.
- Final end-to-end desktop, mobile, database, worker, Ollama, and container verification.

## Documentation Drift

Two documentation inconsistencies could confuse future work:

1. The completion plan still shows Tasks 1 through 3 with unchecked checklist items, even though the checkpoint, implementation, tests, and README roadmap identify those tasks as complete.
2. [README.md](../README.md) states that there is no automated test suite, but API and frontend test suites are present and were recorded as passing in the Task 3 checkpoint.

The checkpoint and current source should be treated as authoritative for completed Tasks 1 through 3.

## Rewrite and Conflict Risk

Commit `4fbc398` changed 71 files:

| Area | Files changed | Insertions | Deletions |
| --- | ---: | ---: | ---: |
| API source | 20 | 1,614 | 28 |
| API tests and fixtures | 19 | 608 | 0 |
| Frontend source and tests | 20 | 436 | 87 |
| Documentation | 2 | 343 | 0 |
| Lockfiles | 1 | 1,255 | 40 |
| Configuration and README | 9 | 96 | 16 |
| **Total** | **71** | **4,352** | **171** |

A rewrite based on the state before `4fbc398` would risk losing or duplicating:

- The migration and durable job model.
- Transactional review persistence.
- Restart recovery and active-job deduplication.
- Repository URL validation.
- The complete deterministic analyzer and scoring rubric.
- Clone and analysis safety controls.
- API error normalization.
- Responsive frontend repairs and state handling.
- Regression and integration coverage.

Conflict risk depends on the other device's base commit:

- If it started from `4fbc398`, later Task 4 or Task 5 work should usually be reconcilable with limited overlap.
- If it started from `191652b` or earlier, it may overlap most of the latest implementation and requires a careful file-by-file comparison.
- If it contains only uncommitted files, those files should be backed up before any pull, reset, checkout, or folder replacement.

## Recommended Reconciliation Approach

1. Do not rewrite or overwrite either checkout.
2. On the other device, record its current branch, commit, working-tree changes, and recent commit history.
3. Preserve all of its work as a dedicated backup commit, branch, or binary-capable patch.
4. Transfer or push that preserved state without changing the current `main` branch.
5. Compare its base and changes against `4fbc398`.
6. Retain the completed Tasks 1 through 3 implementation as the baseline unless the other version contains demonstrably newer equivalents.
7. Reconcile overlapping files deliberately, then rerun frontend, API, MariaDB, and worker verification.
8. Continue new development from Task 4 only after the reconciled state is clean and verified.

## Document Implementation Summary

This review added only this Markdown report under `docs/`. No application code, configuration, dependency files, database state, or Git history was changed. No dependencies were installed and no tests were executed.
