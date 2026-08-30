# AI Project Reviewer — frontend

React + Vite + TypeScript frontend, ported from the design handoff prototype in
`../design_handoff_ai_project_reviewer/`. See `../README.md` and
`../design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md` for the full spec
and backend plan (MariaDB + Ollama on a Raspberry Pi).

## Status: responsive review UI with API-owned review generation

Dashboard, Review (5 tabs: AI Review, Code Quality, Structure, Dependencies,
Security), and Insights screens are fully built and routed
(`react-router-dom`), themed (dark/light, persisted to `localStorage`), and
backed by the embedded sample data (`src/data/sampleData.ts`). Repositories
and Settings are stubs, matching the prototype.

`src/data/api.ts` uses only the Fastify API for reviews, health, and rerun
requests. Ollama is owned by the API worker; browser code never contacts the
model port directly. The current standalone fallback remains embedded sample
data until the repository-management milestone replaces it with opt-in demo mode.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
```

## Structure

- `src/data/` — types, sample data, and the API adapter (`APR_CONFIG`, `load`, `ping`, `rerun`, `grade`).
- `src/components/` — shared UI: sidebar, top bar, score ring, repo rail, tabs, insights column.
- `src/screens/` — Dashboard, ReviewScreen (+ routed wrapper), InsightsScreen, Stub.
- `src/styles/tokens.css` — the Nocturne design-system tokens (source of truth for colors/spacing/type).
- `src/styles/app.css` — app shell and screen layout, ported from the prototype's `<style>` block.

Icons are `@phosphor-icons/web`, imported locally (not from a CDN) to keep the
app fully self-hosted per the project's no-cloud-dependencies goal.
