<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sentry Observability Implementation Plan

- **Plan**: context/changes/sentry/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-16
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 7 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING ⚠️ |
| Scope Discipline | WARNING ⚠️ |
| Safety & Quality | PASS ✅ |
| Architecture | PASS ✅ |
| Pattern Consistency | WARNING ⚠️ |
| Success Criteria | PASS ✅ |

## Findings

### F1 — Dev verify route at `/debug/` instead of planned `/dev/`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `src/pages/debug/sentry-test.astro`, `src/middleware.ts:9`
- **Detail**: Plan specifies `src/pages/dev/sentry-test.astro` at `/dev/sentry-test`. Implementation uses `/debug/sentry-test` with middleware `DEV_ONLY_ROUTES`. README and infrastructure.md were updated to match code; `plan.md` still references `/dev/`.
- **Fix A ⭐ Recommended**: Add a one-line addendum to `plan.md` Phase 3 documenting the `/debug/` path and middleware guard as the implemented design.
  - Strength: Preserves working implementation; aligns plan with code and updated docs.
  - Tradeoff: Plan text becomes a moving target for this slice.
  - Confidence: HIGH — behavior matches intent; only path differs.
  - Blind spot: Bookmarks or external docs referencing `/dev/sentry-test`.
- **Fix B**: Rename route to `/dev/sentry-test` to match plan verbatim.
  - Strength: Strict plan adherence.
  - Tradeoff: Touches middleware, API path, README, and component fetch URL.
  - Confidence: HIGH — mechanical rename.
  - Blind spot: `/debug/` may have been chosen deliberately to group dev tooling.
- **Decision**: FIXED (Fix B — renamed route to `/dev/sentry-test`)

### F2 — Test button pattern differs from plan contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/components/dev/SentryTestButton.tsx:17-28`
- **Detail**: Plan requires `Sentry.logger.info`, `Sentry.metrics.count`, and `throw new Error(...)` via client script. Implementation uses `Sentry.captureException` (client) plus `POST /api/debug/sentry-test` (server). No logger/metrics calls. React island instead of inline `<script>` — correct per `lessons.md` for Cloudflare dev.
- **Fix**: Extend `SentryTestButton` click handler to also call `Sentry.logger.info`, `Sentry.metrics.count`, and `captureException` (or throw) so logs/metrics/traces paths are exercised per plan.
- **Decision**: FIXED

### F3 — Unplanned Sentry tunnel endpoint

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `src/pages/api/sentry-tunnel.ts`, `sentry.client.config.js:9`
- **Detail**: `/api/sentry-tunnel` and `tunnel: "/api/sentry-tunnel"` are not in the plan. Adds a permanent public POST surface for browser SDK proxying (CORS/ad-blocker bypass).
- **Fix A ⭐ Recommended**: Document tunnel in plan addendum and README tunnel section (purpose, validation, ops).
  - Strength: Keeps beneficial implementation; makes scope explicit for future reviews.
  - Tradeoff: Expands documented public API surface.
  - Confidence: HIGH — tunnel is standard Sentry pattern.
  - Blind spot: Abuse/quota risk (see F4).
- **Fix B**: Remove tunnel; rely on direct DSN ingest.
  - Strength: Smaller attack/quota surface.
  - Tradeoff: Ad-blockers may block client events in production.
  - Confidence: MEDIUM — depends on user ad-blocker rates.
  - Blind spot: Haven't measured blocked-event rate.
- **Decision**: FIXED (Fix A — documented tunnel in plan addendum and README)

### F4 — Hardcoded Sentry host/project in tunnel validator

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/sentry-tunnel.ts:6-7`
- **Detail**: `SENTRY_HOST` and `SENTRY_PROJECT_ID` are hardcoded while DSN is env-driven everywhere else. DSN rotation, region change, or staging project requires code deploy to keep tunnel validation in sync.
- **Fix**: Derive allowed host and project ID from `SENTRY_DSN` server env at request time (parse URL), keeping hostname/project validation.
- **Decision**: FIXED

### F5 — Tunnel forwards envelope as UTF-8 text

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/sentry-tunnel.ts:11,29`
- **Detail**: Uses `request.text()` and re-sends as text. Sentry docs recommend `arrayBuffer()` for binary-safe forwarding. May corrupt binary attachments (replay, minidumps) if added later.
- **Fix**: Replace `request.text()` with `request.arrayBuffer()` and forward raw bytes with `Content-Type: application/x-sentry-envelope` (or incoming content-type).
- **Decision**: FIXED

### F6 — Supabase auth runs before tunnel bypass

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/middleware.ts:14-30`
- **Detail**: `PUBLIC_API_ROUTES` bypass runs after `supabase.auth.getUser()`. Every tunnel POST pays an unnecessary Supabase session lookup during error bursts.
- **Fix**: Move `pathname` extraction and `PUBLIC_API_ROUTES` early-return before creating the Supabase client.
- **Decision**: FIXED

### F7 — `SENTRY_DEBUG` env source split between client and server

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: `sentry.client.config.js:2,5`, `src/middleware.ts:34`, `src/pages/api/debug/sentry-test.ts:5`
- **Detail**: Client reads `SENTRY_DEBUG` via `astro:env/client` (`.env`); middleware/API read `process.env.SENTRY_DEBUG` (`.dev.vars`/Worker). Violates the spirit of lessons.md “sync .env and .dev.vars” — mis-sync causes client sending without page access or page open without client sending.
- **Fix A ⭐ Recommended**: Keep dual-file requirement but add a short README troubleshooting note with the failure modes when only one file is set.
  - Strength: No code change; documents known Cloudflare split.
  - Tradeoff: Does not eliminate footgun.
  - Confidence: HIGH — matches current architecture.
  - Blind spot: Contributors may still skip `.dev.vars`.
- **Fix B**: Gate client `enabled` using only `import.meta.env.DEV` and rely on server/middleware for `SENTRY_DEBUG` (remove `SENTRY_DEBUG` from client schema).
  - Strength: Single server-side debug flag.
  - Tradeoff: Client SDK cannot independently reflect debug intent from env.
  - Confidence: MEDIUM — needs build-time behavior check.
  - Blind spot: Preview/prod-like local builds.
- **Decision**: FIXED (Fix A — README troubleshooting note)

### F8 — Tracing may expose entry URLs despite `dataCollection`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `sentry.client.config.js:12-13`, `sentry.server.config.ts:18-19`
- **Detail**: `userInfo: false` and `httpBodies: []` match plan. Default `stackFrameVariables` and `browserTracingIntegration()` can still capture `/entries/{uuid}` URLs and locals near thrown errors in entry workflows.
- **Fix A ⭐ Recommended**: Add `beforeSendTransaction` to strip or hash UUID path segments for `/entries` and `/api/entries`.
  - Strength: Targeted privacy for core domain routes without disabling tracing globally.
  - Tradeoff: Slightly less readable transaction names in Sentry.
  - Confidence: MED — needs sample transaction review in dashboard.
  - Blind spot: Other routes with sensitive query params.
- **Fix B**: Set `stackFrameVariables: false` and reduce `tracesSampleRate` further.
  - Strength: Broad privacy default.
  - Tradeoff: Harder debugging of client/server errors.
  - Confidence: HIGH — SDK-supported option.
  - Blind spot: Loses useful locals for non-entry errors.
- **Decision**: FIXED (Fix A — beforeSendTransaction URL sanitization)

### F9 — Sitemap exclusion not applicable today

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `astro.config.mjs:16`
- **Detail**: Plan requires no sitemap exposure for dev route. `@astrojs/sitemap` is registered but build logs `requires the site astro.config option. Skipping.` — dev route is not emitted today. Revisit if `site` is configured later.
- **Fix**: When adding `site` to astro config, filter `/dev/**` from sitemap.
- **Decision**: FIXED (comment in astro.config.mjs)

### F10 — Local build: Sentry source-map upload org mismatch (environment)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: build output / `astro.config.mjs:18`
- **Detail**: `npm run build` completes (exit 0) but Sentry CLI warns token org `nordsoft` vs configured `mraubo`, and source-map upload fails. CI/production likely fine with correct secret; local token mismatch is env-specific, not a code defect.
- **Fix**: Use `SENTRY_AUTH_TOKEN` scoped to org `mraubo` locally, or document expected upload warning when token org differs.
- **Decision**: FIXED (README note on token org scope)

## Automated verification (review run)

| Check | Result |
|-------|--------|
| `npx astro sync` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS (exit 0; Sentry upload failed locally due to token org mismatch — non-blocking) |

## Manual verification (Progress section)

All Progress checkboxes are `[x]`. Phase 3 manual items reference `/dev/sentry-test` in plan text while implementation uses `/debug/` — evidence in code/docs supports completion with path drift (F1).
