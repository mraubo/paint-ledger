<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Entry List and Detail Recall (S-06)

- **Plan**: context/changes/entry-list-and-detail/plan.md
- **Scope**: All 3 phases
- **Date**: 2026-06-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING ⚠️ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | PASS ✅ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ |

## Findings

### F1 — Step card element order differs from plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/entries/EntryStepReadOnly.astro
- **Detail**: Plan specified position → description → photo → paint cards. Implementation renders position → photo → paint cards → description to match the user-requested card mockup (200px photo, card grid layout).
- **Fix**: Document as an intentional UI addendum in the plan, or reorder to match the original plan if the mockup layout is no longer preferred.
- **Decision**: FIXED — documented in plan Implementation addendum

### F2 — Status-change POST relies on framework CSRF only

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/entries/[id]/status-change.ts, src/pages/entries/[id]/edit.astro
- **Detail**: New status-change forms use cookie session POST without explicit CSRF tokens. Matches existing mutation pattern (`final-photo`, paint/step delete forms) and Astro same-origin CSRF defaults.
- **Fix**: Accept for MVP parity with existing handlers; document curl testing with `Origin` header per lessons.md.
- **Decision**: FIXED — documented in plan Implementation addendum

### F3 — TOCTOU window on draft → ready transition

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/entries-api.ts:113-142
- **Detail**: `changeEntryStatus` reads `final_photo_path` then updates in two steps. A concurrent final-photo delete between SELECT and UPDATE could theoretically allow ready without a photo.
- **Fix A ⭐ Recommended**: Defer — hobby-scale risk; gate is already enforced server-side at mutation time for normal flows.
  - Strength: No migration or RPC needed; matches current app complexity.
  - Tradeoff: Edge-case race remains under concurrent edits.
  - Confidence: HIGH — same read-then-update pattern used elsewhere in the app.
  - Blind spot: Haven't load-tested concurrent photo delete + mark-ready.
- **Fix B**: Single conditional UPDATE (`WHERE final_photo_path IS NOT NULL`) or Postgres RPC.
  - Strength: Eliminates TOCTOU class.
  - Tradeoff: Extra SQL complexity for a rare edge case.
  - Confidence: MED — requires migration or raw SQL.
  - Blind spot: RPC error messaging vs current redirect flow.
- **Decision**: SKIPPED — deferred per Fix A (hobby-scale acceptable risk)

### F4 — Step count batch query transfers all step rows

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/entries-page.ts:41-51
- **Detail**: Plan explicitly specified in-memory aggregation after batch-fetching `steps(entry_id)`. Implementation matches plan; may hit PostgREST row caps at very large scale.
- **Fix**: Replace with SQL `COUNT`/`GROUP BY` when list scale grows beyond hobby use.
- **Decision**: FIXED — per-entry head COUNT queries instead of fetching all step rows

### F5 — Edit hub lacks link back to read-only detail

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/entries/[id]/edit.astro:170-176
- **Detail**: Detail page has "Edit entry" CTA; edit footer links to paints/steps/list but not to `/entries/[id]` recall view.
- **Fix**: Add "View entry" link in edit footer pointing to `/entries/${entry.id}`.
- **Decision**: FIXED — added View entry footer link

### F6 — Shared `?error=` param on edit page forms

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/pages/entries/[id]/edit.astro:36,98,112
- **Detail**: Status-change, basics, and final-photo errors all use the same `?error=` query param. A status failure could surface in unrelated form components.
- **Fix**: Scope errors per section (`?status_error=`, etc.) or render status errors only in the Status section.
- **Decision**: FIXED — status failures use `?status_error=` rendered in Status section only
