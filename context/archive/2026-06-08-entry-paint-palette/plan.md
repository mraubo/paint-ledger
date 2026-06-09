# Entry Paint Palette Implementation Plan

## Overview

Deliver S-03 (FR-005): authenticated users define an entry-level paint list with name, brand, color description, and approximate color via a native picker plus hex field. Full add/edit/delete on a dedicated paints page, linked from entry edit — following the S-02 form POST + redirect pattern. No schema migration; `entry_paints` and owner-only RLS exist from F-01.

## Current State Analysis

**Already in place:**

- `entry_paints` table: `name` (required), `brand`, `color_description`, `approximate_color` (hex, default `#000000`), `entry_id` FK with cascade delete (`supabase/migrations/20260608103251_paint_log_schema.sql`).
- Generated types in `src/lib/database.types.ts` (`entry_paints` Insert/Row/Update).
- Owner-only RLS on `entry_paints` via parent `entries.user_id`.
- S-02 entry shell: `/entries`, `/entries/new`, `/entries/[id]`, `POST /api/entries`, `POST /api/entries/[id]`, `EntryBasicsForm`, `entries-api.ts`, `entries-page.ts`.
- Middleware protects `/api/entries` prefix (`src/middleware.ts`) — nested paint routes inherit this.
- Seed data demonstrates hex values like `#E5E4D5` (`supabase/seed.sql`).

**Gaps for S-03:**

- No `.from("entry_paints")` queries in `src/`.
- No paint API routes or React components.
- No `/entries/[id]/paints` page.
- No color input primitive in the UI layer.
- Entry edit page has no navigation to paints.

### Key Discoveries

- PRD FR-005 Socrates resolution: plain text fields + approximate color picker — no manufacturer catalog or dropdown dictionary.
- Roadmap risk: color picker UX scope creep — ship native `<input type="color">` + hex text; no new npm dependency.
- `entry_paints` has no `position` column — list order is query-time only (user chose alphabetical by name).
- Step paint assignments (S-04) do not exist yet — hard delete is safe; S-04 may later block delete when paints are assigned to steps.
- `lessons.md`: new routes under `/api/entries/**` are already covered by existing middleware prefix; still enforce `getUser()` in handlers.

## Desired End State

After S-03:

- Signed-in user opens `/entries/[id]` and follows "Manage paints" to `/entries/[id]/paints`.
- Paints page shows an alphabetical list (by name) with color swatch, name, brand, and color description; empty state prompts first add.
- User adds a paint via form (name required; brand and color description optional; color defaults to `#000000` if left unset).
- User edits a paint via `?edit=<paintId>` full-page view with `EntryPaintForm`; save POSTs to update API; cancel returns to list.
- User deletes a paint via button → `confirm()` → form POST; list refreshes with success banner.
- Success feedback via query flags: `?added=`, `?updated=`, `?deleted=` (POST-redirect-GET).
- `npm run lint` and `npm run build` pass.

### Verification

- Manual: sign in → open entry → manage paints → add two paints → edit one → delete one → verify list and swatches.
- Manual RLS: second user cannot read or mutate paints on another user's entry.
- curl (optional): authenticated POST to paint APIs per AGENTS.md `.cookies` pattern.

## What We're NOT Doing

- Paint catalog, manufacturer autocomplete, or import from external databases (PRD non-goals).
- Manual reorder / `position` column on `entry_paints`.
- Step paint assignment or paint cards on steps (S-04).
- Inline add-from-step flow (S-04 FR-006).
- JSON `fetch`-based SPA save flow.
- Delete guards for paints assigned to steps (no assignments exist until S-04).
- Automated test suite (none in repo).
- Topbar or entry-list shortcuts to paints (navigation only from entry edit page).

## Implementation Approach

Three phases mirroring S-02: (1) API + shared parse/validate helpers with curl-verifiable create, (2) React components including `ColorField` and inline-edit list, (3) Astro paints page with SSR reads, banners, and edit-page link. Writes through API routes; reads in Astro frontmatter.

## Critical Implementation Details

**Hex storage contract.** `approximate_color` is stored as `#RRGGBB` uppercase or lowercase — normalize server-side on parse. Reject invalid hex; accept 6-digit form with leading `#`.

**Picker + hex sync is client-only.** The synced `ColorField` keeps picker and text input aligned in React state; form POST sends a single `approximate_color` hidden or named field. Server validates hex independently — do not trust client-only sync.

**Delete is a separate POST route.** Use `POST /api/entries/[id]/paints/[paintId]/delete` (or equivalent) so update and delete do not share one ambiguous handler. Browser `confirm()` runs in React before form submit.

**Entry must exist and be owned.** Paint APIs verify parent entry via RLS on insert/update/delete; invalid `entry_id` or `paintId` redirects with encoded error to paints page.

## Phase 1: Paint API and shared helpers

### Overview

Establish paint mutation endpoints and centralized parsing/validation. Verify create via curl before building UI.

### Changes Required:

#### 1. Paint API helpers

**File**: `src/lib/entry-paints-api.ts` (new)

**Intent**: Centralize paint form parsing, hex validation, and shared types so create/update/delete handlers stay consistent.

**Contract**:

- `EntryPaintFields`: `{ name, brand, color_description, approximate_color }` — strings; missing keys coerce to `""` except color defaults to `#000000`.
- `parseEntryPaintFormData(formData)`: returns `{ ok: true, fields }` or `{ ok: false, error }`; `name` trim required; `name` max length (e.g. 200); text fields max length (e.g. 10_000); `approximate_color` validated via `isValidHexColor`.
- `isValidHexColor(value)`: accepts `#` + 6 hex digits (case-insensitive).
- `normalizeHexColor(value)`: returns `#rrggbb` lowercase or null if invalid.
- Reuse `isValidEntryId` from `entries-api.ts` for route params; add `isValidPaintId` (same UUID regex).

#### 2. Create paint API

**File**: `src/pages/api/entries/[id]/paints/index.ts` (new)

**Intent**: Accept form POST from add flow; insert paint row for owned entry; redirect to paints list with success flag.

**Contract**:

- `POST` only.
- Validate `id` param as entry UUID.
- `requireUser()`; missing user → `/auth/signin`.
- Parse via `parseEntryPaintFormData`.
- On validation error → redirect `/entries/[id]/paints?error=<encoded>`.
- `.insert({ entry_id: id, name, brand, color_description, approximate_color })` — RLS enforces entry ownership.
- On success → redirect `/entries/[id]/paints?added=1`.

#### 3. Update paint API

**File**: `src/pages/api/entries/[id]/paints/[paintId].ts` (new)

**Intent**: Accept form POST from inline edit; update paint fields for owned entry.

**Contract**:

- `POST` only.
- Validate `id` and `paintId` UUIDs.
- Parse and validate form fields.
- `.update({ name, brand, color_description, approximate_color }).eq("id", paintId).eq("entry_id", id)` — zero rows → not-found error redirect.
- On success → redirect `/entries/[id]/paints?updated=1`.

#### 4. Delete paint API

**File**: `src/pages/api/entries/[id]/paints/[paintId]/delete.ts` (new)

**Intent**: Accept form POST after client-side confirm; delete owned paint row.

**Contract**:

- `POST` only.
- Validate UUIDs.
- `.delete().eq("id", paintId).eq("entry_id", id)` — RLS scoped; zero rows → error redirect.
- On success → redirect `/entries/[id]/paints?deleted=1`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Unauthenticated POST to paint APIs redirects to sign-in
- Authenticated POST creates `entry_paints` row with correct `entry_id` and fields
- Authenticated POST update changes owned paint; wrong `paintId` or other user's entry fails gracefully
- Authenticated POST delete removes row

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Paint form components

### Overview

Build `ColorField`, add/edit paint form, and list row with inline expand-to-edit and delete-with-confirm.

### Changes Required:

#### 1. Color field primitive

**File**: `src/components/entries/ColorField.tsx` (new)

**Intent**: Native color picker synced with hex text input, matching `FormField` visual language.

**Contract**:

- Props: `id`, `name` (form field name for POST, e.g. `approximate_color`), `value`, `onChange`, `error?`.
- Renders `<input type="color">` and text input for `#RRGGBB`; changes in either update shared state.
- On invalid partial hex in text field, do not block typing; parent/form submit relies on server validation. Optional: soft client hint if hex incomplete on submit.
- Swatch preview beside inputs using `background-color` from current value.

#### 2. Entry paint form

**File**: `src/components/entries/EntryPaintForm.tsx` (new)

**Intent**: Shared form for add and edit modes with client-side name validation and server error display.

**Contract**:

- Discriminated props: `{ mode: "add"; entryId; serverError? }` | `{ mode: "edit"; entryId; paintId; initialValues: EntryPaintFields; serverError?; cancelHref: string }`.
- Fields: `name` (`FormField`, required), `brand` (`FormField`), `color_description` (`TextareaField` or `FormField`), `approximate_color` (`ColorField`).
- Client validation: name trim required before submit.
- `method="POST"`; `action` = `/api/entries/${entryId}/paints` (add) or `/api/entries/${entryId}/paints/${paintId}` (edit).
- Reuse `ServerError`, `SubmitButton`; labels "Add paint" / "Save paint".

#### 3. Paint list (SSR in paints page)

**File**: `src/pages/entries/[id]/paints.astro` (list section)

**Intent**: Render paint rows with swatch, metadata, edit link, and delete.

**Contract**:

- SSR list in `paints.astro` (no separate `EntryPaintList` component).
- Each row: color swatch, name (primary), brand + color description (secondary), Edit link → `?edit=<paintId>` full-page edit view.
- Delete: separate `<form method="POST" action=".../delete">` with `onsubmit="return confirm('Delete this paint?')"`.
- List sorted by name on server — page renders in given order.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Add form blocks empty name; valid submit reaches API
- Edit via `?edit=` works; fields pre-populate including color picker + hex; cancel returns to list
- Delete confirm cancels vs proceeds correctly
- Server error from `?error=` displays in banner/form

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Paints page and navigation

### Overview

Wire Astro paints page with SSR reads, empty state, success banners, and link from entry edit.

### Changes Required:

#### 1. Server-side paint reads

**File**: `src/lib/entry-paints-page.ts` (new)

**Intent**: Load paints for an entry in Astro frontmatter using SSR Supabase client and RLS.

**Contract**:

- `EntryPaintRow`: `{ id, name, brand, color_description, approximate_color }`.
- `loadEntryPaints(supabase, entryId)`: returns `{ ok: true, paints }` ordered by `name` ascending, or `{ ok: false, error }`.
- `loadEntryExists(supabase, entryId)`: lightweight check that entry is readable (for paints page guard) — or reuse `loadEntryForEdit` selecting only `id`.

#### 2. Paints page

**File**: `src/pages/entries/[id]/paints.astro` (new)

**Intent**: Host add form, SSR paint list, URL-based edit view, and success/error banners.

**Contract**:

- Validate `id` param; invalid → redirect `/entries?error=...`.
- Load entry via `loadEntryForEdit` + paints via `loadEntryPaints`; missing entry → redirect `/entries?error=Entry not found`.
- Query params: `added`, `updated`, `deleted` → green success banners; `error` → pass to components (split between add/edit views when `?edit=` is set).
- `?edit=<paintId>` (validated against loaded paints) → full-page `EntryPaintForm` in edit mode with `cancelHref` back to list.
- Default view: `EntryPaintForm` (add, `client:load`) + SSR paint list with Edit links and delete forms.
- Empty state copy when `paints.length === 0` above or beside add form.
- "Back to entry" link to `/entries/[id]`.
- `AppLayout` + card shell consistent with entry edit page.

#### 3. Entry edit navigation link

**File**: `src/pages/entries/[id].astro`

**Intent**: Surface paints management from entry edit page per navigation decision.

**Contract**: Add "Manage paints" link (or secondary button) below basics form or in header area → `/entries/[id]/paints`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Full flow: entry edit → manage paints → add → list shows swatch/name → edit via `?edit=` → delete with confirm
- Empty paints page shows helpful CTA
- Unauthenticated `/entries/[id]/paints` redirects to sign-in
- Cross-user paints URL blocked by RLS

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests

- None in repo; not adding for S-03.

### Integration Tests

- None in repo; manual curl smoke for Phase 1 API per AGENTS.md `.cookies` pattern.

### Manual Testing Steps

1. Sign in; open an entry; click "Manage paints".
2. Submit add form with empty name → inline error.
3. Add paint with name only → appears in list with default/black swatch if no color picked.
4. Add second paint with brand, description, and custom color → list sorted alphabetically by name.
5. Edit paint via `?edit=` → save → `?updated=` banner; values persist.
6. Delete paint → confirm → row removed; `?deleted=` banner.
7. Sign in as different user; open other user's paints URL → blocked.
8. Run `npm run lint` and `npm run build`.

## Performance Considerations

- Single `select` per paints page with no joins — fine at MVP scale.
- URL-based edit mounts one form at a time; no virtual list needed.

## Migration Notes

- No schema changes; F-01 migration must be applied locally.
- Existing seed `entry_paints` rows available for manual testing if seed user matches session.

## References

- PRD: `context/foundation/prd.md` (FR-005)
- Roadmap: `context/foundation/roadmap.md` (S-03)
- F-01 schema: `supabase/migrations/20260608103251_paint_log_schema.sql`
- S-02 plan: `context/archive/2026-06-08-entry-draft-and-origin/plan.md`
- Lessons: `context/foundation/lessons.md`
- Entry patterns: `src/lib/entries-api.ts`, `src/components/entries/EntryBasicsForm.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Paint API and shared helpers

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — ba9b660
- [x] 1.2 Build passes: `npm run build` — ba9b660

#### Manual

- [x] 1.3 Unauthenticated POST to paint APIs redirects to sign-in — ba9b660
- [x] 1.4 Authenticated POST creates entry_paints row with correct entry_id and fields — ba9b660
- [x] 1.5 Authenticated POST update changes owned paint; wrong paintId fails gracefully — ba9b660
- [x] 1.6 Authenticated POST delete removes row — ba9b660

### Phase 2: Paint form components

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — 4ed8bf2
- [x] 2.2 Build passes: `npm run build` — 4ed8bf2

#### Manual

- [x] 2.3 Add form blocks empty name; color picker and hex stay synced — 4000ab9
- [x] 2.4 Inline edit expand/collapse works; delete confirm behaves correctly — 4000ab9
- [x] 2.5 Server error from query param displays in UI — 4000ab9

### Phase 3: Paints page and navigation

#### Automated

- [x] 3.1 Linting passes: `npm run lint` — 4000ab9
- [x] 3.2 Build passes: `npm run build` — 4000ab9

#### Manual

- [x] 3.3 Full add → list → edit → delete flow works from paints page — 4000ab9
- [x] 3.4 List sorted by name; empty state and success banners display — 4000ab9
- [x] 3.5 Manage paints link on entry edit; cross-user and unauthenticated access blocked — 4000ab9

## Addendum: URL-based edit (impl review 2026-06-09)

Phase 3 shipped **URL-based edit** (`?edit=<paintId>`) instead of the originally planned `EntryPaintList` React island with inline expand/collapse. Rationale: simpler state management on a single Astro page; delete confirm uses native `onsubmit` on SSR forms.

**Superseded:**
- `src/components/entries/EntryPaintList.tsx` — never merged to main; list logic lives in `paints.astro`.
- Inline edit / `onCancel` callback on `EntryPaintForm` — replaced by `cancelHref` link.

**Unchanged:** API contracts, hex validation, POST-redirect-GET banners, alphabetical sort, auth/RLS boundaries.
