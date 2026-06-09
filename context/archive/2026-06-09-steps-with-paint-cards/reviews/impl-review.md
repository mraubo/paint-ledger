<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Steps with Paint Cards

- **Plan**: context/changes/steps-with-paint-cards/plan.md
- **Scope**: All 3 phases (full plan review)
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Automated Verification

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | Exit 0 |
| `npm run build` | PASS | Exit 0 |

## Findings

### F1 — Inline paint create error redirect drops query param

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/entries/[id]/paints/index.ts:56
- **Detail**: Validation errors (lines 37–38) correctly use `?` vs `&` when `redirectTo` already contains `?edit=`. The DB insert-error path on line 56 always appends `?error=`, producing malformed URLs like `/entries/{id}/steps?edit={stepId}?error=…` so the user may not see the failure message during inline paint add from step edit.
- **Fix**: Reuse the separator logic from lines 37–38: `const separator = errorRedirectBase.includes("?") ? "&" : "?";` before appending `error=`.
- **Decision**: FIXED

### F2 — Multi-step mutations are not atomic

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/entry-steps-mutations.ts:20–38, 60–70, 85–113; src/pages/api/entries/[id]/steps/[stepId].ts:60–75; src/pages/api/entries/[id]/steps/[stepId]/delete.ts:46–54
- **Detail**: Assignment sync deletes all rows then inserts (partial wipe if insert fails). Step description updates before assignment sync (description can persist while assignments fail). Delete runs before renumber (gap if renumber fails). Position swap uses three sequential updates with a temp `-1` slot (corrupt state if mid-sequence fails). All acceptable at MVP hobby scale but violate data-integrity expectations if a request aborts mid-flight.
- **Fix A ⭐ Recommended**: Add Postgres RPC functions (or Supabase transactions) for sync, swap, delete+renumber — one round-trip each, atomic at DB level.
  - Strength: Eliminates partial-state class entirely; matches how production apps handle junction + position logic.
  - Tradeoff: Requires a migration + RPC wiring; more upfront work than call-site patches.
  - Confidence: HIGH — standard pattern for multi-row updates in Postgres.
  - Blind spot: Haven't verified whether Supabase JS client transaction support is available without RPC in this project's setup.
- **Fix B**: Accept risk for MVP; document in plan epilogue and add retry/rollback only on the highest-risk path (assignment sync).
  - Strength: Ships faster; hobby-scale traffic makes mid-flight failures rare.
  - Tradeoff: Leaves integrity holes; harder to fix once users have data.
  - Confidence: MEDIUM — acceptable if manual QA passes and user count stays small.
  - Blind spot: No monitoring to detect partial failures in production.
- **Decision**: FIXED via Fix A (Postgres RPC migration `20260609140700_step_mutation_rpcs.sql`)

### F3 — Concurrent step creates can collide on position

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/entries/[id]/steps/index.ts:11–19, 51
- **Detail**: `nextStepPosition` reads `max(position)+1` without locking. Two simultaneous creates can attempt the same position and hit `UNIQUE(entry_id, position)`, surfacing a generic DB error to one user.
- **Fix**: Retry once on unique-violation, or use a single SQL `INSERT … SELECT COALESCE(MAX(position),0)+1` inside a transaction/RPC.
- **Decision**: FIXED via `create_step_at_next_position` RPC (entry row lock + atomic insert)

### F4 — wrangler.jsonc change outside S-04 scope

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: wrangler.jsonc:11–21
- **Detail**: `run_worker_first` exclusions for Vite dev paths (`!/@*`, `!/node_modules/*`, etc.) are infra tuning unrelated to steps/paints feature. Already committed separately (`46aa33f`) but not documented in plan.
- **Fix**: Add a one-line addendum to the plan noting the dev-asset exclusion fix, or cherry-pick/rebase so it lands on a separate chore commit on main.
- **Decision**: SKIPPED

### F5 — Phase 2/3 manual verification still pending

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/steps-with-paint-cards/plan.md:420–437
- **Detail**: Automated checks pass for all phases. Phase 1 manual items are marked `[x]` with commit SHAs. Phase 2 manual (2.3–2.6) and Phase 3 manual (3.3–3.6) remain unchecked — UI flows, empty states, cross-navigation, and middleware redirect have not been recorded as verified.
- **Fix**: Run the manual test checklist from plan §Testing Strategy before merge; mark Progress items with evidence or note blockers.
- **Decision**: FIXED — user confirmed manual testing passed; Progress items 2.3–2.6 and 3.3–3.6 marked complete

### F6 — Edit view footer missing "Back to entries"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/entries/[id]/steps.astro:118–130
- **Detail**: List view footer includes "Back to entries" (line ~260). Edit view footer stops at "Back to entry" — plan contract (line 307) listed all three footer links for both views.
- **Fix**: Add "Back to entries" link to edit-view footer, matching list view.
- **Decision**: FIXED
