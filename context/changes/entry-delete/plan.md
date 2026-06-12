# Entry Delete Implementation Plan

## Overview

Let authenticated users permanently delete their own paint log entries from the edit page and the entry list. Deletion removes the entry row (CASCADE to paints, steps, and assignments) and best-effort cleans up step and final photo objects in Storage **before** the DB row is removed — Storage RLS requires entry/step rows to exist for `storage.objects` DELETE.

## Current State Analysis

**Already in place:**

- `entries_delete_own` RLS policy and `ON DELETE CASCADE` from `entries` to `entry_paints`, `steps`, and `step_paint_assignments` (`supabase/migrations/20260608103251_paint_log_schema.sql`).
- `deleteEntryPhoto()` helper in `src/lib/entry-photos-storage.ts` (single-path remove; 404 = success).
- Paint and step delete patterns: `POST` API route, `requireUser`, scoped delete, redirect with query param, native `confirm()` on SSR form (`src/pages/api/entries/[id]/paints/[paintId]/delete.ts`, `src/pages/api/entries/[id]/steps/[stepId]/delete.ts`).
- Step delete loads `storage_path` before DB mutation, then best-effort storage cleanup after (`src/pages/api/entries/[id]/steps/[stepId]/delete.ts` lines 32–50) — **entry delete inverts this order** because Storage policies check entry/step row existence.
- RLS isolation test: user B cannot delete user A's entry (`tests/integration/rls-isolation.test.ts`).

**Gaps:**

- No `POST /api/entries/[id]/delete` route.
- No shared entry-delete mutation helper.
- No delete UI on `edit.astro` or `index.astro`.
- List page has `?created=` banner only — no `?deleted=` handling.
- No HTTP IDOR test for entry delete API.
- PRD has no explicit delete FR; roadmap has no post-S-06 slice for this capability (explicitly deferred in S-02 and S-06 plans).

### Key Discoveries:

- F-02/S-05 documented that full entry delete may leave Storage orphans until a follow-up slice — this change closes that gap at the app layer (`context/archive/2026-06-09-entry-step-and-final-photos/plan.md`).
- `/api/entries` is already in middleware protection — no `PROTECTED_ROUTES` change (`src/middleware.ts`).
- List row layout has a right-aligned badge cluster (`index.astro` lines 86–100) — inline Delete fits alongside status/step-count badges.

## Desired End State

After this change:

- User on `/entries/[id]/edit` sees a **Danger zone** section with a red **Delete entry** button. Confirming deletes the entry and redirects to `/entries?deleted=<encoded title>`.
- User on `/entries` sees a red **Delete** button per row. Confirming deletes that entry and redirects to the same success URL.
- List shows a green banner: e.g. `"<title>" deleted` when `deleted` query param is present.
- Draft and ready entries are both deletable; no status gate.
- Storage cleanup runs before DB delete; storage failures are logged and do not block DB deletion.
- Child rows (paints, steps, assignments) are removed via CASCADE — no paint-assignment guard needed.
- `npm run lint`, `npm run build`, and integration tests pass with new HTTP IDOR and workflow coverage.

### Verification

- Manual: create entry with paints, steps, and photos → delete from edit → list banner shows title → entry gone from list → detail/edit return not-found.
- Manual: delete from list row → same outcome.
- Manual: second user cannot delete first user's entry (redirect with error, row unchanged).

## What We're NOT Doing

- Typed-title confirmation or double-dialog UX.
- Delete from read-only detail page (`/entries/[id]`).
- Status gate (draft-only delete or revert-before-delete).
- Aborting delete when storage cleanup fails.
- Storage object assertions in CI (best-effort cleanup only).
- Schema migrations or new RPCs.
- JSON DELETE API or client-side fetch delete.
- Bulk delete or archive/soft-delete.
- Search/filter/pagination changes on list.

## Implementation Approach

Three phases: (1) shared delete mutation + API route with storage-before-DB ordering, (2) edit-page danger zone + list inline delete + personalized list banner, (3) HTTP integration tests and foundation doc updates (PRD FR + roadmap S-07). Follow existing POST+redirect+confirm patterns from paint/step delete.

## Critical Implementation Details

**Storage-before-DB ordering.** `entry_photos_delete_own` on `storage.objects` requires the entry row (and step row for step paths) to exist. Load `final_photo_path` and all step `storage_path` values, call `deleteEntryPhoto` for each non-null path (best-effort, `console.warn` on failure), then `DELETE FROM entries`. This is the inverse of step delete, which removes the DB row first via RPC then cleans storage.

**Redirect title source.** The `deleted` query param value must come from the entry row loaded **before** deletion (server-side), never from client-submitted form fields — prevents spoofed banner text.

## Phase 1: Delete mutation and API route

### Overview

Add a reusable delete helper and authenticated POST handler that cleans storage then removes the entry row.

### Changes Required:

#### 1. Entry delete mutation helper

**File**: `src/lib/entry-delete.ts` (new)

**Intent**: Centralize load-paths → storage cleanup → DB delete so the API route stays thin and tests can call the helper directly if needed.

**Contract**: Export `deleteEntryWithPhotos(supabase, userId, entryId)` returning `{ ok: true; title: string } | { ok: false; error: string }`. Load entry scoped to `id` + `user_id` selecting `id`, `title`, `final_photo_path`. Return `{ ok: false, error: "Entry not found" }` when missing. Load all `steps.storage_path` for the entry. For each non-null path in step paths plus `final_photo_path`, call `deleteEntryPhoto` — log failures with `console.warn`, do not abort. Delete entry with `.from("entries").delete().eq("id", entryId).eq("user_id", userId).select("id, title").maybeSingle()` — treat missing `data` as not found. On success return `{ ok: true, title: data.title }`.

#### 2. Delete API route

**File**: `src/pages/api/entries/[id]/delete.ts` (new)

**Intent**: Form POST endpoint for delete buttons on edit page and list.

**Contract**: Mirror paint/step delete handlers: validate `entryId` with `isValidEntryId`; `createClient` + `requireUser` (redirect `/auth/signin` if unauthenticated); call `deleteEntryWithPhotos`. On success redirect `/entries?deleted=${encodeURIComponent(title)}`. On failure redirect `/entries?error=${encodeURIComponent(error)}` (invalid id → generic invalid message on list). Use `toUserFacingDbError` for unexpected DB errors if helper surfaces them.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `curl` authenticated POST to `/api/entries/{id}/delete` with `Origin: http://localhost:4321` removes entry from DB and redirects to list with `deleted` param
- Entry with photos: storage objects removed when delete succeeds (check Supabase Storage UI locally)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Delete UI on edit page and list

### Overview

Expose delete via danger zone on edit hub and inline button on each list row; show personalized success banner on list.

### Changes Required:

#### 1. Edit page danger zone

**File**: `src/pages/entries/[id]/edit.astro`

**Intent**: Destructive delete action separated from save/status flows, matching the existing Status section pattern.

**Contract**: New section below Status (after line ~181) with heading "Danger zone", short explanatory copy, and a form `method="POST"` `action={`/api/entries/${entry.id}/delete`}` with `onsubmit="return confirm('Delete this entry?')"` and a red bordered **Delete entry** button styled like paint/step delete buttons (`border-red-500/30`, `text-red-300`, etc.).

#### 2. List row delete button

**File**: `src/pages/entries/index.astro`

**Intent**: Per-row delete without navigating to edit first.

**Contract**: Inside each list `<li>`, add a form posting to `/api/entries/${entry.id}/delete` with `onsubmit="return confirm('Delete this entry?')"` and a small red **Delete** button in the right-side badge cluster (lines 86–100). Button must not nest inside the title link.

#### 3. List deleted banner

**File**: `src/pages/entries/index.astro`

**Intent**: Confirm deletion with the entry title (user decision: personalized banner).

**Contract**: Read `deleted` query param; when non-empty after `decodeURIComponent`, show green success banner: `"<title>" deleted` (Astro text interpolation — no `set:html`). Omit banner when param absent. Optionally cap displayed length at `MAX_TITLE_LENGTH` (200) by truncating with ellipsis if param is abnormally long.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Delete from edit page → list banner shows correct title → entry absent from list
- Delete from list row → same banner and absence
- Cancel confirm dialog → no deletion
- Ready entry with full recipe deletes successfully from both placements

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Tests and foundation docs

### Overview

Add HTTP route protection coverage, extend workflow integration test for owner delete + cascade, and register the capability in PRD and roadmap.

### Changes Required:

#### 1. HTTP IDOR tests

**File**: `tests/integration/auth-route-protection.test.ts`

**Intent**: Cover unauthenticated and cross-user denial for the new delete route.

**Contract**: Add `it("unauthenticated POST /api/entries/{id}/delete redirects to sign-in")` using `httpPostForm` with empty body. Add `it("user B POST /api/entries/{ENTRY_A.id}/delete cannot delete user A entry")` in IDOR describe — expect cross-user redirect denial (`error=` in location, not `deleted=`); verify seed entry `ENTRY_A` still exists via service client after attempt.

#### 2. Workflow integration test extension

**File**: `tests/integration/entry-workflow-integration.test.ts`

**Intent**: Prove owner-scoped delete removes entry and cascades child rows.

**Contract**: In an ephemeral entry fixture (or reuse existing ephemeral `entryBId` pattern), after creating paints/steps, call delete via authenticated client or HTTP POST. Assert entry row gone; assert related `entry_paints` and `steps` counts are zero for that `entry_id`. Use existing cleanup patterns in `afterAll` — ensure test does not delete seed `ENTRY_A`.

#### 3. PRD functional requirement

**File**: `context/foundation/prd.md`

**Intent**: Explicit traceability for delete capability (user confirmed: update PRD if not already present).

**Contract**: Add **FR-013**: User can permanently delete entries they created, including associated paints, steps, and photos. Priority: must-have. Place after FR-012 in the functional requirements list.

#### 4. Roadmap slice

**File**: `context/foundation/roadmap.md`

**Intent**: Register S-07 in the at-a-glance table and slice detail section.

**Contract**: Add row `S-07 | entry-delete | permanently delete an entry and its photos from edit or list | S-06 | FR-013 | planned`. Add `### S-07: Entry delete` section with outcome, change ID, prerequisites, PRD refs, and note that storage cleanup runs app-side before DB delete. Update frontmatter `updated` date.

#### 5. Change identity

**File**: `context/changes/entry-delete/change.md`

**Intent**: Mark change as planned.

**Contract**: Set `status: planned`, `updated: 2026-06-12`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Integration tests pass: `npx supabase start && npx supabase db reset && npm test` (with dev server on port 4321 for HTTP tests)
- Build passes: `npm run build`

#### Manual Verification:

- CI-equivalent local run completes green
- PRD and roadmap entries read correctly and reference `entry-delete` change ID

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- None required — logic is thin orchestration; integration tests cover the path.

### Integration Tests:

- `auth-route-protection.test.ts`: unauthenticated delete redirect; user B cannot delete user A entry.
- `entry-workflow-integration.test.ts`: owner delete removes entry and child rows.
- Existing `rls-isolation.test.ts` entry delete case remains valid (no change required).

### Manual Testing Steps:

1. Create a draft entry with paints, steps, step photo, and final photo.
2. Delete from edit page → confirm banner shows title on list → open old detail URL → not-found redirect.
3. Create another entry → delete from list row → same outcome.
4. Start delete → cancel confirm → entry still present.
5. Sign in as user B → attempt delete on user A entry via API → error redirect, entry unchanged.

## Performance Considerations

Negligible — one entry loads at most a handful of step photo paths. Sequential `deleteEntryPhoto` calls are acceptable for hobby-scale data volumes.

## Migration Notes

No schema migration. Existing entries are unaffected until user deletes them. Orphaned storage objects from prior test-only DB deletes are out of scope (no backfill job).

## References

- Deferred from: `context/archive/2026-06-10-entry-list-and-detail/plan.md` (line 50)
- Storage orphan note: `context/archive/2026-06-09-entry-step-and-final-photos/plan-brief.md`
- Paint delete pattern: `src/pages/api/entries/[id]/paints/[paintId]/delete.ts`
- Step delete + storage: `src/pages/api/entries/[id]/steps/[stepId]/delete.ts`
- Storage helper: `src/lib/entry-photos-storage.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Delete mutation and API route

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — 39a4591
- [x] 1.2 Build passes: `npm run build` — 39a4591

#### Manual

- [x] 1.3 Authenticated curl POST deletes entry and redirects with `deleted` param — 39a4591
- [x] 1.4 Entry with photos: storage objects removed on successful delete — 39a4591

### Phase 2: Delete UI on edit page and list

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`

#### Manual

- [x] 2.3 Delete from edit page shows title banner and removes entry from list
- [x] 2.4 Delete from list row shows title banner and removes entry
- [x] 2.5 Confirm cancel leaves entry intact
- [x] 2.6 Ready entry with full recipe deletes from both placements

### Phase 3: Tests and foundation docs

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Integration tests pass: `npx supabase start && npx supabase db reset && npm test`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 Local CI-equivalent run completes green
- [ ] 3.5 PRD FR-013 and roadmap S-07 entries are correct
