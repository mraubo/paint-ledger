# Sentry Observability — Plan Brief

> Full plan: `context/changes/sentry/plan.md`

## What & Why

Paint Ledger needs production error monitoring now that core entry workflows are shipped. Sentry captures client and server exceptions, performance traces, and logs on the Cloudflare Workers deployment — un-parking the roadmap's observability baseline with minimal scope.

## Starting Point

Astro 6 runs server output on `@astrojs/cloudflare` with `wrangler.jsonc` pointing at the default adapter entry. No `@sentry/*` packages exist. `.env.example` already stubs `SENTRY_AUTH_TOKEN` and `SENTRY_DSN`. CI builds with `SUPABASE_*` only.

## Desired End State

Production sends errors and 10% traces to Sentry project `paint-ledger` (org `mraubo`) with uploaded source maps. Local dev sends only when `SENTRY_DEBUG=1`. A hidden `/dev/sentry-test` route verifies the integration. README, AGENTS.md, and `infrastructure.md` document all secret surfaces.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Event gating | Production always; local `SENTRY_DEBUG=1` | Clean prod signal without dev/CI noise | Plan |
| Tracing rate | 1.0 dev / 0.1 production | Full local debugging, controlled prod cost | Plan |
| PII | `dataCollection: { userInfo: false, httpBodies: [] }` | Private user entries; DSN is already client-visible | Plan |
| Verify UI | Dev-only `/dev/sentry-test` | Repeatable check without prod exposure | Plan |
| CI source maps | GitHub `SENTRY_AUTH_TOKEN` secret | Matches existing `SUPABASE_*` CI pattern | Plan |
| Feature scope | Errors + logs + browser tracing + verify metrics | Full docs baseline per user request | Plan |
| Docs | README + AGENTS.md + infrastructure.md | Complete ops coverage across secret surfaces | Plan |
| Release naming | SDK auto-detect | Zero maintenance | Plan |
| Cloudflare entry | `sentry.server.config.ts` as Wrangler `main` | Required for Astro 6 + Workers per Sentry Cloudflare guide | Change notes |
| Sentry project | org `mraubo`, project `paint-ledger` | Updated from initial wizard defaults | Change notes |

## Scope

**In scope:** `@sentry/astro` + `@sentry/cloudflare`, Astro integration, client config, Worker entry wrapper, `wrangler.jsonc` main change, env/CI/Cloudflare secrets, dev verify route, docs.

**Out of scope:** Alerting rules, OTel, automated Sentry tests, permanent prod test button, custom release naming, Playwright CI Sentry wiring.

## Architecture / Approach

```
Browser → sentry.client.config.js (@sentry/astro)
                ↓ events
Cloudflare Worker → sentry.server.config.ts (@sentry/cloudflare withSentry)
                ↓ wraps @astrojs/cloudflare/entrypoints/server
Build → astro.config.mjs sentry() + SENTRY_AUTH_TOKEN → source maps upload
```

`SENTRY_DSN` flows via Worker binding (server) and build-time env (client). `SENTRY_AUTH_TOKEN` is build-only. Gating logic disables sending when DSN missing or (in dev) `SENTRY_DEBUG` unset.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. SDK & core config | Packages, astro integration, client + Worker entry, wrangler main | Worker entry miswire breaks all routes |
| 2. Env & CI secrets | `.env.example`, `ci.yml`, Cloudflare secret checklist | Source maps fail silently without token |
| 3. Dev verify route | `/dev/sentry-test` gated page | Accidental prod exposure of test UI |
| 4. Documentation | README, AGENTS.md, infrastructure.md | Secret drift across three surfaces |

**Prerequisites:** Sentry account with project `paint-ledger`; auth token with release/source-map scope; DSN value for env files.

**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Human must create `SENTRY_AUTH_TOKEN` GitHub secret and Cloudflare Builds variable before CI/production source maps work.
- `wrangler.jsonc` `main` change is deploy-critical — auth smoke test required after first Sentry deploy.
- `@sentry/astro` `astro add` may prompt interactively; implementer may need non-interactive flags.
- Build without `SENTRY_AUTH_TOKEN` behavior must be verified (should not block local dev).

## Success Criteria (Summary)

- `npm run lint` and `npm run build` pass with Sentry wired.
- `SENTRY_DEBUG=1` local test button produces a Sentry event with readable stack trace.
- Production captures errors without local debug flag; `/dev/sentry-test` not exposed in prod.
