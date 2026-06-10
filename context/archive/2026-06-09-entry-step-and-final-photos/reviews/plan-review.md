<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Entry Step and Final Photos

- **Plan**: context/changes/entry-step-and-final-photos/plan.md
- **Mode**: Deep
- **Date**: 2026-06-09
- **Verdict**: SOUND (after fixes)
- **Findings**: 0 critical  3 warnings  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 existing paths ✓, 2/2 new paths (expected absent) ✓, 6/6 symbols ✓, brief↔plan ✓

## Findings

### F1 — Step delete must read storage_path before row delete

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Step delete Storage cleanup
- **Detail**: Plan said load storage_path "before or after" deleteStepAndRenumber. The RPC deletes the step row; after that storage_path is unreadable.
- **Fix**: Mandate pre-delete fetch in Phase 3 contract; clarify upsert-on-replace in Critical Implementation Details.
- **Decision**: FIXED

### F2 — No precedence when remove + new file submitted together

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — applyStepPhotoFromForm / applyFinalPhotoFromForm
- **Detail**: Plan defined remove flag and new file independently but not what happens if both are present in one POST.
- **Fix A ⭐ Recommended**: New file wins — if a valid file is present, upload and set path; ignore remove flag.
- **Decision**: FIXED (Fix A)

### F3 — Photo field names not centralized in Phase 1 contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — entry-photos-api.ts
- **Detail**: StepPhotoField names fields step_photo / remove_step_photo; final form names unspecified in Phase 1.
- **Fix**: Add canonical field-name constants in entry-photos-api.ts and reference in Phase 2/3 contracts.
- **Decision**: FIXED

### F4 — Fixed Storage paths make delete-on-replace redundant

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details — Upload ordering
- **Detail**: Step/final paths are fixed per entity; upsert overwrites in place. Separate delete-on-replace is unnecessary.
- **Fix**: Clarify in Desired End State that replace = upsert at fixed path.
- **Decision**: FIXED
