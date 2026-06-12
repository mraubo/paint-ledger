<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Entry Workflow Integration Tests

- **Plan**: context/changes/testing-entry-workflow-integration/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Shared seed ENTRY_A mutation under parallel Vitest execution

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: tests/integration/entry-workflow-integration.test.ts:53–70, 190–225
- **Detail**: Workflow tests mutate shared seed `ENTRY_A` (assignments, descriptions, `storage_path`, `final_photo_path`) while Vitest runs integration files in parallel by default (`vitest.config.ts` has no `fileParallelism: false`). `rls-isolation.test.ts` reads the same seed concurrently — e.g. paint-count assertions can race with inline-add insert/delete window.
- **Fix A ⭐ Recommended**: Set `fileParallelism: false` for `tests/integration/**` in `vitest.config.ts` (or a dedicated sequential pool).
  - Strength: One-line config change; all integration files share seed safely without rewriting tests.
  - Tradeoff: Integration suite runs sequentially (~2.4s today — acceptable).
  - Confidence: HIGH — matches pattern used when tests share mutable seed state.
  - Blind spot: None significant at current suite size.
- **Fix B**: Move all mutating workflow tests to ephemeral entries (no `ENTRY_A` writes).
  - Strength: Keeps parallel execution; strongest isolation.
  - Tradeoff: Larger test rewrite; loader oracle tests need ephemeral seed data.
  - Confidence: MEDIUM — more work, but cleaner long-term.
  - Blind spot: Loader oracle assertions must be duplicated or parameterized for ephemeral data.
- **Decision**: FIXED via Fix A — `fileParallelism: false` in vitest.config.ts

### F2 — Unrelated S-07 prd/roadmap changes on branch

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: context/foundation/prd.md, context/foundation/roadmap.md (commit f4a577d)
- **Detail**: Branch includes `docs(S-07): add entry delete requirement and roadmap slice` — unrelated to test rollout Phase 3 deliverables.
- **Fix A ⭐ Recommended**: Split S-07 docs into a separate branch/PR before merge.
  - Strength: Keeps PR scope aligned with plan; easier review.
  - Tradeoff: Extra branch management.
  - Confidence: HIGH — standard scope discipline.
  - Blind spot: None if S-07 work is independent.
- **Fix B**: Document as intentional co-ship in PR description.
  - Strength: No git rework.
  - Tradeoff: Reviewers must untangle two changesets.
  - Confidence: MEDIUM — acceptable for small doc-only edits.
  - Blind spot: Future impl reviews may attribute S-07 to this change.
- **Decision**: FIXED via Fix A — reverted f4a577d (S-07 docs); cherry-pick to separate branch before merge

### F3 — Cross-entry paint via updateStepWithAssignments not tested

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/integration/entry-workflow-integration.test.ts:141–154
- **Detail**: Plan specified cross-entry paint blocked at both RPC sync and `updateStepWithAssignments`. Implementation covers RPC sync and trigger rejection; app-layer `updateStepWithAssignments` with foreign paint ID is not exercised.
- **Fix**: Add one test calling `updateStepWithAssignments` with `entryBPaintId` on `ENTRY_A` step and assert junction length 0.
- **Decision**: FIXED — added cross-entry updateStepWithAssignments test

### F4 — Inline paint row may leak on test failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/entry-workflow-integration.test.ts:190–225
- **Detail**: Inline paint created in `"keeps inline-added palette paints assignable to a step"` is only deleted at end of test. Failure after insert leaves extra `entry_paints` row on shared `ENTRY_A`.
- **Fix**: Wrap test body in `try/finally` (or track created paint IDs in file-level array cleaned in `afterAll`).
- **Decision**: FIXED — inline paint test wrapped in try/finally

### F5 — Silent cleanup errors in afterAll

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/entry-workflow-integration.test.ts:45–51, 61–70, 112–115
- **Detail**: `clearStepPhoto`, `clearFinalPhoto`, `storage.remove`, and ephemeral `entryB` delete ignore Supabase errors. Failed cleanup leaves seed/Storage polluted for subsequent runs.
- **Fix**: Check `{ error }` in cleanup helpers and throw in `afterAll`, matching `persistStepPhotoPath` fail-loud style.
- **Decision**: FIXED — cleanup helpers and afterAll hooks throw on Supabase errors

### F6 — Photo/loader describe order coupling

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/integration/entry-workflow-integration.test.ts:228–313 → 315–361
- **Detail**: `"photo recall (Risk #4)"` persists photo paths on `ENTRY_A` before `"detail loader completeness (Risk #5)"` oracle tests. Safe today because oracle tests don't assert absence of photo fields, but couples describe order to assertion scope.
- **Fix**: Add `afterAll` in photo describe to clear DB photo paths (Storage cleanup can stay file-level), or isolate photo tests on ephemeral entry.
- **Decision**: FIXED — photo describe afterAll clears DB photo paths before loader oracle tests
