# Handoff: AI Project Reviewer

## Overview
AI Project Reviewer is a self-hosted tool that reviews a developer's GitHub repositories and produces scored, actionable reports: an overall 0–100 score, six category scores, strengths / needs-improvement / next-steps lists, a portfolio-readiness checklist, and a plain-language AI summary. Backend targets: **MariaDB on a Raspberry Pi (LAN)** for persistence and a **local LLM (Ollama)** for review generation. No cloud services.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look and behavior, not production code to copy directly. The task is to **recreate this design in the target codebase's environment** using its established patterns; if no codebase exists yet, the recommended stack is in `IMPLEMENTATION_PLAN.md`.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions are final. Recreate pixel-perfectly. All visual values come from the Nocturne design-system tokens in `styles.css` (bundled) — use CSS variables, never hard-coded hexes.

## Screens / Views

### 1. Review detail (default screen)
- **Purpose**: Read the full AI review of one repository.
- **Layout**: App shell = 228px fixed sidebar + fluid body. Body = sticky top bar (56px-ish, blurred `--color-bg` at 88%) + content grid `252px rail / minmax(0,1fr) main / 296px insights`, gap `--space-3` (8.4px), page padding-inline `--space-6` (16.8px). Rail and insights columns are `position: sticky; top: 64px`. Below 1200px the insights column collapses.
- **Repo rail**: "Repositories" heading + small secondary "Add Repo" button; search input (34px, surface bg, 1px divider border); repo cards (surface bg, 8px radius, 10px padding, 34px tinted repo icon + name 13.5px/500 + "Updated …" 11px at 50% text + GitHub glyph at 55%). Selected card: 1px border in score-green + soft glow `0 0 14px green@18%`. Footer link "View all repositories →" in accent.
- **Review header card**: `.card.elev-sm`. Left: sparkle icon (26px, green, filled) + "AI Project Reviewer" h3 26px + subtitle 13px muted; repo row = 40px tinted icon, repo name 17px/500, visibility `.tag.tag-neutral`, URL 12px muted with external-link glyph. Right: **score ring** — 118px SVG, 7px stroke, track `--color-divider`, arc colored by score (see Score colors), rounded caps, animated `stroke-dasharray .8s`; center `72` at 30px/600 over `/100` 11px; grade word under ring in the same color.
- **Project Summary card**: kicker "PROJECT SUMMARY" (10px uppercase, 0.1em tracking, 55% text) + auto-fit grid `minmax(130px,1fr)`: each item = 17px Phosphor icon (accent, or tone color) + label 11px muted + value 13px tinted by tone (good=green, warn=amber).
- **Tabs**: underline style on a 1px divider rule. Tab = icon + label, 13.5px, 9px/13px padding, 65% text; active = score-green text + 2px bottom border. Tabs: AI Review, Code Quality, Structure, Dependencies, Security.
- **AI Review tab**: two columns `1.5fr / 1fr`. Left card: "Strengths" (green h5 + check-circle list), "Needs Improvement" (amber h5 + warning list), "Recommended Next Steps" (accent h5 + numbered list, 18px accent-outlined circle numerals). Right card "Portfolio Readiness": star h5 in accent + verdict `.tag` (green-800 bg / green-100 text); blurb 13px at 80%; checklist rows — done = filled green check-circle, not-done = hollow circle in `--color-neutral-600` at 55% row opacity; muted footer line pinned to bottom.
- **Code Quality tab**: metric tiles (auto-fit `minmax(110px,1fr)`, 1px divider border, value 22px/600 + label 11px muted) + findings list (severity icon + text).
- **Structure tab**: `<pre>` file tree, `ui-monospace` 13px, line-height 1.7, 85% text.
- **Dependencies tab**: `.table` — Package (mono 13px), Installed, Latest, Status (colored: ok=green "Up to date", outdated=amber "Update available", major=red "Major behind").
- **Security tab**: findings list — severity icon (high=red warning-octagon, med=amber warning, ok=green check-circle) + bold title + 13px muted detail.
- **AI Summary card** (bottom): green kicker with sparkle + summary paragraph 14px / 1.6.
- **Insights column**: "Insights" h4 19px + trend-up icon in accent; "CATEGORY SCORES" kicker; six category cards — 32px icon tile (6% text bg, accent icon), name 13px, `65/100` (score colored, denominator muted), 4px progress bar (10% text track, score-colored fill, `width .6s`). "REPOSITORY INSIGHTS" kicker + key/value card (13px rows, 7% hairline separators; language value in accent; issues >3 in amber). Full-width `.btn.btn-primary` "View full insights →".

### 2. Dashboard
- Stat cards (auto-fit `minmax(160px,1fr)`): accent icon, value 28px/600, label 12px muted — Repositories, Average score, Reviews run, Open gaps.
- "Recent reviews" `.table`: repo (24px icon + name), score (colored bold /100), grade, top gap (first unchecked portfolio item), reviewed time. Rows clickable → Review detail.
- "Weakest categories across your repos": three lowest category averages as category cards with bars.

### 3. Insights
- Two-column `1.4fr / 1fr`: "Category averages" (six bars with avg score + best/lowest repo captions at 11px) and "Common gaps" (unchecked-checklist tally, amber warning icons + `.tag.tag-neutral` count chips).
- Repo grid `minmax(200px,1fr)`: card per repo — icon + name, big colored score 22px, grade, progress bar. Clickable → Review detail.

### 4. Repositories / Settings
Stubs in the prototype (empty state with barricade icon). Settings should eventually hold the endpoint config (see State Management).

## Interactions & Behavior
- **Navigation**: sidebar buttons switch screens; active item = surface bg + inset 2px accent left rule + filled icon variant. Clicking any repo row/card anywhere opens its Review detail with the AI Review tab selected.
- **Repo rail**: instant client-side name filter; selecting a repo swaps all review content (no route change needed in prototype; real app should use routes `/reviews/:repoId`).
- **Re-run Review** (top bar, secondary button): disables + label "Reviewing…" + spinning arrows-clockwise icon (1s linear infinite); calls the LLM; on completion replaces the AI Summary text and sets "Review generated **just now**".
- **Theme toggle** (icon button, sun/moon): swaps `data-theme` on `<html>`, persisted to `localStorage('apr-theme')`. Body transitions background/color 0.25s.
- **Connection chips** (top bar): pill (11px, 1px divider border, 99px radius) per backend — `mariadb @ pi` and `llama3.1 (local)` — 7px status dot: green = reachable, amber = unreachable/sample data. Title tooltip explains fallback.
- **Hovers**: repo cards gain divider border; nav items 6% text tint; table rows use Nocturne row hover; buttons per Nocturne `.btn` states. Keyboard focus = 2px accent `:focus-visible` ring (from styles.css).
- **Score ring / bars** animate on data change (`stroke-dasharray .8s ease`, bar `width .6s ease`).

## State Management
- `screen` ('dashboard' | 'repos' | 'reviews' | 'insights' | 'settings'), `selectedRepoId`, `activeTab`.
- `theme` ('dark' | 'light') — persisted.
- `repos[]` — fetched from the API, falls back to embedded sample data (`reviewer-data.js`, `window.APR_SAMPLE` documents the full record shape: scores, cats, strengths, improves, steps, portfolio checklist, quality metrics/findings, structure, deps, security).
- `dbLive`, `llmLive` — health-check booleans; `running`, `generatedAt`, `freshSummary` for re-run flow.
- Endpoints (prototype: `APR_CONFIG` in `reviewer-data.js`): `apiBase` REST façade over MariaDB (`GET /api/repos`), `llmBase` Ollama (`POST /api/generate`, model `llama3.1`). Browsers cannot speak the MariaDB wire protocol — a thin REST layer on the Pi is required.

## Design Tokens
From Nocturne `styles.css` (bundled; dark is default):
- Ground: `--color-bg #161826`, `--color-surface #232532`, `--color-text #e9e9ed`, `--color-divider` = text@16%.
- Accent (blurple): `--color-accent #9184d9` + ramp `--color-accent-100…900`.
- Neutral ramp `--color-neutral-100…900`.
- **Semantic green** (scores/health): `--color-green oklch(0.66 0.125 152)` + ramp `--color-green-100…900`.
- Prototype-local: `--apr-warn oklch(0.72 0.13 80)`, `--apr-bad oklch(0.66 0.16 27)` (light theme: L≈0.56).
- **Score colors**: ≥65 green, 40–64 amber, <40 red (`scoreVar()` in `reviewer-review.jsx`).
- Type: Inter 400/500/600; headings weight 500; body 15px/1.55.
- Spacing: `--space-1…8` = 2.8 / 5.6 / 8.4 / 11.2 / 16.8 / 22.4px. Radii: 4 / 8 / 14px. Shadows: `--shadow-sm/md/lg`.
- **Light theme** (`html[data-theme="light"]`): bg `#f3f4fa`, surface `#fff`, text `#23252f`, accent `#6d5fc0`, all ramps flipped (100↔900 …), soft ink shadows — full override block is in the prototype HTML `<style>`.
- Tweakable flags in the prototype: density (compact/cozy padding vars), insights panel on/off, score accent green vs. blurple (`.apr-mono` remaps `--apr-good` to accent).

## Assets
- Icons: **Phosphor** (regular + fill weights), loaded from `@phosphor-icons/web@2.1.1`. In production, use `@phosphor-icons/react` or inline SVGs.
- Repo icons: no images — 34px rounded tiles colored per-repo via `oklch(0.35 0.06 <hue>)` bg / `oklch(0.87 0.07 <hue>)` glyph.
- No raster assets.

## Screenshots
- `screenshots/01-review-dark.png` — Review detail (dark)
- `screenshots/02-dashboard-dark.png` — Dashboard (dark)
- `screenshots/03-insights-dark.png` — Insights (dark)
- `screenshots/04-review-light.png` — Review detail (light theme)

## Files
- `AI Project Reviewer.html` — shell, all layout CSS, light-theme overrides, script loading.
- `reviewer-app.jsx` — app shell: sidebar, top bar, routing, theme, tweaks, re-run flow.
- `reviewer-review.jsx` — review screen: rail, header + ring, summary, all five tabs, insights column.
- `reviewer-screens.jsx` — Dashboard, Insights, stub screens.
- `reviewer-data.js` — `APR_CONFIG` (endpoints), `APR` adapter (load/ping/rerun with fallbacks), `APR_SAMPLE` (5 repos — the canonical data shape).
- `tweaks-panel.jsx` — prototype-only tweaks shell; do not implement.
- `styles.css` — the Nocturne design-system stylesheet (source of truth for tokens and base components: `.btn`, `.card`, `.tag`, `.table`, `.input`).
