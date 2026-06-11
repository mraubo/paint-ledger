# Runner Bootstrap and RLS Floor Implementation Plan

## Overview

Deliver test rollout Phase 1 (`context/foundation/test-plan.md`): bootstrap **Vitest**, add a **second local seed user**, and ship **automated RLS integration tests** that prove owner-only isolation on all four paint-log tables (risks **#1**, **#7**). Replaces F-01's manual two-user smoke with a repeatable `npm test` gate against local Supabase.

## Current State Analysis

**Already in place:**

- Four RLS-protected tables + junction trigger in `supabase/migrations/20260608103251_paint_log_schema.sql`.
- One seed user + full fixture entry in `supabase/seed.sql` (`seed@paint-ledger.local`).
- Typed anon SSR client in `src/lib/supabase.ts`; app queries use anon key — RLS is the row filter.
- F-01 manual RLS contract documented in `context/archive/2026-06-08-paint-log-schema-rls/plan.md` Phase 3.
- `supabase` CLI as devDependency; `npx supabase db reset` documented in README.

**Gaps:**

- No Vitest, no `npm test`, no `*.test.ts` files.
- Seed has only **one** user — cross-user tests need user B.
- CI runs lint + build only; test gate deferred to rollout Phase 4.

### Key Discoveries:

- Research confirms cheapest layer: Vitest + `createClient` (anon) against local Supabase — not HTTP, not service role (`context/changes/testing-runner-bootstrap-rls-floor/research.md`).
- Tests must **not** import `astro:env/server`; use `vitest.config.ts` + `loadEnv` from `.env`.
- Step RPCs are `SECURITY INVOKER`; one negative RPC case adds low-cost signal beyond table DML.
- `@supabase/supabase-js` is available transitively via `@supabase/ssr`; import it directly in test helpers.

## Desired End State

After this change:

- `npm test` runs Vitest integration tests that **fail fast** if local Supabase is unreachable.
- `supabase/seed.sql` includes a **second dev user** (no entries) for deterministic cross-user tests.
- `tests/integration/rls-isolation.test.ts` asserts F-01's two-user contract on `entries`, `entry_paints`, `steps`, `step_paint_assignments` using user A (seed fixture) and user B (empty account).
- `AGENTS.md` and README document `npm test` prerequisites (`supabase start` + `db reset`).
- `context/foundation/test-plan.md` §6.1, §6.2, §6.5 filled with cookbook patterns from this rollout.
- `npm run lint` and `npm run build` still pass.

### Verification

- `npx supabase db reset` → `npm test` → all RLS tests green.
- Deliberately breaking one SELECT policy locally → at least one test fails (sanity check during implement).
- User B cannot read or mutate user A's fixture rows; user A cannot insert an entry with another user's `user_id`.

## What We're NOT Doing

- CI test job (rollout Phase 4: `testing-quality-gates-wiring`).
- HTTP middleware / API IDOR tests (rollout Phase 2).
- Storage `entry-photos` RLS (rollout Phase 3, risk #4).
- Paint-invariant / detail-recall tests (rollout Phase 3).
- E2E or Playwright.
- `service_role` client in tests.
- Testing generated `database.types.ts` or UI primitives (test-plan §7 negative space).

## Implementation Approach

Three phases: (1) Vitest harness + env loading, (2) seed user B + RLS integration suite, (3) docs + test-plan cookbook update. Keep tests in `tests/` (not colocated in `src/`) to avoid Astro bundling concerns. Use fixed UUIDs from seed for stable assertions.

## Critical Implementation Details

**Seed user B** must insert both `auth.users` and `auth.identities` rows (mirror user A pattern in `supabase/seed.sql`). Use a fixed UUID (`55555555-5555-4555-8555-555555555555`) and email `seed-b@paint-ledger.local` with the same password as user A for local dev simplicity.

**RLS test oracle** comes from F-01 contract + PRD FR-002 (observable empty/error outcomes), not from re-asserting policy SQL text.

**Cross-user UPDATE assertions**: PostgREST may return success with zero rows or a permission error depending on operation — assert **no data leaked** (empty `data`, zero `count`, or error), not a specific error code unless stable in local testing.

## Phase 1: Vitest harness

### Overview

Add Vitest, config with path aliases and env loading, `npm test` script, and a shared Supabase test client helper with a local-stack health guard.

### Changes Required:

#### 1. Dev dependency and scripts

**File**: `package.json`

**Intent**: Make `npm test` the entry point for the new suite.

**Contract**: Add `vitest` to `devDependencies`; add scripts `"test": "vitest run"` and `"test:watch": "vitest"`.

#### 2. Vitest configuration

**File**: `vitest.config.ts` (new)

**Intent**: Run Node integration tests with project path aliases and Supabase env vars from `.env`.

**Contract**: `environment: 'node'`; `include: ['tests/**/*.test.ts']`; resolve `@/*` → `./src/*`; use Vite `loadEnv(mode, process.cwd(), '')` so `SUPABASE_URL` and `SUPABASE_KEY` load from `.env` (same vars as local dev per README).

#### 3. Test Supabase client helper

**File**: `tests/helpers/supabase-client.ts` (new)

**Intent**: Create typed anon clients for tests without `astro:env`.

**Contract**:

- Export `createTestClient()` using `createClient<Database>` from `@supabase/supabase-js` with `Database` from `@/lib/database.types`.
- Export `signInAs(email, password)` wrapping `auth.signInWithPassword`.
- Export `requireLocalSupabase()` for `beforeAll`: if `SUPABASE_URL` / `SUPABASE_KEY` missing or auth health check fails, throw with message: run `npx supabase start && npx supabase db reset`.

#### 4. Seed constants module

**File**: `tests/helpers/seed-fixtures.ts` (new)

**Intent**: Centralize fixed UUIDs and credentials from `supabase/seed.sql` so tests don't scatter magic strings.

**Contract**: Export user A/B emails, passwords, user IDs, entry ID, paint IDs, step IDs from seed comments.

### Success Criteria:

#### Automated Verification:

- `npm test` runs (may exit 0 with no tests yet, or run a trivial smoke test file if added in this phase)
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- `npm run test:watch` discovers files under `tests/` when a placeholder test exists

**Implementation Note**: Pause for human confirmation after Phase 1 automated checks pass.

---

## Phase 2: Second seed user and RLS integration suite

### Overview

Extend local seed with user B and implement the full two-user RLS contract as Vitest integration tests.

### Changes Required:

#### 1. Second seed user

**File**: `supabase/seed.sql`

**Intent**: Provide a deterministic second account for cross-user tests without depending on sign-up or email confirmation settings.

**Contract**: Insert `auth.users` + `auth.identities` for `seed-b@paint-ledger.local` / `seed-password-123` / UUID `55555555-5555-4555-8555-555555555555`. No fixture rows for user B. Update seed header comment with user B credentials.

#### 2. RLS isolation integration tests

**File**: `tests/integration/rls-isolation.test.ts` (new)

**Intent**: Automate F-01 Phase 3 contract for risks #1 and #7.

**Contract** — each case uses separate authenticated clients for user A and user B:

| # | Actor | Action | Assert |
|---|-------|--------|--------|
| 1 | A | `select` from `entries` | Returns seed fixture row |
| 2 | B | `select` from `entries` where id = A's entry | Empty |
| 3 | B | `update` / `delete` on A's entry | No effect / error |
| 4 | B | `insert` into `entry_paints` with A's `entry_id` | Rejected or 0 rows |
| 5 | B | `update` / `delete` on A's paints, steps, assignments | No effect / error |
| 6 | A | `insert` into `entries` with `user_id` = B's id | Rejected (WITH CHECK) |
| 7 | B | `rpc('delete_step_and_renumber', { p_entry_id: A's entry, p_step_id: A's step })` | Error or no mutation visible to A |

Use fixture UUIDs from `tests/helpers/seed-fixtures.ts`. Do not assert policy names or SQL text.

#### 3. README seed table

**File**: `README.md`

**Intent**: Document second seed user for RLS tests.

**Contract**: Add row to seed user table for `seed-b@paint-ledger.local`.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` succeeds
- `npm test` passes with local Supabase running
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Temporarily weaken one SELECT policy → `npm test` fails → revert policy

**Implementation Note**: Pause for human confirmation after manual policy-break sanity check.

---

## Phase 3: Docs, AGENTS.md, and test-plan cookbook

### Overview

Document how to run tests, update agent rules, and fill test-plan §6 patterns per rollout orchestrator constraint.

### Changes Required:

#### 1. AGENTS.md test section

**File**: `AGENTS.md`

**Intent**: Agents know `npm test` exists and its prerequisites.

**Contract**: Replace "No test suite yet" with: run `npx supabase start && npx supabase db reset` before `npm test`; integration tests use local anon key from `.env`; CI wiring is Phase 4 of test-plan.

#### 2. README testing subsection

**File**: `README.md`

**Intent**: Human developers can run the RLS suite without reading the change folder.

**Contract**: Short subsection under database docs: prerequisites, `npm test`, what the suite proves, link to `tests/integration/rls-isolation.test.ts`.

#### 3. Test-plan cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Rollout Phase 1 final deliverable — §6 patterns for future tests.

**Contract**:

- §6.1: unit test location/naming (defer examples until unit tests exist; note integration-first rollout).
- §6.2: integration test location `tests/integration/`, helper `tests/helpers/supabase-client.ts`, run `npm test`.
- §6.5: after migration/RLS change, extend `rls-isolation.test.ts` or add case; run `db reset` + `npm test`.
- §6.6: one note that Phase 1 landed two-user RLS smoke.
- §4 Stack table: Vitest version filled in.
- Bump "Last updated" header date.

#### 4. Optional npm script convenience

**File**: `package.json`

**Intent**: Reduce friction for DB + test loop (optional, only if it stays one line).

**Contract**: Optional `"db:reset": "supabase db reset"` — skip if YAGNI.

### Success Criteria:

#### Automated Verification:

- `npm test` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Fresh agent reading `AGENTS.md` + `test-plan.md` §6 can locate RLS test pattern without searching the repo

---

## Testing Strategy

### Unit Tests

None in Phase 1 — integration tests target the actual RLS boundary.

### Integration Tests

- `tests/integration/rls-isolation.test.ts` — full two-user matrix on four tables + one RPC negative case.
- Helpers in `tests/helpers/` — not counted as tests.

### Manual Testing Steps

1. `npx supabase start` → `npx supabase db reset`.
2. `npm test` — all green.
3. Break one policy → `npm test` fails → restore.
4. Optional: `npx supabase db advisors --local` — no new ERROR-level findings on four tables.

## Performance Considerations

RLS integration suite is small (dozen assertions); subquery policies acceptable at MVP scale per F-01 plan.

## Migration Notes

- `seed.sql` auth inserts are **local only** — never run against production.
- After seed change, developers must `db reset` before `npm test`.
- CI Supabase provisioning deferred to rollout Phase 4.

## References

- Research: `context/changes/testing-runner-bootstrap-rls-floor/research.md`
- Test plan: `context/foundation/test-plan.md` §3 Phase 1
- F-01 RLS contract: `context/archive/2026-06-08-paint-log-schema-rls/plan.md` Phase 3
- RLS policies: `supabase/migrations/20260608103251_paint_log_schema.sql:134-366`
- Seed: `supabase/seed.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Vitest harness

#### Automated

- [x] 1.1 `npm test` runs (Vitest discovers `tests/`) — 0ae5a1d
- [x] 1.2 `npm run lint` passes — 0ae5a1d
- [x] 1.3 `npm run build` passes — 0ae5a1d

#### Manual

- [x] 1.4 `npm run test:watch` discovers test files under `tests/` — 0ae5a1d

### Phase 2: Second seed user and RLS integration suite

#### Automated

- [x] 2.1 `npx supabase db reset` succeeds — 448babd
- [x] 2.2 `npm test` passes with local Supabase running — 448babd
- [x] 2.3 `npm run lint` passes — 448babd
- [x] 2.4 `npm run build` passes — 448babd

#### Manual

- [x] 2.5 Weakened SELECT policy causes `npm test` to fail; policy restored — 448babd

### Phase 3: Docs, AGENTS.md, and test-plan cookbook

#### Automated

- [x] 3.1 `npm test` passes — 814981d
- [x] 3.2 `npm run lint` passes — 814981d
- [x] 3.3 `npm run build` passes — 814981d

#### Manual

- [x] 3.4 AGENTS.md + test-plan §6 point to RLS integration pattern without repo search — 814981d
