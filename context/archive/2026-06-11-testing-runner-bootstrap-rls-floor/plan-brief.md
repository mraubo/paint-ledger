# Runner Bootstrap and RLS Floor — Plan Brief

> Full plan: `context/changes/testing-runner-bootstrap-rls-floor/plan.md`
> Research: `context/changes/testing-runner-bootstrap-rls-floor/research.md`

## What & Why

Paint Ledger has no automated tests; owner-only data isolation lives in Postgres RLS but is verified only manually. This change bootstraps **Vitest** and ships **two-user RLS integration tests** — test rollout Phase 1 — proving risks **#1** (cross-user access) and **#7** (migration/RLS drift) at the cheapest high-signal layer.

## Starting Point

Four RLS-protected tables, one seed user with a full fixture entry, anon SSR client in `src/lib/supabase.ts`, and F-01's manual RLS contract in the archive. No Vitest, no `npm test`, CI is lint + build only.

## Desired End State

`npm test` against local Supabase proves user B cannot read or mutate user A's rows on all four tables; docs and `test-plan.md` §6 tell future contributors how to extend the pattern. CI wiring waits for rollout Phase 4.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Test runner | Vitest (Node) | Vite-native, fits Astro toolchain | Research |
| Test client | `@supabase/supabase-js` anon key | Mirrors production; RLS is the boundary | Research |
| Second user | Extend `seed.sql` (user B, no entries) | Deterministic; no sign-up/email-confirm dependency | Research |
| Test location | `tests/integration/` + `tests/helpers/` | Avoids Astro bundling `astro:env` | Plan |
| Supabase down | Fail fast with setup message | Prevents false green | Plan |
| RPC coverage | One negative `delete_step_and_renumber` for user B | Low cost; invoker RPCs rely on RLS | Plan |
| CI | Not in this change | Test-plan Phase 4 owns quality gates | Test-plan |

## Scope

**In scope:** Vitest config, test helpers, seed user B, RLS integration suite, `npm test`, AGENTS.md/README/test-plan §6 updates.

**Out of scope:** CI job, HTTP/middleware tests, storage RLS, paint invariant, e2e, service_role tests.

## Architecture / Approach

```
supabase db reset (seed A + B)
        ↓
npm test → Vitest → signInAs(A|B) → createClient(anon)
        ↓
.from() / .rpc() on four tables → assert isolation per F-01 contract
```

Tests load `SUPABASE_URL` / `SUPABASE_KEY` from `.env` via Vitest `loadEnv`, not `astro:env/server`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Vitest harness | Config, helpers, `npm test` | `astro:env` import leak into tests |
| 2. Seed + RLS suite | User B in seed, `rls-isolation.test.ts` | Flaky assertions on PostgREST error shapes |
| 3. Docs + cookbook | AGENTS.md, README, test-plan §6 | Cookbook drift if §6 not updated |

**Prerequisites:** Docker (local Supabase), `.env` with local anon key, `npx supabase start`.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Local Supabase must be running for `npm test` — acceptable until Phase 4 adds CI Supabase.
- PostgREST may return empty data vs error for blocked ops — tests assert outcomes, not error codes.
- `@supabase/supabase-js` is transitive today; pin or add explicit devDependency if import resolution fails.

## Success Criteria (Summary)

- `npm test` green after `db reset` with two seed users.
- Breaking an RLS policy causes test failure.
- `test-plan.md` §6 documents the RLS integration pattern for future rollouts.
