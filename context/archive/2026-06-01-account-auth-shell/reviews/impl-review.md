<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Account Auth Shell

- **Plan**: context/changes/account-auth-shell/plan.md
- **Scope**: Phase 1–2 of 2 (all completed)
- **Date**: 2026-06-02
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Register `/api/entries` when APIs ship

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:4-29
- **Detail**: `PROTECTED_ROUTES` only guards page paths via `pathname.startsWith("/entries")`. Future `/api/entries/*` handlers will not be protected unless explicitly added or each handler validates the session. Plan defers API routes to later slices; this is a forward-looking guardrail, not a defect in S-01.
- **Fix**: When S-02+ adds entry APIs, add `/api/entries` to `PROTECTED_ROUTES` or enforce auth inside each handler (match whichever pattern the slice chooses).
- **Decision**: FIXED — added middleware comment as reminder for S-02+ APIs

### F2 — README omits guest-only auth redirect

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: README.md:157-166
- **Detail**: README documents `/entries` protection but not `AUTH_ONLY_GUEST_ROUTES` behavior (logged-in users redirected away from `/auth/signin` and `/auth/signup`). Implementation matches plan; discoverability gap only.
- **Fix**: Add one sentence under "Auth routes" describing guest-only redirect to `/entries` when already signed in.
- **Decision**: FIXED

### F3 — Server-side sign-in field validation (pre-existing pattern)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:7-8
- **Detail**: `form.get("email")` / `password` are cast with `as string` without null/type checks before `signInWithPassword`. Identical pattern in `signup.ts`; not introduced by this slice. Low risk while client forms require fields.
- **Fix**: Reject with a redirect error if either field is missing or not a string (apply to both signin and signup for consistency).
- **Decision**: FIXED — validation added to signin.ts and signup.ts

## Automated verification (review run)

| Command | Result |
|---------|--------|
| `npm run lint` | PASS (exit 0) |
| `npm run build` | PASS (exit 0, secrets from `.dev.vars`) |

## Plan drift summary

All 7 planned items: **MATCH** (middleware, signin redirect, dashboard removed, AppLayout, entries page, Topbar, README). Commit extras limited to `context/changes/account-auth-shell/*` (expected 10x workflow).
