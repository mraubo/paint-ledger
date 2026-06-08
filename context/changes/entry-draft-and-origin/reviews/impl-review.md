<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Entry Draft and Origin

- **Plan**: context/changes/entry-draft-and-origin/plan.md
- **Scope**: Phases 1–3 of 3 (all completed)
- **Date**: 2026-06-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Update handler lacks explicit user_id filter

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/entries/[id].ts:28-37
- **Detail**: Update scopes only by `id`, not `user_id`. Authorization relies entirely on RLS (`entries_update_own`). Plan states "scoped to id + session user." Safe with correct RLS; brittle if RLS is misconfigured or a service-role key is used.
- **Fix**: Add `.eq("user_id", user.id)` to the update query for defense-in-depth.
- **Decision**: FIXED — added `.eq("user_id", user.id)` defense-in-depth filter

### F2 — List load errors shown as empty state

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/entries-page.ts:23-25
- **Detail**: `loadEntryList` returns `[]` on any Supabase error, indistinguishable from "user has no entries." Transient DB/network failures show a misleading empty state with "Create entry" CTA.
- **Fix**: Return a discriminated result (`{ ok: true, entries } | { ok: false, error }`) and render an error banner on `entries/index.astro` instead of empty state.
- **Decision**: FIXED — discriminated `EntryListResult` + error banner on list page

### F3 — No server-side field length limits

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/entries-api.ts:27-41
- **Detail**: No max-length validation on `title`, `description`, `model_info`, or `model_origin_note`. DB columns are unbounded `text`; a client can POST very large payloads.
- **Fix**: Add reasonable server-side limits in `parseEntryBasicsFormData` (e.g. title 200 chars, notes 5–10k) and reject with redirect error.
- **Decision**: FIXED — max-length validation in parseEntryBasicsFormData (title 200, text fields 10k)

### F4 — Update not-found uses raw PostgREST error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/entries/[id].ts:40-41
- **Detail**: Plan specifies "zero rows → redirect with not-found error." Implementation relies on `.single()` failure and redirects with raw `error.message` (e.g. PGRST116) instead of a user-facing "Entry not found" message.
- **Fix**: Detect zero-row update / PGRST116 and redirect with `encodeURIComponent("Entry not found")`.
- **Decision**: FIXED — zero-row update redirects with "Entry not found" via maybeSingle

### F5 — Created banner trusts UUID format only

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/entries/index.astro:10-11
- **Detail**: `?created=<uuid>` shows "Entry created" after UUID format check only; does not verify the entry exists or belongs to the current user. Crafted URL can show a false success banner.
- **Fix**: Optionally verify row exists via `loadEntryForEdit` before showing banner.
- **Decision**: SKIPPED

### F6 — Raw DB errors in query param

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/entries/index.ts:36, src/pages/api/entries/[id].ts:41
- **Detail**: Raw Supabase `error.message` reflected in `?error=` query param. May expose internal PostgREST details. Matches existing `signin.ts` auth pattern.
- **Fix**: Map known errors to user-safe messages; log raw errors server-side only.
- **Decision**: FIXED — toUserFacingDbError helper maps DB errors to safe message, logs raw server-side

### F7 — No CSRF tokens on native POST forms

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/components/entries/EntryBasicsForm.tsx:63
- **Detail**: Native `method="POST"` forms have no CSRF token. Cookie-session auth is vulnerable to cross-site POST if cookies are sent. Same pattern as `SignInForm`; create/update are state-changing.
- **Fix A ⭐ Recommended**: Accept for MVP parity with auth; document as known limitation for production hardening.
  - Strength: No new infrastructure; consistent with S-01 auth pattern.
  - Tradeoff: CSRF risk remains until hardened.
  - Confidence: HIGH — plan explicitly chose form POST + redirect pattern.
  - Blind spot: Haven't verified cookie SameSite settings.
- **Fix B**: Add CSRF token middleware and hidden field before production.
  - Strength: Closes CSRF class for all form mutations.
  - Tradeoff: New pattern not used elsewhere yet; scope expansion.
  - Confidence: MEDIUM — depends on deployment cookie policy.
  - Blind spot: Cloudflare Workers session cookie config not verified.
- **Decision**: ACCEPTED (Fix A) — MVP parity with auth; CSRF hardening parked in roadmap.md

### F8 — Unplanned eslint.config.js change

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:68-69
- **Detail**: Disables `@typescript-eslint/no-misused-promises` for `*.astro` files (parser crash on `return Astro.redirect()`). Not in plan but required for `[id].astro` to lint.
- **Fix**: Document in plan addendum as tooling prerequisite for Phase 3.
- **Decision**: FIXED — documented in plan.md addendum
