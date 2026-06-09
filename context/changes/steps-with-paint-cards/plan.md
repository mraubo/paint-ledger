# Steps with Paint Cards Implementation Plan

## Overview

Deliver S-04 (FR-006, FR-007, FR-008): authenticated users add ordered tutorial steps with text descriptions, assign paints from the entry-level palette (with inline add-to-palette from the step edit flow), and see assigned paints as cards showing name and approximate color swatch. Dedicated `/entries/[id]/steps` page linked from entry edit, following the S-03 form POST + redirect pattern. No schema migration — `steps`, `step_paint_assignments`, RLS, and the same-entry trigger exist from F-01.

## Current State Analysis

**Already in place:**

- `steps` table: `position` (1-based, `UNIQUE(entry_id, position)`), `description`, `entry_id` FK with cascade delete (`supabase/migrations/20260608103251_paint_log_schema.sql`).
- `step_paint_assignments` junction: PK `(step_id, entry_paint_id)`; `enforce_step_paint_same_entry` trigger blocks cross-entry assignments.
- Generated types in `src/lib/database.types.ts` (`steps`, `step_paint_assignments` Row/Insert/Update).
- Owner-only RLS on `steps` and `step_paint_assignments` via parent `entries.user_id`.
- S-03 paint palette: `/entries/[id]/paints`, paint CRUD APIs, `EntryPaintForm`, `ColorField`, `entry-paints-api.ts`, `entry-paints-page.ts`.
- S-02 entry shell: `/entries`, `/entries/new`, `/entries/[id]`, `EntryBasicsForm`, `entries-api.ts`, `entries-page.ts`.
- Middleware protects `/entries` and `/api/entries` prefixes (`src/middleware.ts`).
- Seed data includes two ordered steps and one paint assignment (`supabase/seed.sql`).

**Gaps for S-04:**

- No `.from("steps")` or `.from("step_paint_assignments")` queries in `src/`.
- No step API routes or React components.
- No `/entries/[id]/steps` page.
- No paint cards on steps; no assignment UI.
- Paint delete has no guard when paints are assigned to steps.
- Entry edit page has no navigation to steps.

### Key Discoveries

- PRD FR-008: no step title in MVP — only position + description.
- PRD FR-006 Socrates resolution: inline add during step writing is allowed, but assigned paints must belong to the entry-level list (DB trigger enforces; API/UI must not offer cross-entry paints).
- PRD FR-007: approximate color is a visual cue, not exact paint match — reuse S-03 swatch pattern.
- Roadmap S-04 risk: entry paint list is source of truth — partial enforcement breaks S-06 recall.
- S-03 shipped URL-based `?edit=<paintId>` edit (not inline expand) — mirror for steps.
- `entry_paints` has no `position` column — palette sorted by name; step order uses `steps.position`.

## Desired End State

After S-04:

- Signed-in user opens `/entries/[id]` and follows "Manage steps" to `/entries/[id]/steps`.
- Steps page lists ordered steps (by `position`) with description text and paint cards (swatch + name) per step; empty state prompts first add.
- User adds a step via form (description required or allowed empty per DB default `''` — match paints pattern: require non-empty trim on create).
- User edits a step via `?edit=<stepId>`: description field, multi-select checklist of entry paints, collapsible inline "Add paint" mini-form.
- Inline add POSTs to existing paint create API and redirects back to `?edit=<stepId>` with new paint available (pre-checked when `paint_added` query present).
- User moves steps with Move up / Move down buttons (swap adjacent positions).
- User deletes a step via `confirm()` → form POST; remaining steps renumber to contiguous `1…n`.
- User cannot delete an entry paint that is assigned to any step — clear error on paints page.
- Success feedback via query flags: `?added=`, `?updated=`, `?deleted=`, `?moved=` (POST-redirect-GET).
- `npm run lint` and `npm run build` pass.

### Verification

- Manual: sign in → open entry → manage steps → add two steps → assign paints → inline-add a paint from step edit → move step order → delete step → verify cards and order.
- Manual: assign paint to step → attempt delete paint on paints page → verify blocked with actionable error.
- Manual RLS: second user cannot read or mutate steps/assignments on another user's entry.
- curl (optional): authenticated POST to step APIs per AGENTS.md `.cookies` pattern.

## What We're NOT Doing

- Step photos or `steps.storage_path` upload (S-05).
- Entry list/detail recall views (S-06).
- Step titles (PRD MVP scope).
- Drag-and-drop reorder.
- Paint catalog, manufacturer autocomplete, or external imports.
- JSON `fetch`-based SPA save flow.
- Automated test suite (none in repo).
- Topbar or entry-list shortcuts to steps (navigation from entry edit + cross-link to paints only).
- Combined paints+steps single page.

## Implementation Approach

Three phases mirroring S-03: (1) step + assignment APIs, move/reorder, position renumber on delete, paint-delete guard; (2) `EntryStepForm`, `PaintCard`, collapsible inline paint add; (3) `steps.astro` SSR list with paint cards, `?edit=` flow, move controls, banners, and entry-edit navigation link. Writes through API routes; reads in Astro frontmatter.

## Critical Implementation Details

**Position contract.** New steps append at `max(position) + 1` (or `1` if none). After delete, renumber all steps with `position > deleted` down by 1 in the same handler (or a shared helper) so positions stay contiguous `1…n`. Move up/down swaps `position` with the adjacent step in a single logical operation (two-row update scoped to the entry).

**Assignment sync on step update.** Step update POST carries `description` plus zero or more `entry_paint_id` values (checkbox group). Server replaces junction rows for that `step_id`: delete existing assignments for the step, insert checked IDs. Only paints belonging to the same `entry_id` are valid — rely on RLS + trigger; filter submitted IDs against `loadEntryPaints` result server-side before insert.

**Inline add redirect.** Extend paint create handler to accept an optional `redirect_to` form field (same-origin path only, e.g. `/entries/[id]/steps?edit=[stepId]`). On success, redirect there with `paint_added=<newPaintId>` instead of paints list. Step edit form reads `paint_added` to pre-check the new paint in the checklist.

**Paint delete guard.** Before deleting `entry_paints`, query `step_paint_assignments` for rows with `entry_paint_id = paintId`. If any exist, redirect to paints page with encoded error (e.g. "This paint is assigned to one or more steps. Unassign it from steps first.").

## Phase 1: Step API and shared helpers

### Overview

Establish step mutation endpoints, assignment sync, reorder, delete-with-renumber, and paint-delete guard. Verify create and assignment via curl before building UI.

### Changes Required:

#### 1. Step API helpers

**File**: `src/lib/entry-steps-api.ts` (new)

**Intent**: Centralize step form parsing, path helpers, ID validation, and assignment field parsing so handlers stay consistent.

**Contract**:

- `EntryStepFields`: `{ description }` — string; trim required on create/update (non-empty after trim).
- `parseEntryStepFormData(formData)`: returns `{ ok: true, fields }` or `{ ok: false, error }`; `description` max length (e.g. 10_000, match entries text fields).
- `parseStepPaintIds(formData)`: read repeated `entry_paint_ids` (or equivalent checkbox name); return deduplicated UUID strings; invalid UUIDs dropped.
- `isValidStepId(id)`: same UUID regex as `isValidEntryId`.
- `stepsPagePath(entryId)`: `/entries/${entryId}/steps`.
- `stepEditPath(entryId, stepId)`: `/entries/${entryId}/steps?edit=${stepId}`.

#### 2. Step SSR loaders

**File**: `src/lib/entry-steps-page.ts` (new)

**Intent**: Load ordered steps with assigned paint rows for SSR pages.

**Contract**:

- `EntryStepRow`: step fields plus `assigned_paints: Array<{ id, name, approximate_color }>` ordered by paint name (or assignment created_at — pick one and document).
- `loadEntrySteps(supabase, entryId)`: returns `{ ok: true, steps } | { ok: false, error }`; query `steps` `.order("position")`; join assignments + `entry_paints` for card data.
- Reuse `loadEntryExists` pattern from `entry-paints-page.ts` where needed.

#### 3. Create step API

**File**: `src/pages/api/entries/[id]/steps/index.ts` (new)

**Intent**: Accept form POST from add flow; insert step at next position for owned entry; redirect to steps list.

**Contract**:

- `POST` only; validate entry UUID; `requireUser()`.
- Parse description; on error → redirect `stepsPagePath(id)?error=`.
- Compute next position: `select max(position)` for entry or use `1`.
- `.insert({ entry_id, position, description })`.
- On success → redirect `?added=1`.

#### 4. Update step API (description + assignments)

**File**: `src/pages/api/entries/[id]/steps/[stepId].ts` (new)

**Intent**: Update step description and replace paint assignments from checkbox group.

**Contract**:

- `POST` only; validate `id` and `stepId` UUIDs.
- Parse description and `entry_paint_ids`.
- Verify step belongs to entry (`.eq("id", stepId).eq("entry_id", id)`).
- Update `description`; sync assignments (delete all for step, insert validated paint IDs).
- On success → redirect `?edit=<stepId>&updated=1` if request included `return_to_edit=1` hidden field, else `?updated=1`.

#### 5. Delete step API

**File**: `src/pages/api/entries/[id]/steps/[stepId]/delete.ts` (new)

**Intent**: Delete owned step and renumber remaining positions.

**Contract**:

- `POST` only; validate UUIDs.
- Load deleted step's `position`; delete row (assignments cascade).
- Renumber: decrement `position` by 1 for all steps in same entry where `position > deletedPosition`.
- On success → redirect `?deleted=1`.

#### 6. Move step API

**File**: `src/pages/api/entries/[id]/steps/[stepId]/move.ts` (new)

**Intent**: Swap position with adjacent step (move up or move down).

**Contract**:

- `POST` only; form field `direction` ∈ `{ up, down }`.
- Load current step position; find neighbor at `position - 1` or `position + 1`.
- If no neighbor → redirect with error (already at top/bottom).
- Swap `position` values between the two rows (two updates, same entry scope).
- On success → redirect `?moved=1`.

#### 7. Paint create redirect extension

**File**: `src/pages/api/entries/[id]/paints/index.ts` (modify)

**Intent**: Support inline add from step edit by redirecting back to steps edit URL.

**Contract**:

- Optional form field `redirect_to`: if present and matches allowed pattern (`^/entries/[uuid]/steps(\?edit=[uuid])?$` or stricter same-entry steps path), redirect there with `paint_added=<newId>` on success instead of default paints list `?added=1`.
- Reject off-origin or malformed `redirect_to` — fall back to default paints redirect.

#### 8. Paint delete assignment guard

**File**: `src/pages/api/entries/[id]/paints/[paintId]/delete.ts` (modify)

**Intent**: Block delete when paint is assigned to any step.

**Contract**:

- Before delete, `select` from `step_paint_assignments` where `entry_paint_id = paintId` (limit 1).
- If row exists → redirect paints page with user-facing error; do not delete.
- Otherwise proceed with existing delete flow.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Unauthenticated POST to step APIs redirects to sign-in
- Authenticated POST creates `steps` row at next position with correct `entry_id`
- Authenticated POST update changes description and replaces assignments; invalid paint IDs ignored or rejected
- Authenticated POST delete removes step and renumbers positions to contiguous sequence
- Authenticated POST move swaps adjacent positions; top/bottom move fails gracefully
- Paint delete blocked when paint assigned to a step; succeeds when unassigned
- Paint create with valid `redirect_to` returns to step edit with `paint_added`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Step form components

### Overview

Build React form for step add/edit with paint checklist, reusable paint card display, and collapsible inline paint add using existing paint field parsing.

### Changes Required:

#### 1. Paint card component

**File**: `src/components/entries/PaintCard.tsx` (new)

**Intent**: Render FR-007 paint card: approximate color swatch + paint name for step list and edit contexts.

**Contract**:

- Props: `{ name: string; approximate_color: string }` (optional `className`).
- Swatch uses `isValidHexColor` fallback `#000000` for SSR safety (match `paints.astro`).
- Accessible: swatch `aria-hidden`; name in text node.

#### 2. Entry step form

**File**: `src/components/entries/EntryStepForm.tsx` (new)

**Intent**: Add and edit step descriptions with paint assignment checkboxes; edit mode includes collapsible inline paint add.

**Contract**:

- Discriminated props: `{ mode: "add"; entryId }` | `{ mode: "edit"; entryId; stepId; initialDescription; entryPaints; assignedPaintIds; paintAddedId?: string }`.
- `entryPaints`: full palette for checklist labels (name + optional brand/color description in label).
- Checkboxes named `entry_paint_ids` with values = paint UUIDs; `assignedPaintIds` sets initial checked state; `paintAddedId` forces checked for newly inline-added paint.
- Description via `TextareaField`; client validation for non-empty description.
- `mode: "add"` → POST `/api/entries/[id]/steps`.
- `mode: "edit"` → POST `/api/entries/[id]/steps/[stepId]` with hidden `return_to_edit=1`.
- Reuse `FormField`, `TextareaField`, `SubmitButton`, `ServerError` from `src/components/auth/`.

#### 3. Inline paint add (collapsible)

**File**: `src/components/entries/EntryStepInlinePaintAdd.tsx` (new) or section inside `EntryStepForm.tsx`

**Intent**: Collapsible "Add paint to entry" mini-form on step edit only (FR-006).

**Contract**:

- Toggle reveals fields matching `EntryPaintForm` (name, brand, color_description, color) — reuse `ColorField`.
- POST to `/api/entries/[id]/paints` with hidden `redirect_to` = current step edit URL.
- Not shown in `mode: "add"` (user can assign only existing paints when creating first step, or link to paints page in helper text).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Add form submits description; validation surfaces empty description
- Edit form shows checklist reflecting current assignments; save updates assignments
- Collapsible inline add posts paint and returns with new paint checked
- `PaintCard` renders swatch + name for valid and invalid hex

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Steps page and navigation

### Overview

Wire SSR steps page with ordered list, paint cards per step, `?edit=` flow, move/delete controls, banners, and navigation links from entry edit and paints page.

### Changes Required:

#### 1. Steps page

**File**: `src/pages/entries/[id]/steps.astro` (new)

**Intent**: SSR load steps + paints; render list view or `?edit=<stepId>` edit view mirroring `paints.astro` structure.

**Contract**:

- Frontmatter: validate `id` → load entry → `loadEntrySteps` + `loadEntryPaints` for edit form palette.
- List view: each step shows position label (e.g. "Step 1"), description, row of `PaintCard` components, actions: Edit (`?edit=`), Move up/down forms POST to move API, Delete form with `confirm()`.
- Edit view: `EntryStepForm` `client:load` with paints + assignments; inline add section; cancel link back to list.
- Add form at top or bottom of list (match paints page placement).
- Banners: `?added=`, `?updated=`, `?deleted=`, `?moved=`; errors via `?error=`.
- Footer: "Manage paints" link, "Back to entry", "Back to entries".

#### 2. Entry edit navigation

**File**: `src/pages/entries/[id].astro` (modify)

**Intent**: Link from entry edit hub to steps page (parallel to "Manage paints").

**Contract**:

- Add "Manage steps" link to `/entries/${entry.id}/steps` adjacent to existing paints link.

#### 3. Paints page cross-link (optional but recommended)

**File**: `src/pages/entries/[id]/paints.astro` (modify)

**Intent**: Symmetric navigation between paints and steps.

**Contract**:

- Add "Manage steps" link in footer nav next to "Back to entry".

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Full FR-006/007/008 flow works from UI while signed in
- Empty steps state shows helpful CTA
- Step not found / invalid `?edit=` param handled gracefully
- Move up/down and delete reflect correct order after refresh
- Entry edit → steps → paints → entry navigation works
- Unauthenticated access to `/entries/[id]/steps` redirects per middleware

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None in repo for MVP — rely on shared parse helpers' straightforward validation (manual curl covers API contracts).

### Integration Tests:

- None in repo — manual authenticated curl per AGENTS.md `.cookies` for step create/update/delete/move in Phase 1.

### Manual Testing Steps:

1. Create entry with two paints on paints page.
2. Add three steps; assign different paint combinations via edit checklists.
3. Inline-add a third paint from step 2 edit; verify it appears checked and on paints page.
4. Move middle step down then up; verify order labels and positions.
5. Delete first step; verify renumbering to 1, 2.
6. Assign paint A to a step; attempt delete paint A on paints page — expect error.
7. Unassign paint A from step; delete paint A — expect success.
8. Sign in as second user; confirm cannot access first user's steps URLs or APIs.

## Performance Considerations

- Step list per entry is small (hobby paint logs); single query with nested select or two queries (steps + assignments join) is sufficient.
- Assignment sync on update is delete-all + insert-all for one step — acceptable at MVP scale.
- No pagination required.

## Migration Notes

- No database migration. Apply existing F-01 migrations locally if fresh DB.
- Regenerate types only if schema changed (not expected): `npx supabase gen types`.

## References

- Roadmap S-04: `context/foundation/roadmap.md` (lines 131–141)
- PRD FR-006–008: `context/foundation/prd.md` (lines 87–95)
- S-03 pattern reference: `context/archive/2026-06-08-entry-paint-palette/plan.md`
- Schema + RLS: `supabase/migrations/20260608103251_paint_log_schema.sql`
- Seed steps: `supabase/seed.sql`
- Entry edit hub: `src/pages/entries/[id].astro`
- Paints page template: `src/pages/entries/[id]/paints.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Step API and shared helpers

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — e564775
- [x] 1.2 Build passes: `npm run build` — e564775

#### Manual

- [x] 1.3 Unauthenticated POST to step APIs redirects to sign-in — e564775
- [x] 1.4 Authenticated POST creates `steps` row at next position with correct `entry_id` — e564775
- [x] 1.5 Authenticated POST update changes description and replaces assignments — e564775
- [x] 1.6 Authenticated POST delete removes step and renumbers positions — e564775
- [x] 1.7 Authenticated POST move swaps adjacent positions; edge moves fail gracefully — e564775
- [x] 1.8 Paint delete blocked when assigned; paint create `redirect_to` returns to step edit — e564775

### Phase 2: Step form components

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`

#### Manual

- [ ] 2.3 Add form validates and submits description
- [ ] 2.4 Edit form checklist reflects and saves assignments
- [ ] 2.5 Inline add returns with new paint checked
- [ ] 2.6 PaintCard renders swatch + name safely

### Phase 3: Steps page and navigation

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 Full FR-006/007/008 UI flow while signed in
- [ ] 3.4 Empty state, invalid edit param, and error banners behave correctly
- [ ] 3.5 Move, delete, and cross-navigation (entry ↔ steps ↔ paints) work
- [ ] 3.6 Unauthenticated `/entries/[id]/steps` redirects per middleware
