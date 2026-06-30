# UI/UX Polish Implementation Plan

## Overview

Polish entry workflow UX, authenticated header branding, and the public landing page to align with the Field Journal design system and Stitch mockup. Seven user-facing improvements ship in five phases: quick wins first, then workflow navigation, header/logo, homepage rebuild, and test verification.

## Current State Analysis

Research (`context/changes/ui-ux-polish/research.md`) mapped all touchpoints. Key baseline:

- Post-create redirect lands on `/entries?created={id}` (`src/pages/api/entries/index.ts:39`), not edit.
- Bottom navigation is duplicated as muted dot-separated text links in `edit.astro`, `paints.astro`, `steps.astro`.
- `PageHeading` + `StatusChip` use `items-center`, causing optical badge misalignment (`edit.astro:63-67`).
- Paint swatches use `rounded-lg` squares; `ColorField.tsx:43-47` duplicates the hex-input preview.
- `Welcome.astro` is still the cosmic Astro starter; Stitch spec lives in `context/changes/ui-ux-polish/code.html`.
- `Topbar.astro` shows email left, nav links right — no logo (`public/logo-paint-ledger.svg` exists but is unused).

### Key Discoveries:

- Update flow already redirects to edit with `?saved=1` — create should mirror (`src/pages/api/entries/[id].ts:49`).
- `system-design` migration explicitly deferred homepage and ledger utilities — this change completes that debt.
- E2E specs assert list redirect (`tests/e2e/entry-workflow.spec.ts:23-28`, `seed.spec.ts:15-17`).
- Logo SVG includes a bare `<rect width="235" height="50"/>` — may render as black fill; clean up during header work.

## Desired End State

- Creating an entry opens `/entries/{id}/edit?created=1` with success banner.
- Workflow pages show a visible icon+label action bar (not dot-links) for cross-page navigation.
- Entry title and Ready/Draft badge align on one baseline row.
- Paint list swatches are circular; paint form has one color preview (inside hex field).
- Authenticated `Topbar` shows `/logo-paint-ledger.svg` (always); email visible from `sm:` breakpoint up.
- `/` matches Stitch layout with Field Journal tokens; CTAs are auth-aware.
- `npm run lint`, `npm run build`, `npm run test:integration`, and updated e2e specs pass.

## What We're NOT Doing

- Dark mode / theme toggle
- New routes or API behavior beyond create redirect
- `PaintSwatch` component extraction (optional follow-up)
- Playwright visual regression screenshots
- Real legal pages for footer links (use `#` or omit until content exists)
- Replacing Material Symbols on landing with Lucide (Stitch uses Material Symbols — use same CDN or inline SVGs as in `code.html`)
- Changing entry list draft badge to use `StatusChip` (out of scope unless alignment fix touches it)

## Implementation Approach

Five incremental phases with manual checkpoints after phases 2 and 4 (visible UI changes). Reuse existing primitives (`PageCard`, `Alert`, `StatusChip`, `AppLayout`). Extract `EntryWorkflowNav.astro` and `BrandLogo.astro` to avoid duplication between `Topbar` and landing header.

## Critical Implementation Details

**Logo SVG cleanup:** `public/logo-paint-ledger.svg` has an unfilled `<rect>` that may paint black. Remove the rect or set `fill="none"` before embedding in headers; verify on parchment `bg-muted` topbar and landing `bg-surface`.

**Auth-aware landing CTAs:** Read `Astro.locals.user` in `src/pages/index.astro` frontmatter. Logged-out: primary → `/auth/signup`, secondary → `/auth/signin` or `#features`. Logged-in: primary → `/entries/new`, secondary → `/entries`; hide or relabel signup CTA in bottom section.

**EntryWorkflowNav on edit page:** Render workflow nav **above** the danger zone so navigation stays discoverable without competing with delete.

## Phase 1: Quick Wins

### Overview

Low-risk, high-value fixes: redirect target, circular swatches, ColorField dedup, badge alignment. No new components.

### Changes Required:

#### 1. Post-create redirect

**File**: `src/pages/api/entries/index.ts`

**Intent**: Send new entries to the edit hub instead of the list, matching user expectation and update-flow precedent.

**Contract**: Success `POST` redirect target becomes `/entries/${data.id}/edit?created=1`.

#### 2. Created banner on edit page

**File**: `src/pages/entries/[id]/edit.astro`

**Intent**: Show "Entry created" success feedback on the edit page when arriving from create.

**Contract**: Read `created=1` query param; render `Alert variant="success" message="Entry created"` alongside existing banner flags.

#### 3. Retire list created banner (optional cleanup)

**File**: `src/pages/entries/index.astro`

**Intent**: Remove dead `?created=` handling now that create no longer lands here.

**Contract**: Delete `createdParam` / `showCreatedBanner` logic and associated alert if no other code sets `?created=`.

#### 4. Circular paint swatches

**Files**: `src/pages/entries/[id]/paints.astro`, `src/components/entries/EntryPaintReadOnlyRow.astro`, `src/components/entries/PaintCard.tsx`, `src/components/entries/EntryStepForm.tsx`

**Intent**: Align swatch shape with `DESIGN.md` chip guidance (circular color dots).

**Contract**: On swatch `<span>` elements, replace `rounded-lg` / `rounded` with `rounded-full`. Keep existing sizes (`size-10`, `size-14`, `size-6`, `size-8`) per context.

#### 5. Remove duplicate ColorField preview

**File**: `src/components/entries/ColorField.tsx`

**Intent**: Remove the standalone swatch before the color picker (user-marked duplicate in `paint-to-remove.png`).

**Contract**: Delete the `size-10` preview span (lines 43–47). Row retains native color picker + hex input with inline `size-4` preview.

#### 6. Badge alignment

**Files**: `src/pages/entries/[id]/edit.astro`, `src/pages/entries/[id].astro`, optionally `src/components/ui/PageHeading.astro`

**Intent**: Fix Ready/Draft chip sitting high relative to serif title.

**Contract**: Change header wrapper from `items-center` to `items-baseline`; add small `translate-y` on `StatusChip` wrapper only if baseline alone is insufficient. Prefer minimal change in page files before extending `PageHeading` API.

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`
- `npm run test:integration` (with local Supabase)

#### Manual Verification:

- Create entry from `/entries/new` → lands on `/entries/{id}/edit` with "Entry created" banner
- Paint list and detail show circular swatches
- Add/edit paint form shows picker + hex field only (no large swatch before picker)
- Edit and detail pages: title and Ready badge visually aligned

**Implementation Note**: Pause for human confirmation after manual checks before Phase 2.

---

## Phase 2: Entry Workflow Navigation

### Overview

Replace muted dot-link footers with a shared, icon-labelled action bar across entry workflow pages.

### Changes Required:

#### 1. EntryWorkflowNav component

**File**: `src/components/entries/EntryWorkflowNav.astro` (new)

**Intent**: Single source of truth for cross-page navigation in the entry workflow.

**Contract**: Props:
- `entryId: string`
- `current: 'view' | 'edit' | 'paints' | 'paints-edit' | 'steps' | 'steps-edit' | 'new'`

Renders `border-t border-border pt-6 mt-6` container with responsive `flex flex-wrap gap-2 justify-center sm:justify-start`.

Each action is a link styled as secondary outline button (`border-border text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors`). Current page action gets `aria-current="page"` and muted/disabled styling (no navigation).

Lucide icons (import via `lucide-astro` or inline SVG matching existing patterns):
| Action | href | Icon |
|--------|------|------|
| View entry | `/entries/{id}` | `Eye` |
| Manage paints | `/entries/{id}/paints` | `Palette` |
| Manage steps | `/entries/{id}/steps` | `ListOrdered` |
| Back to entry | `/entries/{id}/edit` | `Pencil` or `ArrowLeft` |
| Back to paints | `/entries/{id}/paints` | `ArrowLeft` |
| Back to steps | `/entries/{id}/steps` | `ArrowLeft` |
| Back to entries | `/entries` | `LayoutList` |

Link sets per `current` value (from research matrix, with paints list gaining "Back to entries"):

| `current` | Actions shown |
|-----------|---------------|
| `edit` | View, Paints, Steps, Back to entries |
| `view` | Edit, Paints, Steps, Back to entries |
| `paints` | Steps, Back to entry, Back to entries |
| `paints-edit` | Back to paints, Back to entry |
| `steps` | Paints, Back to entry, Back to entries |
| `steps-edit` | Back to steps, Paints, Back to entry, Back to entries |
| `new` | Back to entries only |

#### 2. Wire into pages

**Files**: `src/pages/entries/[id]/edit.astro`, `src/pages/entries/[id].astro`, `src/pages/entries/[id]/paints.astro`, `src/pages/entries/[id]/steps.astro`, `src/pages/entries/new.astro`

**Intent**: Replace inline `<p>` dot-link footers with `<EntryWorkflowNav>`.

**Contract**: Remove old footer `<p>` blocks. On `edit.astro`, place nav **above** danger zone section. Pass correct `current` prop per page/view (`isEditView` branches on paints/steps).

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`

#### Manual Verification:

- Each workflow page shows icon+label buttons; current page is indicated
- All links navigate correctly (including `?edit=` sub-views)
- Danger zone remains below nav on edit page
- Mobile: buttons wrap cleanly without horizontal overflow

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Header & Logo

### Overview

Add brand logo to authenticated topbar and prepare shared logo component for landing header (Phase 4).

### Changes Required:

#### 1. Fix logo SVG asset

**File**: `public/logo-paint-ledger.svg`

**Intent**: Ensure logo renders cleanly on parchment backgrounds.

**Contract**: Remove or transparent-fill the background `<rect>`; preserve sygnet + "Paint Ledger" wordmark. Re-export viewBox if cropping improves header fit (target height ~32–40px in UI).

#### 2. BrandLogo component

**File**: `src/components/ui/BrandLogo.astro` (new)

**Intent**: Reusable logo markup for Topbar and landing header.

**Contract**: Props: `href` (default `/entries` for app, `/` for marketing), optional `class`. Renders `<a>` wrapping `<img src="/logo-paint-ledger.svg" alt="Paint Ledger" />` with `h-8 w-auto` (tune per visual review). Accessible link text.

#### 3. Topbar layout

**File**: `src/components/Topbar.astro`

**Intent**: Show logo for authenticated users; keep nav links; email desktop-only per user decision.

**Contract**: When `user` is present:
- Left: `<BrandLogo href="/entries" />` + `<span class="text-muted-foreground hidden sm:inline">{user.email}</span>` with gap
- Right: unchanged Entries / New entry / Sign out

When not signed in: keep current text-only layout (no logo required on auth pages using Topbar — verify `Welcome.astro` replaced in Phase 4).

Restructure flex so logo doesn't collide with nav on narrow screens (wrap or shrink email).

#### 4. AppLayout check

**File**: `src/layouts/AppLayout.astro`

**Intent**: Confirm topbar width accommodates logo; adjust padding only if needed.

**Contract**: No structural change expected; verify `max-w-4xl` container still fits logo + nav.

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`

#### Manual Verification:

- Signed-in: logo visible on all `/entries/**` pages; links to `/entries`
- Mobile: logo only (email hidden); desktop: logo + email
- Logo crisp on `bg-muted` topbar, no black rectangle artifact
- Sign out and nav links still work

---

## Phase 4: Homepage (Stitch)

### Overview

Replace cosmic `Welcome.astro` with Field Journal marketing page per `code.html` / `screen.png`, including shared logo and auth-aware CTAs.

### Changes Required:

#### 1. Design tokens & utilities

**File**: `src/styles/global.css`

**Intent**: Add Stitch/M3 aliases and ledger tactile utilities deferred from system-design.

**Contract**: Extend `@theme inline` with at minimum:
- `--color-primary-container` → `#8b4513`
- `--color-surface-container` → `#efeeea`
- `--color-on-surface-variant` → `#54433a`
- `--color-secondary` → `#446464` (for outline buttons)

Add utility classes (from `code.html:104-131` / `DESIGN.md:148-171`):
- `.ink-border` — 1px `#dac2b6` border
- `.ruled-bg` — notebook ruled lines
- `.hover-lift` — subtle hover elevation
- `.dotted-leader` — flex dot leader for mockup

Map to Tailwind `@utility` or plain CSS classes usable in Astro.

#### 2. Landing section components

**Files** (new under `src/components/landing/`):
- `LandingHeader.astro` — sticky header: `BrandLogo href="/"`, anchor nav (`#features`, `#cta`), auth-aware "Get Started" button
- `LandingHero.astro` — 2-column hero copy + ledger mockup card
- `LandingFeatures.astro` — "The Chronicler's Tools" 3-card grid (`id="features"`)
- `LandingCta.astro` — bottom signup section (`id="cta"`)
- `LandingFooter.astro` — brand + copyright + placeholder footer links

**Intent**: Match Stitch structure and copy from `code.html`; use Field Journal fonts already loaded.

**Contract**: Replace purple/cosmic classes entirely. Hero headline: "Master Your Palette. Archive Your Journey." Feature cards: Digital Ledger, Recipe Management, Visual Archiving. Paint dots in mockup use `rounded-full`.

#### 3. Homepage route

**Files**: `src/pages/index.astro`, retire/replace `src/components/Welcome.astro`

**Intent**: Compose landing sections; implement auth-aware CTAs.

**Contract**: Frontmatter reads `Astro.locals.user`:
- Logged out: primary CTA → `/auth/signup`; secondary → `/auth/signin` or scroll `#features`
- Logged in: primary → `/entries/new`; secondary → `/entries`; bottom CTA → `/entries` or hidden

Use `Layout` directly (not `AppLayout`) — marketing page is full-width (`max-w-7xl`), not `max-w-4xl` app shell.

`LandingHeader` uses same `BrandLogo` + `/logo-paint-ledger.svg` as Topbar.

#### 4. Marketing nav anchors

**Intent**: Stitch placeholder links become in-page anchors, not dead `#` hops.

**Contract**: Features → `#features`; optional Journal → `#cta`; omit Community/Palette until content exists or map to `#features`.

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`

#### Manual Verification:

- `/` shows Field Journal landing (no cosmic purple)
- Logo in landing header matches authenticated topbar asset
- Logged out: CTAs go to signup/signin
- Logged in: CTAs go to entries/new or entries
- Responsive layout: hero stacks on mobile
- Anchor nav scrolls to features/CTA sections

**Implementation Note**: Pause for human visual review before Phase 5.

---

## Phase 5: E2E & Verification

### Overview

Update Playwright specs for new create redirect; run full verification suite.

### Changes Required:

#### 1. E2E redirect assertions

**Files**: `tests/e2e/entry-workflow.spec.ts`, `tests/e2e/seed.spec.ts`

**Intent**: Tests reflect edit-page landing after create.

**Contract**: After create, expect URL matching `/entries/{uuid}/edit` with `created=1` query (or path-only match + banner text "Entry created"). Parse entry id from URL when seed spec needs it for later steps.

#### 2. Optional e2e smoke for landing

**File**: `tests/e2e/` (new or extend existing public spec if present)

**Intent**: Guard against regression to cosmic starter copy.

**Contract**: Assert `/` contains "Master Your Palette" and does not contain "cosmic developer experience" starter text. Keep minimal — no visual snapshots.

### Success Criteria:

#### Automated Verification:

- `npm run lint`
- `npm run build`
- `npm run test:integration`
- `npm run test:e2e` (Supabase + dev server per test plan)

#### Manual Verification:

- Full entry workflow walkthrough: create → edit → paints → steps → view → list
- Landing page checked logged-in and logged-out
- No regressions on auth pages

---

## Testing Strategy

### Unit Tests:

- No new unit tests required; ColorField change is visual-only
- If ColorField has existing tests, update selectors expecting removed swatch

### Integration Tests:

- Existing entry workflow integration tests should pass unchanged (no HTTP assertion on create redirect location in integration layer per research)

### Manual Testing Steps:

1. Create entry → edit page + banner
2. Navigate all workflow action bar buttons from each page
3. Resize viewport: topbar logo/email behavior at `sm` breakpoint
4. Visit `/` logged out and logged in — verify CTA targets
5. Add paint — single color preview in form
6. Verify circular swatches on paints list and entry detail

## Performance Considerations

- Logo SVG is small; single `<img>` per page load — negligible
- Landing page adds Material Symbols CDN if used — one font request; acceptable for marketing page
- No new client islands beyond existing entry forms

## Migration Notes

- No database migration
- Old `/entries?created={id}` bookmarks will still load list without banner if cleanup removes handler — acceptable
- `Welcome.astro` can be deleted after landing components ship

## References

- Research: `context/changes/ui-ux-polish/research.md`
- Stitch mockup: `context/changes/ui-ux-polish/code.html`, `screen.png`
- Screenshots: `bottom-section.png`, `paint-to-remove.png`
- Design system: `context/changes/system-design/DESIGN.md`
- Logo asset: `public/logo-paint-ledger.svg`
- Prior deferral: `context/changes/system-design/plan.md` (homepage out of scope)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Quick Wins

#### Automated

- [x] 1.1 `npm run lint` — 91fa484
- [x] 1.2 `npm run build` — 91fa484
- [x] 1.3 `npm run test:integration` — 91fa484

#### Manual

- [x] 1.4 Create entry lands on edit with banner; swatches circular; ColorField deduped; badge aligned — 91fa484

### Phase 2: Entry Workflow Navigation

#### Automated

- [x] 2.1 `npm run lint`
- [x] 2.2 `npm run build`

#### Manual

- [x] 2.3 Icon action bar on all workflow pages; links correct; danger zone below nav on edit

### Phase 3: Header & Logo

#### Automated

- [ ] 3.1 `npm run lint`
- [ ] 3.2 `npm run build`

#### Manual

- [ ] 3.3 Logo in Topbar; email desktop-only; SVG renders without black rect

### Phase 4: Homepage (Stitch)

#### Automated

- [ ] 4.1 `npm run lint`
- [ ] 4.2 `npm run build`

#### Manual

- [ ] 4.4 Landing matches Stitch; auth-aware CTAs; shared logo; responsive layout

### Phase 5: E2E & Verification

#### Automated

- [ ] 5.1 `npm run lint`
- [ ] 5.2 `npm run build`
- [ ] 5.3 `npm run test:integration`
- [ ] 5.4 `npm run test:e2e`

#### Manual

- [ ] 5.5 Full workflow + landing smoke (logged in/out)
