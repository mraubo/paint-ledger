<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Entry Step and Final Photos

- **Plan**: context/changes/entry-step-and-final-photos/plan.md
- **Scope**: All 3 phases (complete)
- **Date**: 2026-06-09
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Entry list thumbnails (S-06 scope creep)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: src/lib/entries-page.ts:24-41, src/pages/entries/index.astro:70-76
- **Detail**: Plan defers "entry list/detail recall with full photo gallery" to S-06 (FR-011). Implementation adds `photo_url` to `loadEntryList` / `EntryListRow` and renders final-photo thumbnails on `/entries`.
- **Fix A ⭐ Recommended**: Document in plan as an addendum (S-06 preview shipped early)
  - Strength: Preserves useful UX; updates source of truth before future reviews.
  - Tradeoff: Plan becomes a slightly moving target.
  - Confidence: HIGH — additive, harmless bonus feature.
  - Blind spot: S-06 may want different thumbnail semantics.
- **Fix B**: Revert `loadEntryList` / `index.astro` changes to stay strictly within S-05
  - Strength: Keeps scope discipline strict.
  - Tradeoff: Loses list thumbnails; another PR needed in S-06.
  - Confidence: HIGH — isolated to two files.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — plan addendum documents S-06 preview

### F2 — Photo helpers skip row-count verification after update

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/lib/entry-step-photos.ts:51-55, src/lib/entry-final-photo.ts:44-49
- **Detail**: After upload, `.update(...).eq(...)` returns no error on 0-row updates. `src/pages/api/entries/[id].ts` uses `.select("id").maybeSingle()` and treats missing `data` as failure; photo helpers do not. A silent miss leaves a storage orphan while the handler reports success.
- **Fix**: Add `.select("id").maybeSingle()` after update; if `!data`, roll back storage (upload path) and return error — match entries API pattern.
  - Strength: Identical to existing hardened mutation pattern in the repo.
  - Tradeoff: Minor — two call sites in photo helpers.
  - Confidence: HIGH — same fix applied in prior impl reviews (S-02, paints).
  - Blind spot: None significant.
- **Decision**: FIXED — row-count verification added to both photo helpers

### F3 — Remove flow deletes storage before DB null

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/entry-step-photos.ts:65-79, src/lib/entry-final-photo.ts:54-64
- **Detail**: On explicit remove, Storage object is deleted first; if the subsequent DB update fails, `storage_path` / `final_photo_path` still points at a deleted object — broken preview until re-upload.
- **Fix**: Null DB column first, then delete Storage object; on Storage delete failure, log best-effort (path already null in DB).
  - Strength: DB is source of truth; UI shows "no photo" even if Storage cleanup lags.
  - Tradeoff: Brief window where object exists but DB path is null (orphan until cleanup).
  - Confidence: MED — orphan is safer than broken reference.
  - Blind spot: None significant.
- **Decision**: FIXED — DB null first, then best-effort Storage delete

### F4 — Replace rollback deletes the only copy on DB failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/entry-step-photos.ts:57-58, src/lib/entry-final-photo.ts:46-47
- **Detail**: Upload uses upsert at a fixed path. On DB update failure, rollback always calls `deleteEntryPhoto`, which removes the only object — including a previously valid photo the DB may still reference.
- **Fix**: Before upload, read current `storage_path`; on DB failure after upsert, only delete rollback object if this was a first upload (no prior path). If replacing, leave new bytes at path (orphan) rather than deleting the user's only copy.
  - Strength: Avoids worse failure mode (DB points at deleted object).
  - Tradeoff: Replace + DB failure may orphan new bytes at path.
  - Confidence: HIGH — matches plan's upload-ordering intent.
  - Blind spot: Haven't verified all edge cases with concurrent replace.
- **Decision**: FIXED — conditional rollback skips delete on replace failure

### F5 — Step delete removes storage before RPC

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/entries/[id]/steps/[stepId]/delete.ts:39-50
- **Detail**: Storage delete runs before `deleteStepAndRenumber`. If the RPC fails, the step row remains with `storage_path` set but the object is gone — broken thumbnail.
- **Fix**: Call `deleteStepAndRenumber` first; on success, best-effort `deleteEntryPhoto` (log on failure). Matches plan intent ("proceed with step delete if Storage delete fails" — inverted order).
  - Strength: Step row gone or intact with photo; no broken reference state.
  - Tradeoff: RPC success + Storage delete failure leaves orphan (acceptable per plan).
  - Confidence: HIGH — aligns with F-02 best-effort cleanup contract.
  - Blind spot: None significant.
- **Decision**: FIXED — step RPC first, then best-effort Storage cleanup

### F6 — MIME validation trusts client File.type only

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/entry-photos-api.ts:41-42
- **Detail**: `parseOptionalPhotoFile` validates `file.type` against an allowlist. No magic-byte sniffing. Bucket `allowed_mime_types` provides defense in depth but validates declared type.
- **Fix**: Defer to follow-up unless threat model requires content inspection now; bucket RLS + MIME cap is sufficient for hobby MVP.
- **Decision**: FIXED — magic-byte sniffing added; declared type must match content

### F7 — N+1 signed URL calls on list loads

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/entry-steps-page.ts:76-85, src/lib/entries-page.ts:34-41
- **Detail**: One `createSignedPhotoUrl` per step/entry in `Promise.all`. Plan notes this is acceptable for hobby-scale counts (<20 steps). No action needed until scale grows.
- **Fix**: No action for S-05; revisit in S-06 if list grows.
- **Decision**: FIXED — batch createSignedUrls via createSignedPhotoUrlMap
