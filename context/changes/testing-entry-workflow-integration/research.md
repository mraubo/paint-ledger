---
date: 2026-06-12T12:00:00+00:00
researcher: Cursor Agent
git_commit: 5bc53f9
branch: main
repository: paint-ledger
topic: "Rollout Phase 3 — Entry workflow integration (risks #2, #4, #5)"
tags: [research, testing, integration, paint-invariant, storage, detail-loader, vitest]
status: complete
last_updated: 2026-06-12
last_updated_by: Cursor Agent
---

# Research: Rollout Phase 3 — Entry workflow integration

**Date**: 2026-06-12
**Researcher**: Cursor Agent
**Git Commit**: [`5bc53f9`](https://github.com/mraubo/paint-ledger/commit/5bc53f9)
**Branch**: `main`
**Repository**: [mraubo/paint-ledger](https://github.com/mraubo/paint-ledger)

## Research Question

Ground rollout Phase 3 of `context/foundation/test-plan.md`: paint-list invariant on step assignments, photo upload recall path, and entry detail loader completeness (risks **#2**, **#4**, **#5**). Verify or correct risk response guidance; locate failure paths and existing tests; identify the cheapest useful integration layer; flag anti-patterns.

## Summary

**Risk #2 is real and multi-layered.** Protection is not UI-only: (1) app code filters submitted paint IDs to the entry palette (`filterValidPaintIds`), (2) the `sync_step_paint_assignments` RPC only inserts rows joined to `entry_paints` on the same `entry_id`, and (3) trigger `enforce_step_paint_same_entry` rejects direct junction inserts where step and paint belong to different entries. Invalid IDs submitted through the app are **silently dropped** (no error) — tests must assert **DB assignment rows**, not redirect success or checkbox state.

**Risk #4 spans Storage RLS + DB path columns + signed-URL loaders.** Upload writes to bucket `entry-photos` at `{userId}/{entryId}/steps/{stepId}` or `.../final`, then persists `storage_path` / `final_photo_path`. Detail recall uses `createSignedPhotoUrl(Map)` in `entry-steps-page.ts` and `entries-page.ts`. A 200 upload redirect does **not** prove recall — tests must assert non-null signed URL **and** that fetching it returns image bytes. Non-owner access is blocked at `storage.objects` RLS (path segment 1 must equal `auth.uid()`). Use real local Supabase Storage; do not mock the stack.

**Risk #5 is loader-composable, not page-HTML.** `[id].astro` orchestrates `loadEntryForEdit`, `loadEntryPaints`, `loadEntrySteps`, and `resolveEntryFinalPhotoUrl`. Recipe completeness is a structured-data assertion problem: model fields, ordered steps with positions/descriptions/assigned paints, paint palette rows, and photo URLs when paths exist. Empty sections are intentionally omitted in the template — tests should import the same loader functions and assert the returned shapes against seed oracle data, not snapshot HTML.

**Cheapest layer**: Vitest **Supabase-client integration** (Phase 1 pattern) for risks #2, #4 (storage + signed URL + fetch), and #5 (loader imports). HTTP dev-server tests are optional for upload-via-API only if multipart form posting is added; storage upload via authenticated client plus loader recall is sufficient signal per test-plan §2.

**Seed gap**: `supabase/seed.sql` fixture `ENTRY_A` has paints, steps, and one assignment but **no `storage_path` or `final_photo_path`**. Photo recall tests need in-test upload setup (minimal valid PNG/WebP bytes) or seed extension — prefer in-test upload to avoid coupling seed to binary blobs.

**Existing tests**: `tests/integration/rls-isolation.test.ts` covers cross-user paint/step/assignment mutations but not paint-list invariant, storage recall, or loader completeness. `tests/integration/auth-route-protection.test.ts` covers HTTP auth only. No tests yet for `entry-steps-mutations`, `entry-photos-storage`, or page loaders.

## Detailed Findings

### Risk #2 — Step paint assignment invariant

#### Defense layers

| Layer | Location | Behavior |
|-------|----------|----------|
| App filter | `src/lib/entry-steps-mutations.ts:6-20` | `filterValidPaintIds` loads entry paints, keeps only IDs in that set; unknown IDs dropped silently |
| RPC sync | `supabase/migrations/20260609140700_step_mutation_rpcs.sql:33-37` | `INSERT … SELECT` from `entry_paints` where `entry_id = p_entry_id AND id = ANY(p_paint_ids)` — foreign IDs never inserted |
| DB trigger | `supabase/migrations/20260608103251_paint_log_schema.sql:93-117` | `enforce_step_paint_same_entry` raises on junction insert/update when step and paint are not on same entry |
| UI checklist | `src/components/entries/EntryStepForm.tsx:76-80` | Checkboxes named `entry_paint_ids` — client can forge values; not authoritative |
| Inline-add | `src/components/entries/EntryStepInlinePaintAdd.tsx:46-47` | POST `/api/entries/{id}/paints` adds palette row; redirect `paint_added={id}` for step editor pre-select |

#### Failure modes to test

1. **Forged paint ID via API/RPC** — submit UUID not on entry palette; expect zero matching `step_paint_assignments` rows (silent drop, not error).
2. **Cross-entry paint ID** (same user, two entries) — RPC must not link step on entry A to paint on entry B.
3. **Direct junction insert** — authenticated client `INSERT` into `step_paint_assignments` with mismatched step/paint; expect Postgres error from trigger.
4. **Inline-add then assign** — create paint via paints API path, assign to step, verify junction row exists in DB.

#### Response guidance verification

| Test-plan claim | Verdict |
|-----------------|---------|
| Challenge "UI validates, so DB doesn't need to" | **Confirmed** — DB + RPC enforce invariant; UI is not sufficient |
| Avoid asserting only UI state | **Confirmed** — assert `step_paint_assignments` rows and `assigned_paints` from `loadEntrySteps` |
| Anti-pattern: mirroring app validation in test | **Confirmed** — oracle is seed/requirements ("only palette paints"), not `filterValidPaintIds` source |

#### Recommended tests

- File: `tests/integration/entry-workflow-integration.test.ts` (new sibling)
- Helpers: `createTestClient`, `signInAs`, `ENTRY_A`, `PAINTS_A`, `STEPS_A` from `tests/helpers/seed-fixtures.ts`
- Cases: RPC `sync_step_paint_assignments` with bogus UUID; `update_step_with_assignments` via `updateStepWithAssignments` import with foreign paint ID; direct junction insert expecting error; happy-path assign `PAINTS_A.imperialFist` to `STEPS_A.layer` then query assignments

### Risk #4 — Photo upload recall path

#### Upload → persist → recall chain

```
POST handler (final-photo.ts / steps/[stepId].ts)
  → applyFinalPhotoFromForm / applyStepPhotoFromForm
    → buildFinalPhotoPath / buildStepPhotoPath (entry-photos-api.ts:12-18)
    → uploadEntryPhoto → supabase.storage.from('entry-photos').upload
    → UPDATE entries.final_photo_path | steps.storage_path

Detail / steps loaders
  → createSignedPhotoUrl(Map) (entry-photos-storage.ts:56-87)
  → photo_url on EntryStepRow | resolveEntryFinalPhotoUrl
```

#### Storage RLS (`supabase/migrations/20260608122840_entry_photo_storage.sql`)

- Private bucket `entry-photos` (4 MB, jpeg/png/webp)
- Path convention: `{user_id}/{entry_id}/steps/{step_id}` or `{user_id}/{entry_id}/final`
- Policies require `split_part(name,'/',1) = auth.uid()` and matching `entries` / `steps` ownership
- User B cannot SELECT/INSERT objects under User A's path prefix

#### Failure modes to test

1. **Upload succeeds but path not persisted** — assert DB column after upload
2. **Path persisted but signed URL null** — loader returns null when `createSignedUrls` fails (logged, not thrown)
3. **Signed URL present but not fetchable** — `fetch(signedUrl)` must return 200 and `content-type` matching image/*
4. **Non-owner recall** — User B `createSignedUrls` on User A's path returns empty/error; direct `storage.download` blocked

#### Response guidance verification

| Test-plan claim | Verdict |
|-----------------|---------|
| Challenge "upload returned 200" | **Confirmed** — must exercise signed URL + HTTP GET on URL |
| Avoid mocking entire Storage stack | **Confirmed** — local Supabase Storage is available after `supabase start` |
| Cheapest layer: Integration (Storage + one read path) | **Confirmed** — client upload + `createSignedPhotoUrl` + `fetch`; loaders optional second read path |

#### Implementation notes for plan

- `tests/helpers/http-client.ts` `httpPostForm` supports only string fields — **no multipart file upload yet**. For API-level upload tests, add `httpPostMultipart` or use `supabase.storage.upload` in test setup (cheaper, still real Storage).
- Minimal test image: 1×1 PNG bytes in helper `tests/helpers/test-image.ts` (or inline `Buffer`) — do not commit large fixtures.
- `parseOptionalPhotoFile` validates magic bytes (`entry-photos-api.ts:22-56`) — test files must be valid JPEG/PNG/WebP.

### Risk #5 — Entry detail loader completeness

#### Loader composition (`src/pages/entries/[id].astro:29-51`)

| Data | Loader | Key fields |
|------|--------|------------|
| Basics | `loadEntryForEdit` (`entries-page.ts:87-98`) | `title`, `description`, `model_info`, `model_origin_note`, `status`, `final_photo_path` |
| Paints | `loadEntryPaints` (`entry-paints-page.ts:11-22`) | `id`, `name`, `brand`, `color_description`, `approximate_color`; ordered by `name` |
| Steps | `loadEntrySteps` (`entry-steps-page.ts:47-101`) | `position` asc, `description`, `assigned_paints[]`, `photo_url` from signed URLs |
| Final photo | `resolveEntryFinalPhotoUrl` (`entries-page.ts:101-109`) | signed URL or null |

#### Template omission rules (`[id].astro:61-159`)

Sections render only when data is non-empty: `description`, `model_info`, `model_origin_note`, `paintRows.length > 0`, `stepRows.length > 0`, `finalPhotoUrl` truthy. Tests on loader output should not require fields that seed leaves empty unless test setup populates them.

#### Seed oracle (`supabase/seed.sql:160-232`)

`ENTRY_A` ("Imperial Fist Intercessor", status `ready`):

- `model_info`: "Space Marine Intercessor"
- `model_origin_note`: "Indomitus box set"
- Paints: Wraithbone, Imperial Fist
- Steps: position 1 "Spray prime with Wraithbone" (assigned Wraithbone), position 2 "Layer Imperial Fist…" (no assignment)
- No photos in seed

#### Failure modes to test

1. **Missing step order** — positions must be `[1, 2]` ascending
2. **Missing assignment on step 1** — `assigned_paints` must include Wraithbone by name/id
3. **Missing model/origin** — basics fields match seed strings
4. **Incomplete paint palette** — both seed paints present
5. **Photo URL null after upload** — extend setup from Risk #4, then `loadEntrySteps` / `resolveEntryFinalPhotoUrl` must return non-null `photo_url`

#### Response guidance verification

| Test-plan claim | Verdict |
|-----------------|---------|
| Challenge "list page loads" | **Confirmed** — detail loaders are distinct from `loadEntryList` |
| Avoid HTML snapshot without recipe assertions | **Confirmed** — import loaders, assert structured fields |
| Cheapest layer: Integration (loaders) | **Confirmed** — no dev server required for loader tests |

### Hot-spot evidence validation

| §2 citation | Research verdict |
|-------------|------------------|
| `src/components/entries/` (Risk #2) | Valid — step forms and inline-add live here; invariant enforced downstream in lib + DB |
| `src/pages/api/entries/` (Risk #4) | Valid — upload handlers and redirect contract |
| `src/pages/entries/` (Risk #5) | Valid — detail page orchestrates loaders; logic is in `src/lib/*-page.ts` |

### Existing test infrastructure

| Asset | Relevance |
|-------|-----------|
| `tests/helpers/supabase-client.ts` | `createTestClient`, `signInAs`, `requireLocalSupabase` |
| `tests/helpers/seed-fixtures.ts` | `USER_A`, `USER_B`, `ENTRY_A`, `PAINTS_A`, `STEPS_A` |
| `tests/helpers/http-client.ts` | Dev server + cookies; needed only if testing upload via HTTP POST |
| `tests/integration/rls-isolation.test.ts` | Pattern for two-user DB assertions |
| `vitest.config.ts` | Loads `SUPABASE_URL`/`SUPABASE_KEY` from `.env`; `@/` alias for importing `src/lib` loaders |

Prerequisites: `npx supabase start && npx supabase db reset`, then `npm test`. Dev server **not** required for recommended Phase 3 tests.

## Code References

- `src/lib/entry-steps-mutations.ts:6-70` — app-side paint ID filter + RPC wrappers
- `supabase/migrations/20260609140700_step_mutation_rpcs.sql:7-38` — `sync_step_paint_assignments` SQL filter
- `supabase/migrations/20260608103251_paint_log_schema.sql:93-117` — junction same-entry trigger
- `src/lib/entry-photos-api.ts:12-18` — storage path builders
- `src/lib/entry-photos-storage.ts:17-87` — upload, delete, signed URLs
- `src/lib/entry-step-photos.ts:32-79` — step photo apply flow
- `src/lib/entry-final-photo.ts` — final photo apply flow (mirror of step)
- `supabase/migrations/20260608122840_entry_photo_storage.sql:50-198` — storage.objects RLS
- `src/lib/entries-page.ts:87-109` — detail basics + final photo URL
- `src/lib/entry-paints-page.ts:11-22` — paint palette loader
- `src/lib/entry-steps-page.ts:47-101` — steps + assignments + step photo URLs
- `src/pages/entries/[id].astro:29-51` — detail page loader orchestration
- `supabase/seed.sql:160-232` — fixture oracle for completeness assertions

## Architecture Insights

- **Silent filtering vs hard errors**: paint ID validation at the app and RPC layers drops invalid IDs without surfacing an error to the user. Tests proving Risk #2 must use negative cases that inspect persisted junction rows, not response bodies alone.
- **Photo recall is three-step**: Storage object exists → DB path column set → signed URL resolves. Any break in the chain yields null `photo_url` in UI with only a server console warning.
- **Detail view is loader-driven**: Astro template is thin; importing `src/lib/*-page.ts` functions in Vitest gives the same data contract the page uses, which is the correct integration boundary for Risk #5.

## Historical Context (from prior changes)

- `context/archive/2026-06-11-testing-runner-bootstrap-rls-floor/research.md` — established two-user Supabase client pattern and seed fixture UUIDs
- `context/archive/2026-06-11-testing-auth-and-route-protection/research.md` — HTTP helpers and redirect-based API contract; cross-user storage not covered
- `context/foundation/lessons.md` — `Origin` header for curl POSTs; register new routes in `PROTECTED_ROUTES`

## Response-Guidance Corrections

No corrections to `test-plan.md` §2 Risk Response Guidance required. All three "must challenge" assumptions hold. One **planning note** (not a §2 edit): Risk #2 silent-drop behavior means "prove protection" tests should document that invalid assignments result in **empty junction**, not necessarily an error response.

## Recommended Plan Structure (for `/10x-plan`)

| Sub-phase | Risk | Focus | Anti-pattern avoided |
|-----------|------|-------|----------------------|
| 3.1 | #2 | RPC + direct DB negative cases for paint invariant; inline-add assign happy path | UI checkbox assertions only |
| 3.2 | #4 | Real storage upload, signed URL, fetch; user B denied | Mocking storage; asserting upload redirect only |
| 3.3 | #5 | Loader completeness against seed oracle; photo fields after 3.2 setup | HTML snapshot |
| 3.4 | cross | Update `test-plan.md` §6 cookbook (integration patterns for workflow); mark Phase 3 complete | — |

## Open Questions

- Whether to extend `httpPostForm` for multipart photo upload in this phase (adds dev-server dependency) or keep all photo tests at Storage-client + loader layer. **Recommendation**: Storage-client + loader only unless e2e golden path is explicitly in scope.
- Whether to add a second entry fixture for user A to test cross-entry paint IDs without cross-user noise. **Recommendation**: create ephemeral second entry in test `beforeAll` via client A.

## Related Research

- `context/archive/2026-06-11-testing-runner-bootstrap-rls-floor/research.md` — RLS floor
- `context/archive/2026-06-11-testing-auth-and-route-protection/research.md` — HTTP route protection
