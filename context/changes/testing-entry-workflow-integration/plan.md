# Entry Workflow Integration Tests Implementation Plan

## Overview

Deliver test rollout Phase 3 (`context/foundation/test-plan.md`): add **Supabase-client integration tests** that prove the paint-list invariant on step assignments (risk **#2**), photo upload recall through real Storage + signed URLs (risk **#4**), and entry detail loader recipe completeness (risk **#5**). Builds on Phase 1 RLS floor and Phase 2 HTTP auth tests; does not duplicate cross-user table isolation or middleware redirects.

## Current State Analysis

**Already in place:**

- Phase 1: `tests/integration/rls-isolation.test.ts`, `tests/helpers/supabase-client.ts`, `tests/helpers/seed-fixtures.ts` — two-user DB isolation on `entries`, `entry_paints`, `steps`, `step_paint_assignments`.
- Phase 2: `tests/integration/auth-route-protection.test.ts`, `tests/helpers/http-client.ts` — HTTP redirect contract (risks #3, #6).
- DB enforcement: `sync_step_paint_assignments` RPC filters by `entry_id`; trigger `enforce_step_paint_same_entry` on junction table (`research.md` code refs).
- App filter: `filterValidPaintIds` in `src/lib/entry-steps-mutations.ts` silently drops invalid paint IDs.
- Photo pipeline: `entry-photos` bucket + `storage.objects` RLS; `uploadEntryPhoto` / `createSignedPhotoUrl(Map)` in `src/lib/entry-photos-storage.ts`.
- Detail loaders: `loadEntryForEdit`, `loadEntryPaints`, `loadEntrySteps`, `resolveEntryFinalPhotoUrl` in `src/lib/*-page.ts`; orchestrated by `src/pages/entries/[id].astro`.
- Seed fixture `ENTRY_A` with paints, steps, one assignment, model fields — **no photos** (`supabase/seed.sql:160-232`).

**Gaps:**

- No tests asserting paint-list invariant beyond RLS cross-user mutations.
- No Storage upload / signed-URL / fetch recall tests.
- No loader-completeness tests importing `src/lib` page loaders.
- test-plan §6.6 has no Phase 3 note; §6.3 e2e still TBD.

### Key Discoveries:

- Invalid paint IDs are **silently dropped** at app and RPC layers — negative tests must inspect `step_paint_assignments` rows, not error responses (`research.md`).
- Photo recall requires three links: Storage object → DB path column → signed URL fetchable via HTTP GET (`research.md`).
- Loader imports in Vitest work via `@/` alias in `vitest.config.ts` — no Astro dev server required for Phase 3 tests.
- `httpPostForm` has no multipart support; photo tests use authenticated `supabase.storage.upload` (real Storage, no mocks).

## Desired End State

After this change:

- `tests/helpers/test-image.ts` exposes a minimal valid PNG `File`/`Blob` for Storage uploads.
- `tests/integration/entry-workflow-integration.test.ts` covers risks #2, #4, and #5 with structured assertions (DB rows, signed URLs + fetch, loader shapes).
- `npm test` passes with **only** local Supabase running (`npx supabase start && npx supabase db reset`) — dev server **not** required for this file.
- `context/foundation/test-plan.md` §6.6 documents Phase 3; §6.2 or new §6.7 subsection describes workflow integration pattern.
- `npm run lint` and `npm run build` still pass.
- CI unchanged until rollout Phase 4.

### Verification

- Forged / cross-entry paint ID on step sync → junction table has **no** invalid rows for that step.
- Direct cross-entry junction `INSERT` → Postgres error from trigger.
- Owner uploads step + final photo → DB paths set → loaders return non-null `photo_url` / final URL → `fetch(url)` returns 200 with image content-type.
- User B cannot `createSignedUrls` or `download` User A's photo path.
- `loadEntryForEdit` + `loadEntryPaints` + `loadEntrySteps` on `ENTRY_A` match seed oracle (title, model fields, paint names, step order, step 1 Wraithbone assignment).

## What We're NOT Doing

- HTTP multipart upload tests or `httpPostMultipart` helper (defer unless e2e golden path is scoped later).
- Astro dev server dependency for Phase 3 suite.
- Playwright / e2e (test-plan §6.3 remains TBD).
- HTML snapshot tests on `[id].astro`.
- Mocking Supabase Storage.
- CI wiring (`npm test` in GitHub Actions — rollout Phase 4).
- Re-testing RLS cross-user isolation (Phase 1) or middleware redirects (Phase 2).
- Changing production handlers, loaders, or DB schema (tests + docs only).

## Implementation Approach

Four phases aligned with research sub-phases 3.1–3.4: (1) shared test image helper + paint invariant cases, (2) Storage recall + non-owner denial, (3) loader completeness including post-upload photo fields, (4) test-plan cookbook + AGENTS.md note. Single integration file groups workflow concerns; ephemeral second entry created in `beforeAll` for cross-entry paint cases and cleaned in `afterAll`.

## Critical Implementation Details

**Silent paint drop oracle:** When `sync_step_paint_assignments` or `updateStepWithAssignments` receives paint IDs not on the entry palette, the RPC completes without error but inserts zero matching rows. Tests must `SELECT` from `step_paint_assignments` (or call `loadEntrySteps` and inspect `assigned_paints`) — not assert `{ ok: true }` from the mutation wrapper alone.

**Storage cleanup:** `db reset` does not clear the `entry-photos` bucket. Use `upsert: true` on test uploads (matches production) or `afterAll` `storage.remove` for paths created in the suite. Ephemeral entry B and its paints should be deleted in `afterAll` to avoid polluting subsequent manual Studio inspection.

**Loader test boundary:** Import loaders from `@/lib/entries-page`, `@/lib/entry-paints-page`, `@/lib/entry-steps-page` — same functions `[id].astro` calls. Assert field values against `supabase/seed.sql` strings and fixture UUIDs in `seed-fixtures.ts`, not against implementation helpers like `filterValidPaintIds`.

## Phase 1: Test helpers and paint invariant (Risk #2)

### Overview

Add minimal image fixture helper and integration tests proving step assignments cannot retain paints outside the entry palette — at RPC, app, and trigger layers.

### Changes Required:

#### 1. Minimal test image helper

**File**: `tests/helpers/test-image.ts` (new)

**Intent**: Provide a tiny valid PNG usable by Storage upload tests in Phase 2 without committing binary fixture files.

**Contract**: Export a function returning a `File` (or `Blob` + metadata) with `type: "image/png"`, size &lt; 1 KB, magic bytes passing `detectImageMimeFromHeader` in `src/lib/entry-photos-api.ts`.

#### 2. Workflow integration test file — paint invariant section

**File**: `tests/integration/entry-workflow-integration.test.ts` (new)

**Intent**: Prove risk #2 with DB-backed assertions; establish shared `beforeAll`/`afterAll` for clients A/B and ephemeral entry B.

**Contract**:

- `beforeAll`: `requireLocalSupabase()`; sign in `clientA`/`clientB`; create ephemeral `entryB` + one `entry_paints` row via `clientA` (track IDs for cleanup).
- `afterAll`: delete ephemeral entry (cascade); sign out both clients.
- **Bogus UUID**: `clientA.rpc("sync_step_paint_assignments", { p_entry_id: ENTRY_A.id, p_step_id: STEPS_A.layer, p_paint_ids: [random uuid] })` then query assignments for `STEPS_A.layer` — expect length 0 (or unchanged from before).
- **Cross-entry paint**: call sync/update with `entryB`'s paint ID on `ENTRY_A` step — junction must not link foreign paint.
- **Trigger rejection**: `clientA.from("step_paint_assignments").insert({ step_id: STEPS_A.prime, entry_paint_id: entryB_paint_id })` — expect `error` non-null.
- **Happy path**: `updateStepWithAssignments` (import from `@/lib/entry-steps-mutations`) assigning `PAINTS_A.imperialFist` to `STEPS_A.layer` — junction row exists; `loadEntrySteps` shows Imperial Fist in `assigned_paints` for that step.
- **Inline-add analog**: insert new paint on `ENTRY_A` via client, then assign to step via `updateStepWithAssignments` — junction row exists (proves add-to-palette-then-assign without HTTP).

Describe blocks: `describe("paint assignment invariant (Risk #2)", ...)`.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` succeeds
- `npm test` passes with local Supabase only (dev server not required)
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- None required — fully automated signal.

**Implementation Note**: Pause for human confirmation after Phase 1 automated checks pass.

---

## Phase 2: Photo recall path (Risk #4)

### Overview

Prove owner can upload to real Storage, persist path columns, resolve signed URLs, and fetch image bytes; prove user B cannot access user A's objects.

### Changes Required:

#### 1. Photo recall tests in workflow suite

**File**: `tests/integration/entry-workflow-integration.test.ts` (extend)

**Intent**: Exercise full upload → DB path → signed URL → HTTP GET chain without mocking Storage.

**Contract**:

- Use `buildStepPhotoPath` / `buildFinalPhotoPath` from `@/lib/entry-photos-api` and `uploadEntryPhoto` from `@/lib/entry-photos-storage` (or direct `supabase.storage.upload` then DB update mirroring `applyStepPhotoFromForm` / `applyFinalPhotoFromForm` column writes).
- After upload: assert `steps.storage_path` / `entries.final_photo_path` match expected paths.
- Call `createSignedPhotoUrl` / `createSignedPhotoUrlMap` as owner — URLs non-null.
- `fetch(signedUrl)` → status 200; `content-type` matches `image/`.
- As `clientB`: `createSignedUrls` on A's path returns empty or errors; `storage.download` fails or returns error.
- `afterAll` or per-test cleanup: remove uploaded objects from bucket.

Describe block: `describe("photo recall (Risk #4)", ...)`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes (Supabase only)
- `npm run lint` passes

#### Manual Verification:

- Optional: open signed URL in browser during local debugging — not a merge gate.

**Implementation Note**: Pause for human confirmation after Phase 2 automated checks pass.

---

## Phase 3: Detail loader completeness (Risk #5)

### Overview

Import the same loaders the detail page uses; assert structured recipe data against seed oracle and photo fields after Phase 2 setup.

### Changes Required:

#### 1. Loader completeness tests

**File**: `tests/integration/entry-workflow-integration.test.ts` (extend)

**Intent**: Prove risk #5 at the loader boundary — not HTML rendering.

**Contract**:

- On `ENTRY_A` with `clientA`:
  - `loadEntryForEdit`: `title`, `model_info`, `model_origin_note`, `status` match seed strings.
  - `loadEntryPaints`: length 2; names include "Wraithbone" and "Imperial Fist" (order by name asc per loader).
  - `loadEntrySteps`: positions `[1, 2]` ascending; step 1 description matches seed; step 1 `assigned_paints` contains Wraithbone (`PAINTS_A.wraithbone`); step 2 has empty `assigned_paints`.
- After Phase 2 photo setup on `ENTRY_A` (or dedicated step): `loadEntrySteps` returns non-null `photo_url` for uploaded step; `resolveEntryFinalPhotoUrl` non-null when `final_photo_path` set.
- Do **not** assert `loadEntryList` — list page is out of scope for risk #5.

Describe block: `describe("detail loader completeness (Risk #5)", ...)`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes (Supabase only)
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- None required.

**Implementation Note**: Pause for human confirmation after Phase 3 automated checks pass.

---

## Phase 4: Cookbook and test-plan documentation

### Overview

Backport Phase 3 patterns into `context/foundation/test-plan.md` and contributor docs so future workflow tests follow the same boundaries.

### Changes Required:

#### 1. Test plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Document Phase 3 shipped patterns; update §3 Phase 3 status when implementation completes.

**Contract**:

- Add **Phase 3** paragraph under §6.6 Per-rollout-phase notes: file name, risks #2/#4/#5, Supabase-only prerequisite, loader import pattern, Storage recall pattern, anti-patterns avoided.
- Optionally extend §6.2 with one bullet pointing workflow tests at `entry-workflow-integration.test.ts` and `test-image.ts` helper.
- Leave §6.3 e2e as TBD unless team explicitly promotes golden path — do not mark e2e shipped.

#### 2. AGENTS.md test note (minimal)

**File**: `AGENTS.md`

**Intent**: Agents running `npm test` know Phase 3 workflow file needs Supabase only (unlike HTTP auth tests).

**Contract**: One sentence under Tests bullet: workflow integration (`entry-workflow-integration.test.ts`) requires local Supabase only; auth HTTP tests still need `npm run dev`.

### Success Criteria:

#### Automated Verification:

- `npm test` full suite passes
- `npm run lint` passes

#### Manual Verification:

- Read §6.6 Phase 3 note — a new contributor can locate workflow test file, helpers, and prerequisites without reading this plan.

**Implementation Note**: Final phase — marks rollout Phase 3 complete in test-plan §3 when Progress is fully checked.

---

## Testing Strategy

### Integration Tests (primary):

| Risk | Regression caught | Oracle source |
|------|-------------------|---------------|
| #2 | Step retains foreign/bogus paint | `step_paint_assignments` rows; `loadEntrySteps.assigned_paints` |
| #4 | Upload succeeds but recall broken | DB path + signed URL + `fetch` 200 |
| #5 | Detail omits recipe fields | Seed strings/UUIDs via loader return shapes |

### Anti-patterns explicitly avoided:

- Asserting checkbox state or redirect `updated=1` without DB check (#2).
- Mocking `supabase.storage` (#4).
- Snapshotting `[id].astro` HTML (#5).
- Copying `filterValidPaintIds` logic into expected values (#2).

### Manual Testing Steps:

1. `npx supabase start && npx supabase db reset`
2. `npm test` — all three describe blocks green without `npm run dev`
3. `npm run lint && npm run build`

## Performance Considerations

Single integration file with ~15–20 cases; Storage uploads are tiny PNGs. No dev server reduces local test friction vs Phase 2.

## Migration Notes

No schema changes. Developers gain a third integration file; full `npm test` still runs HTTP suite which needs dev server until CI Phase 4 documents split workflows.

## References

- Research: `context/changes/testing-entry-workflow-integration/research.md`
- Test plan: `context/foundation/test-plan.md` §2–§3 Phase 3
- Phase 1 plan: `context/archive/2026-06-11-testing-runner-bootstrap-rls-floor/plan.md`
- Phase 2 plan: `context/archive/2026-06-11-testing-auth-and-route-protection/plan.md`
- Paint filter: `src/lib/entry-steps-mutations.ts:6-70`
- Storage RLS: `supabase/migrations/20260608122840_entry_photo_storage.sql`
- Detail loaders: `src/lib/entries-page.ts`, `src/lib/entry-paints-page.ts`, `src/lib/entry-steps-page.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Test helpers and paint invariant (Risk #2)

#### Automated

- [x] 1.1 `npx supabase db reset` succeeds
- [x] 1.2 `npm test` passes with local Supabase only
- [x] 1.3 `npm run lint` passes
- [x] 1.4 `npm run build` passes

#### Manual

- [x] 1.5 (none — N/A for this phase)

### Phase 2: Photo recall path (Risk #4)

#### Automated

- [ ] 2.1 `npm test` passes with local Supabase only
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 (none — N/A for this phase)

### Phase 3: Detail loader completeness (Risk #5)

#### Automated

- [ ] 3.1 `npm test` passes with local Supabase only
- [ ] 3.2 `npm run lint` passes
- [ ] 3.3 `npm run build` passes

#### Manual

- [ ] 3.4 (none — N/A for this phase)

### Phase 4: Cookbook and test-plan documentation

#### Automated

- [ ] 4.1 `npm test` full suite passes
- [ ] 4.2 `npm run lint` passes

#### Manual

- [ ] 4.3 test-plan §6.6 Phase 3 note is sufficient for contributor onboarding
