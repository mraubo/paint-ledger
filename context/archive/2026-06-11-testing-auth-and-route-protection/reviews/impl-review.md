<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth and Route Protection

- **Plan**: `context/changes/testing-auth-and-route-protection/plan.md`
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-06-11
- **Verdict**: APPROVED (after triage fixes)
- **Findings**: 0 critical, 4 warnings, 3 observations — 5 fixed, 2 skipped

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (post-triage) |
| Architecture | PASS |
| Pattern Consistency | PASS (post-triage) |
| Success Criteria | PASS |

## Automated verification

| Command | Result |
|---------|--------|
| `npm run lint` | PASS |
| `npm test` | PASS — 18 tests |
| `npm run build` | PASS |

Manual Progress items: all `[x]` with commit SHAs; user confirmed 1.4, 2.5, 3.4 in session.

## Findings

### F1 — HTTP helper lacks local-only APP_URL guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `tests/helpers/http-client.ts:3-4`
- **Detail**: `APP_BASE_URL` accepts any `APP_URL`. `tests/helpers/supabase-client.ts` rejects non-local Supabase hosts; HTTP helpers do not. A mis-set `.env` could send seed credentials to a non-local server during `npm test`.
- **Fix**: Add `assertLocalAppUrl()` mirroring `assertLocalSupabaseUrl()` (allow `localhost`, `127.0.0.1`, `host.docker.internal`); call from `requireDevServer()` or module init.
  - Strength: Parity with Phase 1 RLS guard; fail-fast before auth probes.
  - Tradeoff: Slightly stricter local dev if someone used a custom tunnel hostname.
  - Confidence: HIGH — pattern exists in `supabase-client.ts`.
  - Blind spot: None significant for test-only code.
- **Decision**: FIXED

### F2 — signInViaHttp does not verify successful auth redirect

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: `tests/helpers/http-client.ts:59-75`
- **Detail**: Success is inferred from any `Set-Cookie`. Failed sign-in that still sets cookies could produce a session string that makes downstream tests flaky or misleading.
- **Fix**: After POST, assert status `302`/`303` and `Location` pathname is `/entries` (or throw with status + location).
- **Decision**: FIXED

### F3 — IDOR oracle accepts `/auth/signin` as denial

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `tests/integration/auth-route-protection.test.ts:46-51`
- **Detail**: `expectRedirectDenial()` passes when pathname is `/auth/signin`. For authenticated User B IDOR cases, a broken cookie (auth failure) satisfies the assertion without proving cross-user denial.
- **Fix A ⭐ Recommended**: Add `expectCrossUserRedirectDenial()` for Risk #6 — require `error=` in `Location` (entry-not-found semantics); keep `expectRedirectToSignIn` for Risk #3 only.
  - Strength: Matches test-plan §2 redirect-denial contract for cross-user cases.
  - Tradeoff: Tests fail if product ever returns a different denial shape.
  - Confidence: HIGH — research grounded redirect contract.
  - Blind spot: None if app behavior is stable.
- **Fix B**: Assert sign-in redirect never occurs when cookie was obtained via `signInViaHttp` in same test.
  - Strength: Catches cookie propagation bugs.
  - Tradeoff: Does not strengthen cross-user semantics alone.
  - Confidence: MEDIUM.
  - Blind spot: Session could be valid but wrong user.
- **Decision**: FIXED (Fix A)

### F4 — User B GET allows HTTP 200 without title

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `tests/integration/auth-route-protection.test.ts:103-112`
- **Detail**: Branch accepts `200` when body omits seed title. Plan/research expect redirect denial; a `200` could still leak other entry metadata.
- **Fix**: Require redirect with `error=` (or non-200), matching detail page behavior from research.
- **Decision**: FIXED (covered by F3)

### F5 — Paints/status IDOR tests lack DB oracle

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `tests/integration/auth-route-protection.test.ts:135-156`
- **Detail**: Update case verifies DB unchanged; paints and status-change cases assert redirect only. Redirect bug + persisted mutation would be missed (RLS floor may still catch at DB layer in separate file).
- **Fix**: Optional post-assert: paint count / entry status unchanged for User A (mirror update test).
- **Decision**: FIXED

### F6 — Per-test HTTP sign-in overhead

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `tests/integration/auth-route-protection.test.ts:78-80, 99-101`
- **Detail**: `beforeEach` sign-in (~6 POSTs/run). Introduced to fix parallel flakiness; acceptable tradeoff at current suite size.
- **Fix**: Document in test file comment why `beforeEach` vs `beforeAll`.
- **Decision**: FIXED (comment)

### F7 — Rollout status still `implementing` in test-plan §3

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/foundation/test-plan.md:71`
- **Detail**: Phase 2 row is `implementing`; plan says `complete` when archived via `/10x-archive`. Expected pre-archive state.
- **Fix**: Run `/10x-archive testing-auth-and-route-protection` after merge.
- **Decision**: SKIPPED (defer to post-merge archive)
