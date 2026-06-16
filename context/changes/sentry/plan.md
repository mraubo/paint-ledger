# Sentry Observability Implementation Plan

## Overview

Add Sentry error monitoring, browser tracing, and structured logs to Paint Ledger (Astro 6 server output on Cloudflare Workers). The integration follows official `@sentry/astro` docs plus the Cloudflare-specific custom Worker entry point (`sentry.server.config.ts` wrapping `@astrojs/cloudflare/entrypoints/server`). Events send in production always; locally only when `SENTRY_DEBUG=1`.

## Current State Analysis

- **No Sentry packages or config** — `package.json` has no `@sentry/*` deps; `astro.config.mjs` integrates only `react()` and `sitemap()` with `@astrojs/cloudflare` adapter (`astro.config.mjs:10-16`).
- **Wrangler already Worker-ready** — `wrangler.jsonc:4` points `main` at `@astrojs/cloudflare/entrypoints/server`; `nodejs_compat` and Vite dev exclusions are configured (`wrangler.jsonc:6-21`).
- **Env scaffolding partial** — `.env.example` already lists `SENTRY_AUTH_TOKEN` and `SENTRY_DSN`; no `SENTRY_DEBUG` yet.
- **CI builds without Sentry** — `.github/workflows/ci.yml:21-24` passes only `SUPABASE_*` secrets; no source-map upload.
- **Roadmap parked observability** — `context/foundation/roadmap.md:208` listed Sentry/OTel as post-US-01; this change un-parks it.
- **Three secret surfaces** — local `.env`/`.dev.vars`, GitHub Actions build secrets, Cloudflare Worker runtime secrets / Builds variables (`README.md:213-221`, `infrastructure.md:83`).

### Key Discoveries:

- Cloudflare Astro 6 requires a **custom Worker entry** (`sentry.server.config.ts` + `wrangler.jsonc` `main` change), not only `sentry.server.config.js` with `Sentry.init` — per Sentry Cloudflare Astro guide and `change.md` additional info.
- `SENTRY_AUTH_TOKEN` is **build-time only** (source maps via Sentry Vite plugin); `SENTRY_DSN` is **runtime** (Worker binding + client bundle).
- DSN in client bundle is expected (semi-public); user PII must stay restricted via `dataCollection`.

## Desired End State

- Production Worker captures client and server errors, 10% performance traces, and logs in Sentry project `paint-ledger` (org `mraubo`) with readable stack traces from uploaded source maps.
- Local dev sends events only when developer sets `SENTRY_DEBUG=1` in `.env`/`.dev.vars`.
- Dev-only `/dev/sentry-test` route verifies integration (log + metric + test error) without appearing in production or main nav.
- README, AGENTS.md, and `infrastructure.md` document all Sentry env vars across secret surfaces.

### Verification

1. `npm run lint && npm run build` pass with `SENTRY_AUTH_TOKEN` set (CI and local).
2. With `SENTRY_DEBUG=1`, visit `/dev/sentry-test`, click test button → event appears in Sentry dashboard.
3. Deployed production URL captures real server/client errors without `SENTRY_DEBUG`.

## What We're NOT Doing

- Sentry alerting rules, Slack/email notification setup, or on-call runbooks.
- OpenTelemetry parallel instrumentation.
- E2E or integration tests that assert Sentry delivery (manual verify only).
- Permanent public test-error button in production UI.
- Custom `SENTRY_RELEASE` naming (SDK auto-detect).
- Wiring `SENTRY_DSN` into Playwright CI (no noise from test runs).

## Implementation Approach

1. Install `@sentry/astro` via `npx astro add @sentry/astro`; add `@sentry/cloudflare` if not pulled transitively.
2. Wire Astro integration for build-time source maps (`org: mraubo`, `project: paint-ledger`).
3. Create `sentry.client.config.js` for browser SDK; create `sentry.server.config.ts` as Cloudflare Worker entry wrapping Astro handler (replaces separate `sentry.server.config.js` pattern).
4. Point `wrangler.jsonc` `main` at `./sentry.server.config.ts`.
5. Centralize gating (`enabled`), sampling, and `dataCollection` rules in both client and Worker configs.
6. Extend env surfaces and CI; add gated dev verify route; update ops docs.

## Critical Implementation Details

**Worker entry vs Astro server config:** On Cloudflare, `sentry.server.config.ts` is both the Wrangler `main` module and the server SDK init via `Sentry.withSentry((env) => ({...}), handler)`. Do not add a separate `sentry.server.config.js` — it would conflict with the entry-point filename and duplicate init.

**DSN access differs by runtime:** Worker entry reads `env.SENTRY_DSN` (Cloudflare binding). Client config reads `process.env.SENTRY_DSN` at build time. Both must be set in `.env`, `.dev.vars`, Cloudflare Worker secrets, and Builds build variables where applicable.

**Enabled gating:** Set `enabled: false` when DSN is missing. In development (`import.meta.env.DEV` / local workerd), additionally require `process.env.SENTRY_DEBUG === "1"` (or equivalent env binding) before sending. Production (`import.meta.env.PROD` / deployed Worker) sends when DSN is present.

## Phase 1: SDK Install & Core Config

### Overview

Install Sentry packages, configure Astro integration, client SDK, and Cloudflare Worker entry point with environment-aware sampling and privacy restrictions.

### Changes Required:

#### 1. Package install

**File**: `package.json` (and lockfile)

**Intent**: Add `@sentry/astro` (via `npx astro add @sentry/astro`) and ensure `@sentry/cloudflare` is present for the Worker entry wrapper.

**Contract**: New dependencies; no script changes yet.

#### 2. Astro integration

**File**: `astro.config.mjs`

**Intent**: Register Sentry integration alongside existing `react()` and `sitemap()` integrations for source-map upload at production build.

**Contract**: `sentry({ org: "mraubo", project: "paint-ledger", authToken: process.env.SENTRY_AUTH_TOKEN })` in `integrations` array. Preserve existing `output`, `adapter`, `vite`, and `env` schema blocks.

#### 3. Client SDK config

**File**: `sentry.client.config.js` (new, project root)

**Intent**: Initialize browser Sentry with tracing and logs; respect prod-only + `SENTRY_DEBUG` gating and restricted data collection.

**Contract**:
- `dsn: process.env.SENTRY_DSN`
- `enabled` gated per Critical Implementation Details
- `tracesSampleRate`: `1.0` in dev, `0.1` in production
- `dataCollection: { userInfo: false, httpBodies: [] }`
- `enableLogs: true`
- `integrations: [Sentry.browserTracingIntegration()]`

#### 4. Cloudflare Worker entry

**File**: `sentry.server.config.ts` (new, project root)

**Intent**: Replace default Astro Cloudflare entry as Wrangler `main`; wrap handler with `Sentry.withSentry` for server-side error and log capture on Workers.

**Contract**:
- Import `handler` from `@astrojs/cloudflare/entrypoints/server`
- Import `* as Sentry` from `@sentry/cloudflare`
- `export default Sentry.withSentry((env) => ({ dsn: env.SENTRY_DSN, ... }), handler)`
- Mirror client gating/sampling/`dataCollection`/`enableLogs`
- Include `Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })` per project notes

#### 5. Wrangler entry point

**File**: `wrangler.jsonc`

**Intent**: Point Worker `main` at the Sentry-wrapped entry instead of the bare Astro adapter entry.

**Contract**: Change `main` from `"@astrojs/cloudflare/entrypoints/server"` to `"./sentry.server.config.ts"`. Do not remove existing `compatibility_flags`, `assets`, or `observability` blocks.

### Success Criteria:

#### Automated Verification:

- `npx astro sync` completes without errors
- `npm run lint` passes
- `npm run build` passes with `SUPABASE_URL`, `SUPABASE_KEY`, and `SENTRY_AUTH_TOKEN` set (source maps upload may log success; build must not fail if token absent in local dev without token — verify `astro add` behavior; CI must have token)

#### Manual Verification:

- `npm run dev` starts without Worker entry errors
- `npm run preview` serves pages after build
- No regression on `/entries` auth redirect or sign-in flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Env & CI Secrets

### Overview

Document and wire Sentry environment variables across local, GitHub Actions, and Cloudflare Builds/Worker surfaces.

### Changes Required:

#### 1. Env example

**File**: `.env.example`

**Intent**: Document all Sentry-related variables developers need locally.

**Contract**: Ensure placeholders exist for `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, and add `SENTRY_DEBUG=0` with a one-line comment (set to `1` to send events from local dev).

#### 2. GitHub Actions CI build

**File**: `.github/workflows/ci.yml`

**Intent**: Pass `SENTRY_AUTH_TOKEN` to the `npm run build` step so CI-produced artifacts upload source maps (consistent with `SUPABASE_*` pattern).

**Contract**: Add `SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}` under the build step `env` block. Document required GitHub repo secret in plan/docs (human creates secret in GitHub UI).

#### 3. Playwright workflow (no Sentry)

**File**: `.github/workflows/playwright.yml`

**Intent**: Explicitly avoid adding Sentry env vars to e2e CI — prevents test noise in production Sentry project.

**Contract**: No change required unless e2e build step is added later; note in docs that Playwright CI intentionally omits `SENTRY_DSN`.

### Success Criteria:

#### Automated Verification:

- `npm run build` in CI context succeeds once `SENTRY_AUTH_TOKEN` GitHub secret is configured
- `npm run lint` still passes

#### Manual Verification:

- Developer copies `.env.example` → `.env` and `.dev.vars` with real `SENTRY_DSN` and `SENTRY_AUTH_TOKEN`
- Cloudflare Builds build variables include `SENTRY_AUTH_TOKEN` (and `SENTRY_DSN` if needed at build for client bundle)
- Cloudflare Worker encrypted secret `SENTRY_DSN` set via `npx wrangler secret put SENTRY_DSN`
- Confirm source maps appear in Sentry Releases after a production build/deploy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Dev Verify Route

### Overview

Add a dev-only page to manually verify client-side Sentry capture (log, metric, test error) per official docs.

### Changes Required:

#### 1. Dev test page

**File**: `src/pages/dev/sentry-test.astro` (new)

**Intent**: Provide a repeatable manual verification surface using the docs' test-button pattern; must not be reachable in production.

**Contract**:
- Return `404` or redirect when `import.meta.env.PROD` is true (or equivalent production guard)
- When in dev with `SENTRY_DEBUG=1`, render a button that triggers `Sentry.logger.info`, `Sentry.metrics.count`, and `throw new Error('This is a test error')` via client `<script>`
- No links from app nav or sitemap; route is discoverable only by direct URL
- Do **not** add to `PROTECTED_ROUTES` unless product decision requires auth — keep as open dev-only page gated by env

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` succeeds (prod guard ensures page does not expose test UI in production bundle behavior — verify built output or runtime 404)

#### Manual Verification:

- With local Supabase running, `SENTRY_DEBUG=1`, and `SENTRY_DSN` set: open `http://localhost:4321/dev/sentry-test`, click button, confirm event in Sentry dashboard within a few minutes
- With `SENTRY_DEBUG` unset: confirm no events sent from normal local browsing
- Production URL `/dev/sentry-test` returns 404 or safe redirect

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Documentation

### Overview

Update contributor and ops docs so Sentry secrets are discoverable and maintained across all surfaces.

### Changes Required:

#### 1. README secret surfaces

**File**: `README.md`

**Intent**: Extend the "Secret surfaces" table and deployment sections with Sentry variables.

**Contract**: Document `SENTRY_AUTH_TOKEN` (build-time, GitHub + Cloudflare Builds + local `.env`), `SENTRY_DSN` (runtime Worker secret + local `.env`/`.dev.vars` + Builds if client bundle needs it at build), and `SENTRY_DEBUG` (local-only opt-in). Note Playwright CI intentionally omits Sentry.

#### 2. Agent rules

**File**: `AGENTS.md`

**Intent**: Add a concise rule so agents know Sentry env boundaries and do not expose `SENTRY_AUTH_TOKEN` client-side.

**Contract**: Short bullet under Hard rules or env section: `SENTRY_AUTH_TOKEN` is build-time only; `SENTRY_DSN` is semi-public but loaded via env; local event sending requires `SENTRY_DEBUG=1`; do not commit real tokens.

#### 3. Infrastructure ops story

**File**: `context/foundation/infrastructure.md`

**Intent**: Add Sentry to Operational Story secrets list and risk register entry for observability secret drift.

**Contract**: Update Secrets bullet to include Sentry vars; add brief note under Logs/Observability that Sentry complements `wrangler tail`.

#### 4. Change status

**File**: `context/changes/sentry/change.md`

**Intent**: Mark change as planned.

**Contract**: `status: planned`, `updated: 2026-06-16`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (markdown lint if applicable)

#### Manual Verification:

- New contributor can configure Sentry from README alone without reading `change.md`
- AGENTS.md rule is accurate against implemented gating

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None required — Sentry is infrastructure wiring; no business logic to unit test.

### Integration Tests:

- Existing integration tests must continue passing; Sentry must not break Supabase auth or entry workflows.
- No new tests asserting Sentry HTTP calls.

### Manual Testing Steps:

1. Local dev with `SENTRY_DEBUG=1`: verify `/dev/sentry-test` button → Sentry event.
2. Local dev without `SENTRY_DEBUG`: browse app → no Sentry noise.
3. Production deploy: trigger a real error path (or use test route 404 confirm) → event in Sentry.
4. Confirm stack traces are demangled (source maps uploaded).

## Performance Considerations

- Production `tracesSampleRate: 0.1` limits performance trace volume.
- `enabled` gating prevents dev/CI flood.
- Browser tracing adds minimal client overhead; acceptable for MVP observability baseline.

## Migration Notes

- First deploy after merge: human must add `SENTRY_AUTH_TOKEN` to GitHub secrets and Cloudflare Builds, and `SENTRY_DSN` to Worker secrets before expecting production events.
- `wrangler.jsonc` `main` change is deploy-critical — smoke-test auth after first Sentry deploy.
- Roadmap parked item can move to Done in a follow-up doc edit (out of scope for this change unless user requests).

## References

- Change notes: `context/changes/sentry/change.md`
- Sentry Astro manual setup: https://docs.sentry.io/platforms/javascript/guides/astro/manual-setup/
- Sentry Cloudflare Astro entry: https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro/
- Existing adapter: `astro.config.mjs:16`, `wrangler.jsonc:4`
- Secret surfaces pattern: `README.md:213-221`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: SDK Install & Core Config

#### Automated

- [x] 1.1 `npx astro sync` completes without errors — 5834575
- [x] 1.2 `npm run lint` passes — 5834575
- [x] 1.3 `npm run build` passes with Supabase and `SENTRY_AUTH_TOKEN` env set — 5834575

#### Manual

- [x] 1.4 `npm run dev` starts without Worker entry errors — 5834575
- [x] 1.5 `npm run preview` serves pages after build — 5834575
- [x] 1.6 No regression on `/entries` auth redirect or sign-in flow — 5834575

### Phase 2: Env & CI Secrets

#### Automated

- [x] 2.1 `npm run build` succeeds in CI once `SENTRY_AUTH_TOKEN` GitHub secret is configured — f511e1b
- [x] 2.2 `npm run lint` still passes — f511e1b

#### Manual

- [x] 2.3 Local `.env` and `.dev.vars` populated with Sentry vars — f511e1b
- [x] 2.4 Cloudflare Builds and Worker secrets configured for Sentry — f511e1b
- [x] 2.5 Source maps appear in Sentry Releases after production build/deploy

### Phase 3: Dev Verify Route

#### Automated

- [x] 3.1 `npm run lint` passes — a484035
- [x] 3.2 `npm run build` succeeds with prod guard on verify route — a484035

#### Manual

- [x] 3.3 Local `SENTRY_DEBUG=1` test button sends event to Sentry — a484035
- [x] 3.4 Local without `SENTRY_DEBUG` sends no events from normal browsing
- [x] 3.5 Production `/dev/sentry-test` is not exposed

### Phase 4: Documentation

#### Automated

- [x] 4.1 `npm run lint` passes

#### Manual

- [x] 4.2 README alone is sufficient for Sentry setup
- [x] 4.3 AGENTS.md rule matches implemented gating
