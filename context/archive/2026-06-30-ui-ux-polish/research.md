---
date: 2026-06-30T09:52:15+02:00
researcher: Cursor Agent
git_commit: 4da6b9bf70f113963f6eab9df468a84ec060c166
branch: main
repository: paint-ledger
topic: "UI/UX polish — entry redirect, action nav, badge alignment, homepage, paint swatches"
tags: [research, codebase, ui, ux, entries, paints, homepage, design-system]
status: complete
last_updated: 2026-06-30
last_updated_by: Cursor Agent
---

# Research: UI/UX polish for entries, paints, and homepage

**Date**: 2026-06-30T09:52:15+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: 4da6b9bf70f113963f6eab9df468a84ec060c166  
**Branch**: main  
**Repository**: paint-ledger

## Research Question

Map the codebase changes needed for `ui-ux-polish`:

1. After creating an entry, redirect to edit view (not list)
2. Improve bottom action/navigation sections on entry edit, paint, and step pages
3. Fix uneven status badge alignment in entry header
4. Rebuild homepage per Stitch mockup (`code.html`, `screen.png`)
5. Make paint list swatches circular; remove duplicate color preview in paint add/edit form

Reference assets in `context/changes/ui-ux-polish/`:
- `bottom-section.png` — current entry edit footer (danger zone + dot-separated links)
- `paint-to-remove.png` — duplicate swatch before color picker (marked for removal)
- `code.html` / `screen.png` — Stitch landing page spec

## Summary

| Area | Current state | Change scope |
|------|---------------|--------------|
| **Post-create redirect** | `POST /api/entries` → `/entries?created={id}` (list + banner) | One-line redirect in API + banner on edit page + 2 e2e specs |
| **Bottom actions** | Duplicated `<p>` footers with muted dot-separated text links; danger zone only on edit | Extract shared nav component; promote links to bordered action bar or button row per design system |
| **Header badge** | `PageHeading` + `StatusChip` in `flex items-center` — chip visually floats above title baseline | Align with `items-baseline` or move chip into `PageHeading` |
| **Homepage** | `Welcome.astro` still uses cosmic/purple Astro-starter theme | Full replacement per Stitch; add M3 tokens + ledger utilities to `global.css` |
| **Paint swatches (list)** | `rounded-lg` squares in 4 places | Change to `rounded-full` on list/read-only swatches |
| **Paint swatches (form)** | `ColorField` renders standalone `size-10` swatch **and** inline `size-4` swatch in hex input | Remove lines 43–47 in `ColorField.tsx` (standalone preview) |

All six items are independent enough for phased implementation but share design-token work (homepage + action bar styling).

## Detailed Findings

### 1. Post-create redirect to edit view

**Current flow:**

```
/entries/new → POST /api/entries → /entries?created={uuid} (list + "Entry created" banner)
```

**Desired flow:**

```
/entries/new → POST /api/entries → /entries/{id}/edit?created=1 (edit + banner)
```

**Authoritative redirect** — `src/pages/api/entries/index.ts:39`:

```typescript
return context.redirect(`/entries?created=${data.id}`);
```

**Edit redirect precedent** — update already lands on edit (`src/pages/api/entries/[id].ts:49`):

```typescript
return context.redirect(`/entries/${id}/edit?saved=1`);
```

**List banner (to retire or keep for backward compat)** — `src/pages/entries/index.astro:17-18, 46`:
- Reads `?created=` query param
- Shows `Alert variant="success" message="Entry created"`

**Edit page** — `src/pages/entries/[id]/edit.astro` handles `saved`, `status_changed`, `final_photo_saved` banners but **not** `created=1`.

**Form layer** — no client redirect; `EntryBasicsForm.tsx:60` POSTs to `/api/entries` via native form.

**Tests to update:**

| File | Lines | Assertion |
|------|-------|-----------|
| `tests/e2e/entry-workflow.spec.ts` | 23–28 | `toHaveURL(/created=/)`, banner on list |
| `tests/e2e/seed.spec.ts` | 15–17 | Same pattern |

**Implementation checklist:**
1. Change redirect target in `index.ts:39` → `/entries/${data.id}/edit?created=1`
2. Add `showCreatedBanner` in `edit.astro` (mirror `saved=1` pattern)
3. Optionally remove `created=` handling from `entries/index.astro`
4. Update e2e URL assertions to `/entries/{id}/edit`

---

### 2. Bottom action / navigation sections

**Problem (per `bottom-section.png`):** Navigation sits below danger zone as small, centered, muted text links (`text-muted-foreground text-sm`) separated by `·`. Easy to miss compared to primary form actions above.

**No shared component** — each page inlines the same pattern inside `PageCard`.

#### Entry edit — `src/pages/entries/[id]/edit.astro`

| Section | Lines | Pattern |
|---------|-------|---------|
| Danger zone | 155–168 | `border-t pt-8`, red heading, `Delete entry` button |
| Footer nav | 170–178 | View entry · Manage paints · Manage steps · Back to entries |

#### Paints — `src/pages/entries/[id]/paints.astro`

| View | Lines | Links |
|------|-------|-------|
| List | 168–176 | Manage steps · Back to entry |
| Edit (`?edit=`) | 87–95 | Back to paints · Back to entry |

#### Steps — `src/pages/entries/[id]/steps.astro`

| View | Lines | Links |
|------|-------|-------|
| List | 236–248 | Manage paints · Back to entry · Back to entries |
| Edit (`?edit=`) | 109–125 | Back to steps · Manage paints · Back to entry · Back to entries |

#### Shared CSS tokens (all footers)

```html
<p class="text-muted-foreground mt-{4|6} text-center text-sm">
  <a class="text-primary hover:underline">…</a>
  <span class="text-muted-foreground/50 mx-2">·</span>
</p>
```

**Design system guidance** — `context/changes/system-design/DESIGN.md:167-168`:
> Primary buttons use solid Burnt Sienna fill… Secondary buttons use Slate Blue outline. They should feel like ink stamps—bold and decisive.

**Recommended direction for plan:**
- Extract `EntryWorkflowNav.astro` (or similar) with props for current page + entry id
- Replace dot-links with a **bordered action bar** (`border-t border-border pt-6`) using secondary outline buttons or a responsive button group
- Keep danger zone separate but visually grouped (edit page only)
- Align link sets per page role (hub vs sub-page) — current matrix is inconsistent (paints list lacks "Back to entries")

**Related:** `src/pages/entries/new.astro:15` has a single "Back to entries" link with same styling.

---

### 3. Header badge alignment

**Components:**

- `PageHeading` — `src/components/ui/PageHeading.astro:11-13` — wraps `<h1 class="font-serif text-2xl font-semibold">`
- `StatusChip` — `src/components/ui/StatusChip.astro:16-18` — `font-label rounded-full px-2 py-0.5 text-xs`

**Layout (edit + detail)** — `src/pages/entries/[id]/edit.astro:63-67`:

```astro
<div class="mb-6 flex flex-wrap items-center gap-3">
  <PageHeading title={entry.title} class="mb-0" />
  {entry.status === "ready" && <StatusChip status="ready" />}
</div>
```

Same pattern in `src/pages/entries/[id].astro:76-80`.

**Likely cause of misalignment (`bottom-section.png` / edit screenshot):**
- `items-center` vertically centers chip against the **PageHeading wrapper div** (which includes only the h1), but serif `text-2xl` cap-height vs mono `text-xs` chip creates optical offset — chip appears high relative to title baseline
- `PageHeading` is a block-level `<div>`; chip is a sibling `<span>`

**Fix options (smallest → largest):**
1. Change wrapper to `items-baseline` and add `self-center` or `translate-y-*` on chip if needed
2. Add optional `badge` slot to `PageHeading` so title + chip share one flex row
3. Use `inline-flex items-baseline gap-3` inside `PageHeading` when status prop passed

**Note:** Entry list uses a different draft badge — inline `<span class="rounded-full px-2.5 py-0.5">` at `src/pages/entries/index.astro:92` (not `StatusChip`). List alignment is a separate concern.

---

### 4. Homepage vs Stitch mockup

**Current:** `src/pages/index.astro` → `src/components/Welcome.astro` — cosmic purple starter (orbs, gradient title, glass cards, auth CTAs). Explicitly left unchanged during `system-design` migration (`context/changes/system-design/plan.md`).

**Target:** `context/changes/ui-ux-polish/code.html` — Field Journal marketing page:
- Sticky header with logo, nav (Features/Palette/Journal/Community), "Get Started"
- 2-column hero: "Master Your Palette. Archive Your Journey." + ledger mockup (`ruled-bg`, `dotted-leader`, circular paint dots)
- Features section "The Chronicler's Tools" — 3 product cards with `ink-border`, `hover-lift`
- Bottom CTA "Ready to organize your paints?" + "Create Free Account"
- Footer with legal links

**Token gap in `src/styles/global.css`:**
- Fonts loaded (Source Serif 4, Work Sans, JetBrains Mono) ✓
- shadcn subset mapped (`--primary`, `--background`, etc.) — missing Stitch aliases: `primary-container`, `surface-container`, `on-surface-variant`, typography scale utilities
- Ledger utilities **not implemented**: `ruled-bg`, `ink-border`, `hover-lift`, `dotted-leader`, `recessed-fill` (specified in `DESIGN.md:148-171`, present in `code.html:104-131`)

**DESIGN.md chip guidance** (`DESIGN.md:170`):
> Chips (Paint Swatches)… circular or pill-shaped, featuring a small circle of the actual paint color

**Implementation scope:**
1. Replace `Welcome.astro` with landing section components matching Stitch structure
2. Extend `global.css` `@theme` with M3 color aliases + tactile utilities
3. Wire CTAs: Sign up → `/auth/signup`, "Start Your First Log" → `/auth/signup` or `/entries/new` (decide in plan)
4. Marketing nav vs auth `Topbar.astro` — product pages keep current topbar; landing gets its own header
5. Remove `bg-cosmic` reference (`Welcome.astro:5`) — class was removed in system-design migration

---

### 5. Paint swatches — list (square → circular)

**Design spec:** circular swatches on lists (`DESIGN.md:170`; Stitch hero mockup uses `rounded-full` dots).

| Location | File | Lines | Current classes |
|----------|------|-------|-----------------|
| Paints list page | `src/pages/entries/[id]/paints.astro` | 131–135 | `size-10 rounded-lg` |
| Entry detail palette | `src/components/entries/EntryPaintReadOnlyRow.astro` | 16–19 | `size-14 rounded-lg` |
| Step paint chips | `src/components/entries/PaintCard.tsx` | 17–20 | `size-6 rounded` |
| Step form checklist | `src/components/entries/EntryStepForm.tsx` | 86–89 | `size-8 rounded` |

**Change:** Replace `rounded-lg` / `rounded` with `rounded-full` on color swatch `<span>` elements. Consider normalizing sizes across contexts in plan (optional).

**Out of scope for circular change:** `ColorField` picker input (`rounded-lg` on `<input type="color">`) — rectangular picker is fine.

---

### 6. Paint form — remove duplicate color preview

**Component:** `src/components/entries/ColorField.tsx`

**Used by:**
- `src/components/entries/EntryPaintForm.tsx:101-107`
- `src/components/entries/EntryStepInlinePaintAdd.tsx:109-114`

**Duplicate previews (`paint-to-remove.png`):**

| Element | Lines | Size | Role |
|---------|-------|------|------|
| Standalone swatch | 43–47 | `size-10 rounded-lg` | **Remove** — duplicates hex-field preview |
| Color picker | 48–60 | `h-10 w-14` | Keep |
| Inline hex preview | 62–66 | `size-4` inside input | Keep |

**Row layout** — `flex flex-wrap items-center gap-3` (line 42). After removal: picker + hex input only.

---

## Code References

- `src/pages/api/entries/index.ts:39` — post-create redirect (primary change)
- `src/pages/entries/[id]/edit.astro:63-67, 155-178` — header badge layout + danger zone + footer nav
- `src/pages/entries/[id]/paints.astro:87-95, 126-135, 168-176` — paint edit footer, list swatch, list footer
- `src/pages/entries/[id]/steps.astro:109-125, 236-248` — step edit/list footers
- `src/components/ui/PageHeading.astro:11-13` — title wrapper
- `src/components/ui/StatusChip.astro:16-18` — Ready/Draft chip
- `src/components/entries/ColorField.tsx:42-66` — duplicate swatch (remove 43-47)
- `src/components/entries/EntryPaintReadOnlyRow.astro:16-19` — detail palette swatch
- `src/components/entries/PaintCard.tsx:17-20` — step inline swatch
- `src/components/Welcome.astro:5-124` — current homepage (replace)
- `context/changes/ui-ux-polish/code.html:134-279` — Stitch landing structure
- `context/changes/system-design/DESIGN.md:148-171` — elevation, shapes, chips, ledger utilities
- `tests/e2e/entry-workflow.spec.ts:23-28` — e2e redirect assertions
- `tests/e2e/seed.spec.ts:15-17` — seed e2e redirect assertions

## Architecture Insights

1. **Redirects are API-owned** — form components never handle navigation; all POST handlers use `context.redirect()`. Entry-create change is a single API line plus banner parity on edit page.

2. **No shared workflow navigation** — five footer blocks across three files duplicate the same muted-link pattern. A shared Astro component would reduce drift (paints list already has fewer links than steps list).

3. **Design system partially applied** — `/entries/**` uses Field Journal tokens via `AppLayout` + `PageCard`; `/` is still cosmic starter. `global.css` has fonts but not full M3 scale or tactile utilities from `DESIGN.md`.

4. **Swatches are inline, not a component** — color preview markup is copy-pasted across paints page, read-only row, PaintCard, and ColorField. Plan may introduce `PaintSwatch.astro` with `variant="list" | "inline" | "form"` — optional refactor, not required for minimal fix.

5. **StatusChip vs list badge** — two different draft/ready UI implementations (`StatusChip` on detail/edit vs raw span on index).

## Historical Context (from prior changes)

- `context/changes/system-design/plan.md` — migrated auth/entries to Field Journal; **explicitly deferred homepage** and ledger utilities (`ruled-bg`, `ink-border`). This change completes that deferred work for `/`.

- `context/changes/system-design/DESIGN.md:170` — chips/swatches should be circular; current implementation uses `rounded-lg` squares — spec drift to fix here.

- `context/archive/2026-06-08-entry-draft-and-origin/` — established entry create flow and list redirect with `?created=` banner; this change reverses landing target to edit.

- `context/archive/2026-06-10-entry-list-and-detail/` — entry detail/edit header patterns introduced.

## Related Research

- `context/changes/system-design/research.md` — Field Journal token mapping, AppLayout migration
- `context/changes/ui-ux-polish/code.html` — Stitch export (authoritative homepage layout reference)
- `context/changes/ui-ux-polish/bottom-section.png` — current entry edit bottom UX
- `context/changes/ui-ux-polish/paint-to-remove.png` — ColorField duplicate to remove

## Open Questions

1. **Homepage CTAs** — Should "Start Your First Log" / "Get Started" go to `/auth/signup`, `/entries/new`, or sign-in if session exists? (Plan should define auth-aware behavior.)

2. **Action bar design** — Stitch mockup does not show entry workflow footers. Plan should propose concrete pattern (button row vs card with icons) — user screenshot shows desired problem, not solution.

3. **Paint swatch size normalization** — Make all list swatches `size-10` + `rounded-full`, or keep size differences (detail `size-14`, step `size-6`)?

4. **Integration tests** — Any HTTP tests assert `Location: /entries?created=`? Grep found only e2e specs; no integration test changes expected.

5. **Marketing nav links** — Stitch nav items (Features, Palette, Journal, Community) are placeholders — anchor to page sections or omit until content exists?
