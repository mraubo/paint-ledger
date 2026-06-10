# Entry Step and Final Photos — Plan Brief

> Full plan: `context/changes/entry-step-and-final-photos/plan.md`

## What & Why

S-05 delivers FR-009 and FR-010: optional one-photo-per-step evidence and a final model photo in a separate result area. It also unifies the add-step form with edit (shared paint checklist and inline add on the steps list) per user request. Server-multipart upload keeps Supabase secrets server-only and matches the existing form POST + redirect pattern from S-02–S-04.

## Starting Point

F-02 provides private bucket `entry-photos`, `steps.storage_path`, `entries.final_photo_path`, and Storage RLS. S-04 delivers ordered steps, paint assignments, and `EntryStepForm` — but add mode omits the paint checklist and photos are not wired. No `.storage` usage exists in `src/` yet.

## Desired End State

Users manage step photos from the steps page (add/edit forms, thumbnails on the list) and final photos from a "Final result" section on entry edit. Photos can be replaced or removed; Storage objects are cleaned up on replace, remove, and step delete. Draft entries without a final photo see a soft warning that a photo will be required to mark the entry ready. S-06 can build full detail recall on top.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Upload transport | Server multipart POST | Matches form pattern; no browser Supabase client | Plan |
| Add form layout | Unify fields on list page | User request; same checklist as edit without new `?add=` route | Plan |
| Final photo placement | Section on entry edit | PRD separate final result area | Plan |
| Image handling | Validate MIME/size only | F-02 limits; minimal scope | Plan |
| Photo remove | Replace + explicit remove | Fix mistakes; F-02 upsert contract | Plan |
| Final photo requirement | Soft warning on draft | Draft-friendly; note ready status needs photo later | Plan |
| List display | Thumbnails on steps list | User preference; signed URLs at SSR | Plan |
| Storage cleanup | On replace, remove, step delete | F-02 deferred contract | Plan |

## Scope

**In scope:**

- `entry-photos-api.ts`, `entry-photos-storage.ts`, step/final photo helpers
- `EntryStepForm` parity (paints + inline add + photo on edit/create)
- Step create/update APIs: assignments on create, multipart photos
- Steps list thumbnails; `EntryFinalPhotoForm` + API on entry edit
- Step delete Storage cleanup; soft draft warning

**Out of scope:**

- S-06 detail/list recall (FR-011)
- Mark-ready UI or hard block on missing final photo
- Client resize, HEIC, dedicated photos route
- Entry-delete Storage cascade
- Automated tests

## Architecture / Approach

```
/entries/[id]/steps  →  multipart EntryStepForm POST → step API
                     →  server upload → entry-photos bucket
                     →  update steps.storage_path
                     →  SSR signed URLs for list thumbnails

/entries/[id]        →  EntryFinalPhotoForm POST → /api/.../final-photo
                     →  update entries.final_photo_path
```

Path keys are fixed per F-02; upsert on replace. Private bucket — display via short-lived signed URLs only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Photo helpers | Validation, paths, upload/delete, signed URLs | Error handling if DB fails after upload |
| 2. Step photos + form parity | Unified add/edit paints, step upload, list thumbnails | Inline add redirect without stepId |
| 3. Final photo + cleanup | Entry edit section, soft warning, delete cleanup | Step delete + Storage race |

**Prerequisites:** F-02 + S-04 shipped; local Supabase + `.cookies` for auth smoke.

**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Step created but photo/assignment fails mid-handler leaves a partial step — error redirect must be actionable (edit to complete).
- Signed URL generation on every list load adds latency proportional to step count — acceptable for MVP scale.
- Entry delete may leave final photo Storage orphan until a future cleanup slice.
- No automated tests; regression relies on lint/build + manual smoke.

## Success Criteria (Summary)

- User can attach optional step photos and manage final photo while signed in.
- Add-step form matches edit for paint assignment; step list shows thumbnails.
- Replace/remove/delete cleans Storage per F-02 contract.
- `npm run lint` and `npm run build` pass.
