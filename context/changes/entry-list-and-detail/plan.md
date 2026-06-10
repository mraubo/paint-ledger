# Entry List and Detail Recall Implementation Plan

## Overview

Deliver S-06 (FR-011, FR-012, US-01): authenticated users browse saved entries in a simple list and open a read-only detail view that reconstructs the full painting recipe — model info, origin note, paint palette, ordered steps with paint cards and step photos, and a hero final model photo. Move today's edit hub from `/entries/[id]` to `/entries/[id]/edit`. Add status controls on the edit page (`draft` ↔ `ready`) via a single status-change API to support Ready badges on the list.

## Current State Analysis

**Already in place:**

- Entry list at `/entries` with title links, Draft badge, `updated_at`, final-photo thumbnail, empty state, and create CTA (`src/pages/entries/index.astro`, `loadEntryList` in `src/lib/entries-page.ts`).
- Edit hub at `/entries/[id]` with `EntryBasicsForm`, final photo section, and manage links (`src/pages/entries/[id].astro`).
- SSR loaders: `loadEntryPaints`, `loadEntrySteps` (with signed step photo URLs), `resolveEntryFinalPhotoUrl`, `PaintCard` component.
- `entries.status` enum `draft | ready` in schema; no mark-ready UI yet (deferred since S-02).
- S-05 soft warning on draft entries missing final photo (`src/pages/entries/[id].astro`).

**Gaps for S-06:**

- No read-only detail recall page — list links land on edit forms.
- List lacks step count and Ready badge.
- API redirects and footer links target `/entries/[id]` as edit; must move to `/entries/[id]/edit`.
- No status transition API (`draft` ↔ `ready`).

### Key Discoveries:

- S-05 impl-review addendum already shipped list thumbnails as an S-06 preview (`context/archive/2026-06-09-entry-step-and-final-photos/plan.md` addendum).
- Paints list read-only row markup (swatch, name, brand, color description) in `src/pages/entries/[id]/paints.astro` is the pattern for palette recall — extract or mirror without edit/delete actions.
- Steps list read-only step display (position, description, `PaintCard` row, thumbnail) in `src/pages/entries/[id]/steps.astro` is the pattern for step recall — omit edit/move/delete controls.
- `lessons.md`: new routes under `/entries/**` are already covered by `PROTECTED_ROUTES`; no middleware change expected unless a new API prefix is added outside `/api/entries`.

## Desired End State

After S-06:

- User visits `/entries` and sees entries with title, optional thumbnail, Draft or Ready badge, step count badge, and updated date. Row title links to detail recall at `/entries/[id]`.
- User opens `/entries/[id]` and sees a read-only recipe: hero final photo (when set), description (when non-empty), model info, model origin note, full paint palette rows, ordered steps with assigned paint cards and optional step photos. Empty sections are omitted. A single **Edit entry** button links to `/entries/[id]/edit`.
- User edits at `/entries/[id]/edit` (moved from current `[id].astro`). Draft entries can mark ready when a final photo exists; ready entries can revert to draft. Status changes POST to `/api/entries/[id]/status-change` with target `status`; success shows a banner.
- All existing edit flows (paints, steps, final photo APIs) redirect back to `/entries/[id]/edit` with appropriate query banners.
- `npm run lint` and `npm run build` pass.

### Verification

- Manual: create a complete entry → list shows step count + Draft badge → open detail → full recipe visible without forms → Edit entry → mark ready → list shows Ready badge.
- Manual: partial draft (no steps/paints) → detail hides empty sections; mark ready blocked without final photo.
- Manual RLS: second user cannot open first user's detail (redirect to list with error).

## What We're NOT Doing

- Search, filter, sort options, or pagination on list (PRD non-goals).
- Delete entry.
- Dedicated JSON GET API for entry detail (SSR reads only, matching S-02–S-05).
- New schema migrations or Storage changes.
- Automated test suite.
- Sidebar/two-column detail layout.
- Gallery beyond hero final photo + inline step thumbnails.

## Implementation Approach

Three phases: (1) route split with edit migration and status-change API, (2) read-only detail recall page composing existing loaders, (3) list badge enhancements. Writes use form POST + redirect; reads use parallel Supabase queries in Astro frontmatter.

## Critical Implementation Details

**Route swap.** Astro resolves `/entries/[id]/edit` via `src/pages/entries/[id]/edit.astro` and `/entries/[id]` via `src/pages/entries/[id].astro`. After the swap, every redirect and footer link that today targets `/entries/${id}` for the edit hub must target `/entries/${id}/edit`. Detail recall owns `/entries/${id}`.

**Status-change gate.** Hard-block `draft` → `ready` when `final_photo_path` is null — aligns with S-05 copy that a final photo is required before marking ready. `ready` → `draft` has no extra gate (user may reopen editing). Reject noop transitions (already at target status) and invalid `status` values with actionable errors.

**List step counts.** Extend `loadEntryList` with a second query: `steps` rows for all listed `entry_id`s, aggregate counts in memory. Avoid N+1 per-row queries.

## Phase 1: Route split, edit migration, and status change

### Overview

Move the edit hub to `/entries/[id]/edit`, update redirect targets across APIs and footers, and add bidirectional status controls on the edit page.

### Changes Required:

#### 1. Edit page relocation

**File**: `src/pages/entries/[id]/edit.astro` (new, moved from `[id].astro`)

**Intent**: Preserve today's edit hub content (basics form, final photo section, manage links, banners) at the `/edit` path.

**Contract**: Same frontmatter loaders and props as current `[id].astro`. Footer/manage links unchanged except any self-references now use `/edit`.

#### 2. API redirect updates

**File**: `src/pages/api/entries/[id].ts`

**Intent**: After basics save, redirect to edit URL with success/error query params.

**Contract**: All redirects that today use `/entries/${id}` become `/entries/${id}/edit` (including `?saved=1`, `?error=`).

**File**: `src/pages/api/entries/[id]/final-photo.ts`

**Intent**: Final photo POST redirects back to edit hub.

**Contract**: `entryUrl` constant becomes `/entries/${id}/edit`; banner query params unchanged (`final_photo_saved`, etc.).

#### 3. Cross-page footer links

**Files**: `src/pages/entries/[id]/paints.astro`, `src/pages/entries/[id]/steps.astro`

**Intent**: "Back to entry" links target the edit hub, not detail recall.

**Contract**: `href={`/entries/${entryId}/edit`}` replaces `href={`/entries/${entryId}`}` in footers (both list and edit views on those pages).

#### 4. Status-change mutation

**File**: `src/lib/entries-api.ts`

**Intent**: Shared helper to validate and apply `draft` ↔ `ready` transitions.

**Contract**: Export `parseEntryStatusChange(formData)` returning `{ ok: true; status: 'draft' | 'ready' } | { ok: false; error: string }` (read `status` field; reject missing/invalid values). Export `changeEntryStatus(supabase, entryId, userId, targetStatus)` returning `{ ok: true; status: 'draft' | 'ready' } | { ok: false; error: string }`. Load entry scoped to owner; reject not found. Reject noop (current status equals target). For `targetStatus === 'ready'`, reject when `final_photo_path` is null. Apply `.update({ status: targetStatus }).eq('id', entryId).eq('user_id', userId).select('id, status').maybeSingle()` — treat missing `data` as failure (per prior impl-review pattern).

**File**: `src/pages/api/entries/[id]/status-change.ts`

**Intent**: Form POST handler for status change buttons.

**Contract**: `POST` only; auth via `requireUser`; parse `status` from form body; call `changeEntryStatus`. On success redirect `/entries/${id}/edit?status_changed=${targetStatus}`; on failure redirect with `?error=` message. Register under existing `/api/entries` middleware protection (no middleware change).

#### 5. Edit page status UI

**File**: `src/pages/entries/[id]/edit.astro`

**Intent**: Show status controls and badges on the edit hub.

**Contract**: Always show Draft or Ready badge in header. Draft + `final_photo_path` set → form POST to `/api/entries/[id]/status-change` with hidden `status=ready` and submit label e.g. "Mark as ready". Draft + no final photo → disabled button or hidden form with note pointing to final photo section (reuse existing soft-warning copy). Ready → form POST with hidden `status=draft`, submit label e.g. "Revert to draft", `onsubmit="return confirm('Revert this entry to draft?')"` on the form. Success banner when `status_changed=ready` or `status_changed=draft` query param present.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Save basics on edit page → redirects to `/entries/[id]/edit?saved=1`
- Final photo upload → redirects to `/entries/[id]/edit?final_photo_saved=1`
- Paints/steps footers → "Back to entry" opens edit hub
- Draft with final photo → mark ready → Ready badge on edit page + `?status_changed=ready` banner
- Draft without final photo → cannot mark ready (blocked with clear message)
- Ready entry → revert to draft → Draft badge + `?status_changed=draft` banner

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Detail recall page

### Overview

Replace `/entries/[id]` with a read-only recall view composing existing SSR loaders.

### Changes Required:

#### 1. Detail data loading

**File**: `src/lib/entries-page.ts`

**Intent**: Optional convenience type for detail page; reuse existing loaders rather than one mega-query.

**Contract**: Export `EntryDetailBasics` type alias if helpful. Detail page frontmatter calls in parallel: `loadEntryForEdit`, `loadEntryPaints`, `loadEntrySteps`, `resolveEntryFinalPhotoUrl`. No new DB tables.

#### 2. Read-only display components (optional extraction)

**Files**: `src/components/entries/EntryPaintReadOnlyRow.astro` (or inline in page), `src/components/entries/EntryStepReadOnly.astro` (or inline)

**Intent**: Render paint palette rows and step blocks without edit/delete/move controls.

**Contract**: Paint row shows swatch, name, brand, color description (same fields as paints list). Step block shows position label, description (`whitespace-pre-wrap`), optional step photo thumbnail, row of `PaintCard` for assigned paints. No forms except navigation links.

#### 3. Detail page

**File**: `src/pages/entries/[id].astro` (replace edit content with recall)

**Intent**: North-star recall surface per FR-011.

**Contract**: Invalid/missing id or not-found entry → redirect `/entries?error=Entry not found`. Layout order:
1. Title + status badge (Draft or Ready)
2. Hero final photo when `finalPhotoUrl` set (prominent image below header)
3. Description section when non-empty
4. Model information when non-empty
5. Model origin note when non-empty
6. Paint palette section when `paints.length > 0` (full rows)
7. Tutorial steps section when `steps.length > 0` (ordered, read-only)
8. Primary CTA: **Edit entry** → `/entries/[id]/edit`
9. Footer: Back to entries

Omit any section whose content is empty. Handle loader errors with user-facing error banner (do not silently show empty page).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- List row click opens detail (not edit forms)
- Complete entry shows all populated sections in order; hero final photo at top
- Step paint cards and step photos render correctly
- Partial draft hides empty sections; Edit entry opens edit hub
- Invalid entry id redirects to list with error

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: List enhancements

### Overview

Add step count badge and Ready badge on list rows; confirm list links target detail route.

### Changes Required:

#### 1. List loader step counts

**File**: `src/lib/entries-page.ts`

**Intent**: Include per-entry step count in list rows.

**Contract**: Extend `EntryListRow` with `step_count: number`. After entries query, batch-fetch `steps(entry_id)` for listed ids; build `Map<entryId, count>`. Default `0` when no steps.

#### 2. List UI badges

**File**: `src/pages/entries/index.astro`

**Intent**: Show Draft or Ready badge and step count on each row.

**Contract**: `status === 'draft'` → Draft badge (existing). `status === 'ready'` → Ready badge (new, distinct styling e.g. green-tinted). Step count badge e.g. `{n} steps` (singular "1 step"). Title link `href={`/entries/${entry.id}`}` (detail). Keep thumbnail and updated date.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Entry with 3 steps shows "3 steps" badge
- Ready entry shows Ready badge; draft shows Draft badge
- List link opens detail recall page
- Entry with 0 steps shows "0 steps" (or hide count when 0 — prefer showing "0 steps" for consistency)

**Implementation Note**: Final manual smoke across list → detail → edit → mark ready → list.

---

## Testing Strategy

### Unit Tests:

- None in repo; defer.

### Integration Tests:

- None in repo; defer.

### Manual Testing Steps:

1. Sign in → `/entries` → create entry via existing flows → populate paints, steps, photos.
2. List: verify thumbnail, step count, Draft badge, link to detail.
3. Detail: verify section order, hero final photo, paint rows, steps with cards/photos, Edit entry CTA.
4. Edit hub at `/edit` → mark ready → list shows Ready badge → revert to draft → list shows Draft badge.
5. Attempt mark ready without final photo → blocked with message.
6. Sign in as other user → cannot view first user's entry.
7. Optional curl: `POST /api/entries/[id]/status-change` with `status=ready` — include `Origin` header per `lessons.md`.
8. `npm run lint` and `npm run build`.

## Performance Considerations

- Detail page runs 3–4 parallel Supabase queries plus batched signed URL generation — acceptable at hobby scale (<20 steps per entry per prior S-05 review).
- List step-count batch query adds one round-trip; still O(1) queries relative to list size.

## Migration Notes

- Bookmarks to `/entries/[id]` will open detail recall instead of edit — intentional. Edit bookmarks need `/edit` suffix.
- No database migration required.

## References

- Roadmap S-06: `context/foundation/roadmap.md`
- PRD FR-011, FR-012, US-01: `context/foundation/prd.md`
- Prior list/edit patterns: `context/archive/2026-06-08-entry-draft-and-origin/plan.md`
- Photo signed URLs: `context/archive/2026-06-09-entry-step-and-final-photos/plan.md`
- Change identity: `context/changes/entry-list-and-detail/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Route split, edit migration, and status change

#### Automated

- [x] 1.1 Linting passes: `npm run lint`
- [x] 1.2 Build passes: `npm run build`

#### Manual

- [x] 1.3 Basics save redirects to `/entries/[id]/edit?saved=1`
- [x] 1.4 Final photo redirects to edit hub; paints/steps footers link to edit
- [x] 1.5 Status change: mark ready with final photo; blocked without; revert ready to draft

### Phase 2: Detail recall page

#### Automated

- [ ] 2.1 Linting passes: `npm run lint`
- [ ] 2.2 Build passes: `npm run build`

#### Manual

- [ ] 2.3 Detail shows full recall layout; hero final photo at top
- [ ] 2.4 Empty sections hidden; Edit entry opens edit hub
- [ ] 2.5 Invalid entry id redirects to list with error

### Phase 3: List enhancements

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 List shows step count and Ready/Draft badges; links open detail
