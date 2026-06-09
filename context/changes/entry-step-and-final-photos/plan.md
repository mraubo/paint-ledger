# Entry Step and Final Photos Implementation Plan

## Overview

Deliver S-05 (FR-009, FR-010): authenticated users attach up to one optional photo per tutorial step and at least one final model photo in a separate result area on entry edit. Unify the add-step form with the edit-step form on the steps list page (shared paint checklist and inline paint add). Use server-side multipart POST through existing API routes — the only Supabase client is SSR/server-only. F-02 bucket `entry-photos`, path columns, and RLS are already in place.

## Current State Analysis

**Already in place:**

- F-02 migration: private bucket `entry-photos` (JPEG/PNG/WebP, 4 MiB), `steps.storage_path`, `entries.final_photo_path`, owner-scoped `storage.objects` RLS (`supabase/migrations/20260608122840_entry_photo_storage.sql`).
- Path contract documented in README: step `{user_id}/{entry_id}/steps/{step_id}`, final `{user_id}/{entry_id}/final` — fixed keys, upsert on replace.
- S-04 steps: `/entries/[id]/steps`, `EntryStepForm` with `mode: "add" | "edit"`, paint checklist + `EntryStepInlinePaintAdd` on edit only, create/update APIs via form POST + redirect.
- S-02 entry edit: `/entries/[id]` with `EntryBasicsForm`, `status` enum `draft | ready` (no mark-ready UI yet).
- Middleware protects `/entries` and `/api/entries` (`src/middleware.ts`).
- No `.storage` calls in `src/` yet; no multipart handling in API routes.

**Gaps for S-05:**

- Add-step form shows hint text instead of paint checklist and has no inline paint add (`src/components/entries/EntryStepForm.tsx:152-160`).
- Step create API ignores `entry_paint_ids` (`src/pages/api/entries/[id]/steps/index.ts`).
- No photo file input, preview, upload, remove, or signed URL display.
- No final photo section on entry edit (`src/pages/entries/[id].astro`).
- Step delete does not remove Storage objects (`src/pages/api/entries/[id]/steps/[stepId]/delete.ts`).
- `loadEntrySteps` does not select `storage_path`; `loadEntryForEdit` does not select `final_photo_path`.

### Key Discoveries

- Server-only Supabase (`astro:env/server` secrets) — uploads must go through API handlers, not browser client (`src/lib/supabase.ts`, `astro.config.mjs`).
- `EntryStepForm` already uses a discriminated `mode` union — extend add props to accept `entryPaints` and `paintAddedId` like edit (`src/components/entries/EntryStepForm.tsx:10-29`).
- Inline paint add `redirect_to` is validated to step-edit URLs only (`src/lib/entry-steps-api.ts:74-93`) — must extend for add-form return to steps list.
- F-02 explicitly deferred Storage cleanup to S-05 (`context/archive/2026-06-08-photo-storage-buckets/plan.md`).
- Roadmap risk: keep one photo per step; upload + error handling is the main integration surface.

## Desired End State

After S-05:

- Signed-in user on `/entries/[id]/steps` sees add-step form with the same paint checklist UI as edit (not the current hint paragraph). Inline "Add paint to entry" works from add form; new paint returns with `?paint_added=` pre-checked.
- User adds a step with optional paint assignments in one POST; optional step photo uploads on create when file provided.
- User edits a step (`?edit=<stepId>`): description, paints, optional photo upload/replace/remove, preview of current photo when set.
- Steps list shows small thumbnails for steps that have `storage_path` (signed URLs generated server-side).
- User on `/entries/[id]` sees a "Final result" section below basics: upload, preview, replace, remove final photo. Soft warning when `final_photo_path` is null on a draft entry — copy notes a final photo will be required to mark the entry ready (future workflow).
- Photo replace upserts at the fixed Storage path (no separate delete-on-replace). Storage objects deleted on explicit remove and step delete.
- `npm run lint` and `npm run build` pass.

### Verification

- Manual: add step with paints from checklist → verify assignments on list → edit step → upload photo → see thumbnail on list → replace photo → remove photo.
- Manual: inline add paint from add-step form → paint pre-checked → submit step with paints.
- Manual: entry edit → upload final photo → preview → remove → soft warning visible when missing on draft.
- Manual: delete step with photo → Storage object gone (Studio or list check).
- Manual: reject >4 MiB or wrong MIME with clear error.
- curl: authenticated multipart POST per AGENTS.md (include `Origin` header).

## What We're NOT Doing

- Entry list/detail recall with full photo gallery (S-06 / FR-011).
- Mark entry as ready UI or hard block on missing final photo (soft warning only in S-05).
- Client-side resize/compression or HEIC conversion (validate MIME + size only).
- Browser Supabase client or public anon key exposure.
- Dedicated `/entries/[id]/photos` route.
- Multiple photos per step; photo on steps without storage path column populated.
- Automated test suite (none in repo).
- Drag-and-drop upload, progress bars, or image cropping UI.
- Entry delete Storage cascade (orphans on full entry delete acceptable until follow-up; step-level cleanup in scope).

## Implementation Approach

Three phases: (1) shared photo helpers and Storage mutations; (2) step form parity, step photo multipart on create/update, list thumbnails; (3) final photo section on entry edit, soft warning, cleanup on step delete. Follow S-03/S-04 form POST + redirect; add `enctype="multipart/form-data"` only on forms that carry files.

## Critical Implementation Details

**Upload ordering.** On step create/update with a new file: validate file first → upload/upsert to fixed Storage path → update `steps.storage_path` (or `entries.final_photo_path`). If DB update fails after upload succeeds, attempt to delete the just-uploaded object and return error redirect. On replace at a fixed path, upsert overwrites the existing object — no separate delete needed. Explicit Storage delete only on remove flag or step delete.

**Add-form inline paint add.** `EntryStepInlinePaintAdd` gains an optional `stepId`. When absent (add mode), `redirect_to` is `/entries/{entryId}/steps` (validated). Extend `parsePaintCreateRedirectTo` to accept steps list base path in addition to `?edit=` URLs. Add form reads `paint_added` query param (already loaded on list view) to pre-check new paint.

**Signed URLs for thumbnails.** Private bucket — SSR generates short-lived signed URLs in `loadEntrySteps` (or a post-load helper) for list thumbnails and edit previews. Do not expose raw Storage keys as public URLs.

**Remove vs replace in one POST.** If both a remove flag and a new valid file are submitted, **new file wins**: upload/upsert and set the path; ignore the remove flag. If only remove is set, delete Storage object and null the DB column.

## Phase 1: Photo helpers and storage layer

### Overview

Introduce shared validation, path construction, upload/delete, and signed URL utilities. No UI yet — enables Phase 2/3 handlers.

### Changes Required:

#### 1. Entry photos API helpers

**File**: `src/lib/entry-photos-api.ts` (new)

**Intent**: Centralize photo validation, Storage path builders, and form field parsing so step and entry handlers share one contract.

**Contract**:

- Constants: `ENTRY_PHOTOS_BUCKET = 'entry-photos'`, allowed MIME set matching F-02, `MAX_PHOTO_BYTES = 4_194_304`.
- Canonical form field names (export constants; Phase 2/3 components must use these): `STEP_PHOTO_FIELD = 'step_photo'`, `REMOVE_STEP_PHOTO_FIELD = 'remove_step_photo'`, `FINAL_PHOTO_FIELD = 'final_photo'`, `REMOVE_FINAL_PHOTO_FIELD = 'remove_final_photo'`.
- `buildStepPhotoPath(userId, entryId, stepId)` → `{userId}/{entryId}/steps/{stepId}`.
- `buildFinalPhotoPath(userId, entryId)` → `{userId}/{entryId}/final`.
- `parseOptionalPhotoFile(formData, fieldName)` → `{ ok: true, file: File | null } | { ok: false, error: string }` — absent field = no upload; present empty = no upload; present file = validate type/size.
- `parseRemovePhotoFlag(formData, fieldName)` → boolean for explicit remove checkbox/hidden field.

#### 2. Entry photos storage mutations

**File**: `src/lib/entry-photos-storage.ts` (new)

**Intent**: Wrap Supabase Storage operations with consistent error mapping.

**Contract**:

- `uploadEntryPhoto(supabase, path, file)` — `storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })`.
- `deleteEntryPhoto(supabase, path)` — remove object; treat 404 as success.
- `createSignedPhotoUrl(supabase, path, expiresInSeconds)` — return URL or null on failure.
- Map Storage errors through `toUserFacingDbError` or a dedicated short message helper.

#### 3. Step photo persistence helper

**File**: `src/lib/entry-step-photos.ts` (new)

**Intent**: Orchestrate step photo set/remove/update used by create and update handlers.

**Contract**:

- `applyStepPhotoFromForm(supabase, userId, entryId, stepId, formData)` handles: new valid file → upload + set path (wins over remove flag); else remove flag → delete object + null `storage_path`; neither → no-op. Returns `{ ok: true, storagePath: string | null } | { ok: false, error: string }`.

#### 4. Final photo persistence helper

**File**: `src/lib/entry-final-photo.ts` (new)

**Intent**: Same orchestration for `entries.final_photo_path`.

**Contract**: `applyFinalPhotoFromForm(supabase, userId, entryId, formData)` with parallel semantics to step helper (new file wins over remove flag).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Helpers importable; path builders match README convention
- Quick script or temporary log confirms signed URL generation against seed fixture (optional dev check)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Step form parity and step photos

### Overview

Unify add/edit step forms, extend step APIs for paint assignments on create and multipart photos, add photo field to edit (and optional on create), show thumbnails on steps list.

### Changes Required:

#### 1. Unify EntryStepForm add and edit

**File**: `src/components/entries/EntryStepForm.tsx`

**Intent**: Add-step form matches edit-step form for paints; add optional photo field on edit and create.

**Contract**:

- Extend `AddProps` with `entryPaints: EntryPaintRow[]`, optional `paintAddedId`, optional `initialPhotoUrl` (null on add).
- Replace add-mode hint paragraph with the same paint checklist fieldset as edit (extract shared JSX or render same block for both modes).
- Add `enctype="multipart/form-data"` on the form when photo input is present.
- Edit mode: show current photo preview (`initialPhotoUrl`), file input (optional replace), and "Remove photo" checkbox when a photo exists.
- Add mode: optional file input (uploaded after step row created in same POST).
- Render `EntryStepInlinePaintAdd` in add mode when `entryPaints` provided — pass `stepId` only in edit mode.

#### 2. Inline paint add for add form

**File**: `src/components/entries/EntryStepInlinePaintAdd.tsx`

**Intent**: Allow inline paint creation while adding a step (no `stepId` yet).

**Contract**:

- `stepId` prop optional. When omitted, `redirect_to` = `/entries/{entryId}/steps` (must pass `parsePaintCreateRedirectTo` validation).
- Field `id` prefixes use `"add"` when no `stepId`.

#### 3. Extend redirect_to validation

**File**: `src/lib/entry-steps-api.ts`

**Intent**: Accept paint-create redirects back to steps list for add-form flow.

**Contract**:

- `parsePaintCreateRedirectTo` allows exact match `/entries/{entryId}/steps` (same entry) in addition to existing `?edit=` pattern.
- Export `stepsListPath(entryId)` if useful alias for `stepsPagePath`.

#### 4. Step create API — assignments + photo

**File**: `src/pages/api/entries/[id]/steps/index.ts`

**Intent**: Create step with paint assignments and optional photo in one multipart POST.

**Contract**:

- After `createStepAtNextPosition`, call `syncStepPaintAssignments` with `parseStepPaintIds(form)`.
- Call `applyStepPhotoFromForm` with new `stepId`.
- On assignment or photo failure after step created, redirect with error (step exists — user can edit to fix); document this edge case in error message.

#### 5. Step update API — photo

**File**: `src/pages/api/entries/[id]/steps/[stepId].ts`

**Intent**: Handle multipart step update including optional photo replace/remove.

**Contract**:

- Invoke `applyStepPhotoFromForm` after successful `updateStepWithAssignments`.
- Preserve existing redirect behavior for `return_to_edit`.

#### 6. Load steps with storage paths and signed URLs

**File**: `src/lib/entry-steps-page.ts`

**Intent**: Supply thumbnail URLs for list and edit views.

**Contract**:

- Select `storage_path` on steps query.
- Add `photo_url: string | null` on `EntryStepRow` — populated via `createSignedPhotoUrl` when `storage_path` set (e.g. 1-hour expiry).

#### 7. Steps page wiring

**File**: `src/pages/entries/[id]/steps.astro`

**Intent**: Pass paints to add form; show thumbnails; wire photo preview on edit.

**Contract**:

- Add form: `entryPaints={paintRows}`, `paintAddedId={paintAddedId}` (reuse list-level `paint_added` param when not in edit view).
- Edit form: pass `initialPhotoUrl={editingStep.photo_url}`.
- Step list rows: render `<img>` thumbnail when `step.photo_url` present (sensible max dimensions / `object-cover`).
- `paint_added` banner on list view when returning from inline add.

#### 8. Photo upload UI component (optional extract)

**File**: `src/components/entries/StepPhotoField.tsx` (new, if extraction keeps EntryStepForm readable)

**Intent**: Reusable file input + remove checkbox + preview for step forms.

**Contract**: Controlled by props; use `STEP_PHOTO_FIELD` and `REMOVE_STEP_PHOTO_FIELD` from `entry-photos-api.ts` for input `name` attributes.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Add step with paint checklist matches edit layout; inline add from add form works
- Upload step photo on create and on edit; thumbnail appears on list
- Replace and remove step photo work
- Oversized/wrong-type file shows actionable error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Final photo, soft warning, and cleanup

### Overview

Final result section on entry edit, soft draft warning, Storage cleanup on step delete, entry loader updates.

### Changes Required:

#### 1. Final photo form component

**File**: `src/components/entries/EntryFinalPhotoForm.tsx` (new)

**Intent**: Separate multipart form for final model photo (does not mix with basics fields).

**Contract**:

- `method="POST"` `action="/api/entries/{entryId}/final-photo"` (or `PATCH` via POST), `enctype="multipart/form-data"`.
- Preview when `initialPhotoUrl` set; file input (`FINAL_PHOTO_FIELD`); remove checkbox (`REMOVE_FINAL_PHOTO_FIELD`); submit + pending states matching existing `SubmitButton` pattern.

#### 2. Final photo API route

**File**: `src/pages/api/entries/[id]/final-photo.ts` (new)

**Intent**: Upload, replace, or remove final photo; update `entries.final_photo_path`.

**Contract**:

- Auth + entry ownership same as `src/pages/api/entries/[id].ts`.
- `applyFinalPhotoFromForm`; redirect `/entries/{id}?final_photo_saved=1` or error query.
- Register under `/api/entries` — already protected by middleware.

#### 3. Entry page — final result section + warning

**File**: `src/pages/entries/[id].astro`

**Intent**: PRD "separate final result area" on entry edit.

**Contract**:

- Load `final_photo_path`; generate signed URL when set.
- Section heading "Final result" below basics form with `EntryFinalPhotoForm`.
- When `status === 'draft'` and no final photo: informational banner — final photo required before marking entry ready (wording per product tone; not a hard block).

#### 4. Entry loader update

**File**: `src/lib/entries-page.ts`

**Intent**: Expose `final_photo_path` for entry edit page.

**Contract**: `loadEntryForEdit` selects `final_photo_path`; optional helper for signed final URL.

#### 5. Step delete — Storage cleanup

**File**: `src/pages/api/entries/[id]/steps/[stepId]/delete.ts`

**Intent**: Remove Storage object when step with photo is deleted (F-02 contract).

**Contract**:

- **Before** `deleteStepAndRenumber`, load step `storage_path` for the owned step (row is gone after the RPC). If set, `deleteEntryPhoto` (best-effort; proceed with step delete if Storage delete fails but log).

#### 6. README touch-up (minimal)

**File**: `README.md`

**Intent**: Note S-05 upload UI exists and manual verification path via app (not only Studio).

**Contract**: Short pointer under Storage section — upload via steps/entry edit UI; cleanup on replace/remove/step delete.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Final photo upload, preview, replace, remove on entry edit
- Draft entry without final photo shows soft warning mentioning ready status
- Delete step with photo removes Storage object
- Second user cannot access another user's photos (existing RLS + app routes)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests

None in repo; not introduced in S-05.

### Integration Tests

Deferred — manual smoke matches S-04/F-02 pattern.

### Manual Testing Steps

1. Sign in → open entry with paints → `/entries/{id}/steps`.
2. Add step using paint checklist; inline-add a new paint from add form; confirm pre-check.
3. Add step with photo file → thumbnail on list.
4. Edit step → replace photo → remove photo.
5. Entry edit → upload final photo → remove → confirm soft warning on draft without photo.
6. Delete step that had photo → confirm object removed from Storage.
7. Attempt 5 MiB file → clear error.
8. `npm run lint` && `npm run build`.

## Performance Considerations

Signed URLs generated per step on list load — acceptable for hobby-scale step counts (typically <20). If list grows, batch `createSignedUrl` or cache within request only. Multipart uploads through Worker — 4 MiB cap keeps payloads bounded.

## Migration Notes

- No new DB migration — F-02 columns exist.
- Remote: ensure F-02 migration applied before deploy (`supabase db push`).
- Types already include `storage_path` and `final_photo_path` — no regen required unless schema drift.

## References

- Roadmap S-05: `context/foundation/roadmap.md`
- PRD FR-009, FR-010: `context/foundation/prd.md`
- F-02 archive: `context/archive/2026-06-08-photo-storage-buckets/plan.md`
- S-04 archive: `context/archive/2026-06-09-steps-with-paint-cards/plan.md`
- Storage paths: `README.md`
- Step form: `src/components/entries/EntryStepForm.tsx`
- AGENTS.md curl Origin header lesson: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Photo helpers and storage layer

#### Automated

- [x] 1.1 `npm run lint` passes — b8cde95
- [x] 1.2 `npm run build` passes — b8cde95

#### Manual

- [x] 1.3 Path builders match README convention; signed URL helper verified locally — b8cde95

### Phase 2: Step form parity and step photos

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` passes

#### Manual

- [x] 2.3 Add/edit form parity; step photo upload/replace/remove; list thumbnails

### Phase 3: Final photo, soft warning, and cleanup

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 `npm run build` passes

#### Manual

- [ ] 3.3 Final photo section; draft soft warning; step-delete Storage cleanup
