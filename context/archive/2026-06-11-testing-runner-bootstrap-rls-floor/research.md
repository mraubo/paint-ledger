---
date: 2026-06-11T00:00:00+02:00
researcher: Cursor Agent
git_commit: 1137cac7501c06679d9841c1b3b0b1acfd1545a2
branch: testing-runner-bootstrap-rls-floor
repository: paint-ledger
topic: "Rollout Phase 1 — Vitest bootstrap and RLS floor (risks #1, #7)"
tags: [research, testing, rls, supabase, vitest, migrations]
status: complete
last_updated: 2026-06-11
last_updated_by: Cursor Agent
---

# Research: Rollout Phase 1 — Vitest bootstrap and RLS floor

**Date**: 2026-06-11
**Researcher**: Cursor Agent
**Git Commit**: `1137cac7501c06679d9841c1b3b0b1acfd1545a2`
**Branch**: `testing-runner-bootstrap-rls-floor`
**Repository**: [mraubo/paint-ledger](https://github.com/mraubo/paint-ledger)

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md`: install a test runner and prove owner-only isolation at the database layer (risks **#1** cross-user entry access, **#7** migration/RLS policy drift). Verify or correct the test plan's risk response guidance; locate existing tests; identify the cheapest useful test layer; flag speculative risks.

## Summary

Paint Ledger has **no automated test suite** today (`package.json` has lint/build only; `AGENTS.md` documents manual auth checks). Data isolation is enforced primarily by **Postgres RLS** on four `public` tables, queried through the **anon-key SSR client** (`src/lib/supabase.ts`) — not by route middleware alone.

**Risk response guidance is confirmed** for Phase 1 scope: the cheapest high-signal layer is **Vitest integration tests** against a **local Supabase** stack (`npx supabase start` + `db reset`), using `signInWithPassword` for two distinct users and asserting cross-user SELECT/INSERT/UPDATE/DELETE fail or return empty on all four tables.

**Key gap for automation**: `supabase/seed.sql` seeds **one** auth user and one fixture entry. F-01's manual RLS contract required a **second user** (via sign-up). Automated tests should add a second seed user (deterministic UUID) or create user B in `beforeAll` via `auth.signUp`.

**Out of Phase 1 scope** (later rollout phases): HTTP route protection (#3), API IDOR error shapes (#6), storage policies (#4), paint-invariant UI (#2), detail recall loaders (#5). Step mutation **RPCs** are `SECURITY INVOKER` and rely on RLS — optional stretch assertion in Phase 1 that user B cannot mutate user A's entry via `.rpc()`, but not required by the test-plan risks list.

**Vitest setup constraint**: App code uses `astro:env/server` for secrets; tests should use a **standalone** `vitest.config.ts` + `loadEnv` / `.env` pointing at local Supabase (`http://127.0.0.1:54321` + anon key from `npx supabase status`), not import `createClient` from `src/lib/supabase.ts` without a test shim.

## Detailed Findings

### RLS model (four tables — Phase 1 target)

Migration [`supabase/migrations/20260608103251_paint_log_schema.sql`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/supabase/migrations/20260608103251_paint_log_schema.sql) defines:

| Table | Ownership pattern | Policies per operation |
|-------|-------------------|------------------------|
| `entries` | Direct `user_id = auth.uid()` | SELECT, INSERT, UPDATE (USING + WITH CHECK), DELETE |
| `entry_paints` | Subquery via parent `entries.user_id` | All four ops with USING + WITH CHECK on UPDATE |
| `steps` | Subquery via parent `entries.user_id` | All four ops with USING + WITH CHECK on UPDATE |
| `step_paint_assignments` | Join `steps` + `entry_paints` + `entries.user_id` | All four ops with USING + WITH CHECK on UPDATE |

RLS is enabled on all four tables (lines 134–137). `GRANT` gives `authenticated` full DML — **RLS is the only row filter**; there is no app-side service role bypass.

**Defense in depth**: `enforce_step_paint_same_entry` trigger blocks cross-entry paint assignment even if policies were misconfigured (lines 93–117).

**Risk #7 verification target**: After `npx supabase db reset`, three migrations apply (`paint_log_schema`, `entry_photo_storage`, `step_mutation_rpcs`). Phase 1 smoke should run against the **post-reset** schema, not superuser Studio sessions.

### Seed and second-user gap

[`supabase/seed.sql`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/supabase/seed.sql) documents intent: *"RLS smoke tests"* (line 2). It inserts:

- One `auth.users` row: `seed@paint-ledger.local` / `11111111-1111-4111-8111-111111111111`
- One complete fixture entry with paints, steps, and one assignment (fixed UUIDs)

**No second user** is seeded. Archived F-01 plan Phase 3 contract ([`context/archive/2026-06-08-paint-log-schema-rls/plan.md`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/context/archive/2026-06-08-paint-log-schema-rls/plan.md) lines 239–244) required user B created via sign-up. For CI-stable tests, **recommend extending `seed.sql` with a second user** (empty account, no entries) rather than depending on sign-up + email confirmation settings.

### App client and where RLS matters

[`src/lib/supabase.ts`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/src/lib/supabase.ts) creates a typed `createServerClient` with the **anon key** from `SUPABASE_URL` / `SUPABASE_KEY`. All `.from()` queries in `src/lib/*` and API routes inherit RLS.

Some handlers add **redundant** `.eq("user_id", userId)` (e.g. [`changeEntryStatus`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/src/lib/entries-api.ts#L107-L142)); others rely on RLS alone (e.g. list loaders in `entries-page.ts`). **Must challenge assumption**: middleware on `/entries/**` does not protect direct Data API access — only RLS does. Phase 1 tests should use the **same anon client** pattern as production, not service role.

`requireUser` ([`entries-api.ts:63-68`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/src/lib/entries-api.ts#L63-L68)) checks session presence only; it is irrelevant to Phase 1 DB tests.

### Step mutation RPCs (RLS applies, not Phase 1 must-have)

[`supabase/migrations/20260609140700_step_mutation_rpcs.sql`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/supabase/migrations/20260609140700_step_mutation_rpcs.sql) grants `EXECUTE` to `authenticated` only (lines 193–203). Functions are **not** `SECURITY DEFINER` — comment line 190 confirms invoker semantics. RPCs do not embed `auth.uid()` checks; isolation depends on RLS on underlying `steps` / `step_paint_assignments` / `entry_paints`.

Called from [`src/lib/entry-steps-mutations.ts`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/src/lib/entry-steps-mutations.ts) via `.rpc()`. Worth a follow-up test in Phase 3 (risk #2); optional in Phase 1.

### Storage RLS (out of Phase 1 scope)

[`supabase/migrations/20260608122840_entry_photo_storage.sql`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/supabase/migrations/20260608122840_entry_photo_storage.sql) adds `storage.objects` policies scoped by path `{user_id}/{entry_id}/...`. Covered by test-plan risk #4 in **Phase 3**, not Phase 1.

### Test infrastructure today

| Artifact | Status |
|----------|--------|
| `vitest` / `jest` / `playwright` in `package.json` | Absent |
| `*.test.ts` files | None |
| `npm test` script | Absent |
| CI (`.github/workflows/ci.yml`) | `lint` + `build` only |
| Documented manual RLS check | README + F-01 archive plan |

### Recommended Phase 1 test design (cheapest layer)

1. **Add devDependencies**: `vitest` (Vite 7 already in overrides).
2. **`vitest.config.ts`**: `environment: 'node'`, `include: ['src/**/*.test.ts', 'tests/**/*.test.ts']`, `loadEnv` for `SUPABASE_URL` / `SUPABASE_KEY` (or read from `npx supabase status -o env`).
3. **Test helper** `tests/helpers/supabase-client.ts`: `createClient<Database>(url, anonKey)` from `@supabase/supabase-js` (already a dependency via SSR) — **do not** import `astro:env/server`.
4. **Prerequisite guard**: `beforeAll` checks local API health (`/rest/v1/` or `auth.getSession()`); skip or fail fast with message to run `npx supabase start && npx supabase db reset`.
5. **RLS suite** (maps to F-01 contract + risk #1/#7):

   | Actor | Action | Expected |
   |-------|--------|----------|
   | User A (seed) | `select *` from `entries` | Sees own fixture row |
   | User B | `select` on A's `entry_id` | Empty / no rows |
   | User B | `update` / `delete` on A's rows (all 4 tables) | 0 rows affected or permission error |
   | User B | `insert` child row with A's `entry_id` | Rejected |
   | User A | `insert` entry with `user_id` ≠ A | Rejected (WITH CHECK) |

6. **Oracle source**: F-01 archive plan contract + PRD FR-002 — **not** copied from policy SQL text as tautology; assert observable empty/error outcomes.
7. **`npm test` script** added in Phase 1; CI wiring deferred to Phase 4 per test-plan.

### Risk response guidance — verification

| Risk | Guidance verdict | Notes |
|------|------------------|-------|
| #1 | **Confirmed** | RLS on 4 tables is the isolation boundary; anon SSR client is correct test surface |
| #7 | **Confirmed** | `db reset` + two-user smoke is the right gate; seed needs second user for determinism |
| Cheapest layer | **Confirmed** | Vitest + local Supabase integration; not e2e, not HTTP yet |
| Anti-pattern: happy-path owner only | **Valid** | Must sign in as user B for every cross-user case |
| Anti-pattern: superuser only | **Valid** | Never assert RLS via Studio SQL as postgres |
| "Middleware protects pages" | **Challenge upheld** | Middleware is route-layer; Phase 2 covers HTTP; Phase 1 is DB |

**No test-plan §2 corrections required** — hot-spot and evidence citations remain accurate.

## Code References

- `supabase/migrations/20260608103251_paint_log_schema.sql:134-366` — RLS enable + all policies
- `supabase/migrations/20260608103251_paint_log_schema.sql:93-117` — junction invariant trigger
- `supabase/seed.sql:20-161` — single seed user + fixture data
- `src/lib/supabase.ts:6-25` — anon SSR client factory
- `src/lib/entries-api.ts:107-142` — example explicit `user_id` filter (redundant with RLS)
- `supabase/migrations/20260609140700_step_mutation_rpcs.sql:189-203` — RPC grants to authenticated
- `src/lib/entry-steps-mutations.ts:33-116` — app RPC call sites
- `package.json:5-13` — no test scripts
- `.github/workflows/ci.yml:18-21` — CI lint + build only

## Architecture Insights

- **Isolation model**: `entries.user_id` is the single ownership source; child tables use subquery policies (no denormalized `user_id` on children). This matches F-01 plan-brief and is the correct focus for RLS tests.
- **Client key type**: README and deployment docs insist on **anon key only** — tests must mirror production and never use `service_role`.
- **Migrations are forward-only** three files; `db reset` is the local source of truth for schema drift detection.
- **Astro env boundary**: Test runner lives outside Astro's `astro:env` — plan must include a thin test env loader.

## Historical Context (from prior changes)

- [`context/archive/2026-06-08-paint-log-schema-rls/plan.md`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/context/archive/2026-06-08-paint-log-schema-rls/plan.md) — F-01 defined the two-user RLS smoke **contract** (manual); explicitly deferred automated tests.
- [`context/archive/2026-06-08-paint-log-schema-rls/plan.md`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/context/archive/2026-06-08-paint-log-schema-rls/plan.md) Phase 3 — `npx supabase db advisors --local` recommended once per schema change; can be a manual gate in Phase 1 implement or CI later.
- [`context/foundation/lessons.md`](https://github.com/mraubo/paint-ledger/blob/1137cac7501c06679d9841c1b3b0b1acfd1545a2/context/foundation/lessons.md) — `PROTECTED_ROUTES` lesson applies to Phase 2, not Phase 1.

## Related Research

- None prior under `context/changes/**/research.md` for testing.

## Open Questions

1. **Second user strategy**: Extend `seed.sql` vs runtime `signUp` in tests — seed extension is more deterministic for local + future CI; confirm before implement.
2. **CI Supabase in Phase 4**: GitHub Actions will need `supabase start` in CI or a dedicated test project — out of Phase 1 scope but note for Phase 4 planning.
3. **RPC cross-user calls**: Whether Phase 1 includes one negative `.rpc('delete_step_and_renumber', …)` case for user B on user A's entry — adds signal beyond table DML with low cost; optional stretch.
