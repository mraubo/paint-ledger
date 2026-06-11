<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Runner Bootstrap and RLS Floor

- **Plan**: context/changes/testing-runner-bootstrap-rls-floor/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-06-11
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical, 3 warnings, 2 observations — all FIXED

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (post-triage) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated verification (re-run 2026-06-11)

| Command | Result |
|---------|--------|
| `npm test` | PASS — 8 tests green |
| `npm run lint` | PASS |
| `npm run build` | PASS |

## Findings

### F1 — Test helper does not reject service_role key

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/helpers/supabase-client.ts:6-14
- **Detail**: `getSupabaseEnv()` accepts any `SUPABASE_KEY`. A `service_role` JWT bypasses RLS, so the isolation suite could pass while production (anon key) would leak cross-user data. Plan explicitly forbids `service_role` in tests but does not enforce it.
- **Fix**: In `requireLocalSupabase()`, base64-decode the JWT payload and throw unless `role === "anon"`, with a message pointing at `.env` `SUPABASE_KEY`.
  - Strength: Catches the highest-impact misconfiguration before any assertion runs.
  - Tradeoff: Minor helper code; assumes standard Supabase JWT shape.
  - Confidence: HIGH — anon vs service_role is documented Supabase behavior.
  - Blind spot: Custom/local keys without a `role` claim would need a fallback rule.
- **Decision**: FIXED

### F2 — Health check does not require local Supabase host

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/helpers/supabase-client.ts:36-48
- **Detail**: `requireLocalSupabase()` only calls `/auth/v1/health`. If `.env` points at a hosted project, tests could mutate or read remote data (seed users are predictable). README and seed header warn local-only, but the harness does not enforce it.
- **Fix**: Reject `SUPABASE_URL` hostnames outside `localhost` / `127.0.0.1` (and optional `host.docker.internal`) in `requireLocalSupabase()`.
  - Strength: Aligns runtime guard with documented local-only intent.
  - Tradeoff: Blocks intentional remote integration runs unless env is relaxed later.
  - Confidence: HIGH — plan and research target local stack only.
  - Blind spot: CI Phase 4 may need a different guard strategy.
- **Decision**: FIXED

### F3 — Cross-owner insert assertion can throw on null data

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/rls-isolation.test.ts:150
- **Detail**: `expect(error !== null || data.length === 0)` assumes `data` is always an array. If PostgREST returns `{ data: null, error: null }`, the test throws `TypeError` instead of failing with a clear RLS assertion.
- **Fix**: Replace with `expect(error).not.toBeNull()` or `expect(data ?? []).toHaveLength(0)`.
- **Decision**: FIXED

### F4 — No unfiltered SELECT enumeration case for user B

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/integration/rls-isolation.test.ts:45-50
- **Detail**: Case 2 filters by A's entry id. A broken `SELECT` policy that leaks rows only via list queries would not be caught. F-01 manual smoke often included both targeted and broad reads.
- **Fix**: Add `clientB.from("entries").select("id")` and assert A's entry id is absent from results.
- **Decision**: FIXED

### F5 — signInAs signature differs from plan text

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/helpers/supabase-client.ts:28
- **Detail**: Plan documents `signInAs(email, password)`; implementation uses `signInAs(client, email, password)` for isolated dual clients. `test-plan.md` §6.2 documents the actual API. Intent is met; plan contract text is stale.
- **Fix**: Update plan Phase 1 helper contract to `(client, email, password)` on next plan edit, or leave as-is since cookbook is correct.
- **Decision**: FIXED
