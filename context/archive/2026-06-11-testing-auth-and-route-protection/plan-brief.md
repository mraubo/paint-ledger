# Auth and Route Protection — Plan Brief

> Full plan: `context/changes/testing-auth-and-route-protection/plan.md`
> Research: `context/changes/testing-auth-and-route-protection/research.md`

## What & Why

Phase 2 of the test rollout adds **HTTP integration tests** so middleware and entry APIs cannot regress on auth: unauthenticated users must be redirected away from `/entries` and `/api/entries`, and User B must not get success redirects when targeting User A's `entry_id`. Phase 1 proved RLS at the database; this phase proves the **app layer redirect contract**.

## Starting Point

Vitest, two seed users, and `rls-isolation.test.ts` exist from Phase 1. Middleware lists `PROTECTED_ROUTES` and entry handlers use redirect-based errors (not 403/404 JSON). No HTTP tests or dev-server helpers exist yet.

## Desired End State

Contributors run `npm test` with local Supabase **and** `npm run dev` to get green HTTP auth/IDOR tests. `tests/helpers/http-client.ts` and `tests/integration/auth-route-protection.test.ts` encode the pattern. test-plan §6.4 and AGENTS.md describe how to extend coverage for new API routes.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Test layer | HTTP Vitest + `fetch` | Cheapest signal for middleware + redirect shape | Research |
| Auth fixture | `POST /api/auth/signin` → `Set-Cookie` | Matches production SSR cookie path | Research |
| IDOR oracle | Redirect denial, not 403/404 | Product contract uses Astro redirects | Research + test-plan backport |
| Route coverage | Representative matrix (3–4 APIs + 2 pages) | All 14 POST handlers share same pattern | Research |
| CI | Local-only until Phase 4 | Dev server in CI deferred to quality-gates phase | Research |
| Dev server failure | `requireDevServer()` throws | Fail fast with actionable message | Plan |
| POST CSRF | Always `Origin: http://localhost:4321` | Astro rejects POST without Origin | Lessons |

## Scope

**In scope:** HTTP helpers; Risk #3 route tests; Risk #6 IDOR tests; AGENTS.md/README/test-plan §6.4 updates.

**Out of scope:** CI wiring; Playwright; all 14 API routes; RLS re-tests; middleware/handler code changes.

## Architecture / Approach

```
Vitest → fetch(localhost:4321) → Astro middleware (session?) → page/API handler → redirect
         ↑ signInViaHttp sets Supabase SSR cookie
```

Helpers live in `tests/helpers/http-client.ts`. Tests use seed users A/B and `ENTRY_A` from Phase 1 fixtures. RLS suite runs unchanged in the same `npm test`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. HTTP helpers | `http-client.ts`, dev-server guard | Cookie parsing from `Set-Cookie` |
| 2. Risk #3 tests | Unauth redirect + auth 200 on pages/API | Forgetting `Origin` on POST |
| 3. Risk #6 + docs | Cross-user redirect denial + §6.4 cookbook | Wrong oracle (403 vs redirect) |

**Prerequisites:** Phase 1 complete; local Supabase; `npm run dev` on 4321; `.env` with Supabase keys.

**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- `npm test` without dev server will fail once HTTP tests land — documented, acceptable until Phase 4.
- Vitest runs files in parallel by default; HTTP tests assume dev server is stable for the suite duration.
- Entry title string in GET body assertion must stay in sync with `supabase/seed.sql`.

## Success Criteria (Summary)

- Unauthenticated access to protected prefixes redirects to sign-in.
- User A reaches entry pages with 200; User B cannot cross-user mutate or view A's entry via HTTP success paths.
- test-plan §6.4 tells future contributors how to add API auth tests.
