<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Photo Storage Buckets Implementation Plan

- **Plan**: context/changes/photo-storage-buckets/plan.md
- **Scope**: All 3 phases
- **Date**: 2026-06-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

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

### F1 — Step path depth not enforced

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608122840_entry_photo_storage.sql:51-59
- **Detail**: Step-path policies validate segments 1–4 only. An authenticated owner can INSERT/SELECT/UPDATE/DELETE objects at `{user_id}/{entry_id}/steps/{step_id}/…` with extra trailing segments. Not a cross-user bypass, but permits non-canonical keys outside the documented fixed-path contract (one object per step).
- **Fix A ⭐ Recommended**: Add `and split_part(name, '/', 5) = ''` to the step branch in all four policies before S-05 ships upload UI.
  - Strength: Enforces the fixed-path contract at the RLS layer; S-05 upsert assumptions hold.
  - Tradeoff: Requires a new migration or amending the existing one if not yet pushed to remote.
  - Confidence: HIGH — matches plan's "fixed paths enable upsert overwrite" intent.
  - Blind spot: Haven't verified whether Supabase Storage normalizes trailing slashes differently.
- **Fix B**: Enforce canonical paths only in S-05 application code.
  - Strength: No migration change needed now.
  - Tradeoff: RLS alone won't reject malformed keys; Studio/manual uploads could still create extra-segment objects.
  - Confidence: MEDIUM — app-only guard is weaker than defense-in-depth.
  - Blind spot: Manual verification via Studio may not catch depth violations.
- **Decision**: FIXED via Fix A — added `split_part(name, '/', 5) = ''` to step branch in all policies

### F2 — Malformed UUID casts in RLS predicates

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608122840_entry_photo_storage.sql:43
- **Detail**: `split_part(name, '/', 2)::uuid` (and step segment cast) throws on malformed UUIDs inside RLS predicates, surfacing as query errors instead of a clean deny. Only affects paths with invalid UUID segments; cross-user isolation still holds for well-formed paths.
- **Fix**: Defer to S-05 — S-05 will construct paths from known UUIDs, so malformed paths are unlikely in normal use. Revisit with a safe-cast helper if Studio testing reveals noisy errors.
- **Decision**: FIXED — added `public.try_cast_uuid()` helper; policies use safe cast instead of direct `::uuid`
