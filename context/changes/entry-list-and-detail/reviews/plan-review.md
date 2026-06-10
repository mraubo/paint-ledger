<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Entry List and Detail Recall

- **Plan**: `context/changes/entry-list-and-detail/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-10
- **Verdict**: REVISE → SOUND (after triage fixes applied)
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 paths ✓, 5/5 symbols ✓, brief↔plan ⚠️ (ready→draft scope drift)

## Findings

### F1 — Scope contradicts status revert

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: What We're NOT Doing vs Phase 1 / user request
- **Detail**: Plan line 50 excludes "Revert ready → draft" but Desired End State line 37 says "no revert in this slice" while Phase 1 builds mark-ready only. User requested bidirectional status via `/status-change`. Brief scope line 46 also lists ready→draft as out of scope — direct contradiction with implementation intent.
- **Fix**: Remove ready→draft from out-of-scope; replace `mark-ready` endpoint with `POST /api/entries/[id]/status-change` accepting target `status`; add revert-to-draft UI on edit for ready entries; update success criteria and manual tests.
- **Decision**: FIXED (user-directed + plan updated)

### F2 — Dedicated mark-ready endpoint is narrower than needed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 §4 Mark-ready mutation
- **Detail**: `mark-ready.ts` + `markEntryReady()` only handles one transition. User wants a single `/status-change` handler with explicit target status — avoids a second endpoint if revert ships in the same slice.
- **Fix**: Replace with `changeEntryStatus()` helper and `status-change.ts` handler; form posts `status=draft|ready`.
- **Decision**: FIXED (user-directed)

### F3 — Manual tests omit status revert

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 Manual Verification; Testing Strategy
- **Detail**: Success criteria cover mark-ready and block-without-photo but not ready→draft after user added that capability.
- **Fix**: Add manual criterion for revert to draft; add confirm dialog on revert form.
- **Decision**: FIXED

### F4 — curl Origin header not noted for new API

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy
- **Detail**: `lessons.md` requires `Origin` header on authenticated curl POSTs for `/api/**`. Plan manual steps don't mention it for status-change smoke tests.
- **Fix**: Add note under Testing Strategy referencing lessons.md Origin rule for curl verification of status-change.
- **Decision**: FIXED
