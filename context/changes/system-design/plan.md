# Field Journal Narrative Implementation Plan

## Overview

Migrate Paint Ledger's authenticated UI (`/auth/*`, `/entries/**`) from the cosmic glassmorphism starter theme to the **Field Journal Narrative** design system defined in `context/changes/system-design/DESIGN.md`. The work replaces decentralized hardcoded Tailwind palette classes with CSS design tokens, loads three self-hosted fonts, extracts repeated layout patterns into custom primitives, and restyles all entry workflow surfaces — without touching the public landing page or dark mode.

## Current State Analysis

Research (`context/changes/system-design/research.md`) identified three parallel design layers:

1. **Target** — `DESIGN.md` with full M3-style token set, typography scale, tactile-minimalism elevation rules.
2. **shadcn scaffold** — `src/styles/global.css` with default neutral OKLCH tokens; only `src/components/ui/button.tsx` consumes them.
3. **Shipped UI** — ~20+ files using `bg-cosmic`, `purple-600`, `border-white/10`, `backdrop-blur-xl`.

### Key Discoveries:

- `src/styles/global.css:113-115` — `bg-cosmic` hardcoded gradient is the app shell background.
- `src/components/auth/FormField.tsx:5-6` — shared `inputBase` constant propagates glass styling to all auth and entry forms.
- `src/components/auth/SubmitButton.tsx:15-18` — shadcn `Button` exists but is overridden with `bg-purple-600`.
- Glass page card pattern (`rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl p-8`) duplicated in 10+ page files starting at `src/pages/entries/index.astro:31`.
- No web fonts loaded; headings use gradient sans, not Source Serif 4.
- E2E specs (`tests/e2e/`) do not assert cosmic CSS class names — visual refactor won't break Playwright selectors.
- Product requirements (`context/foundation/prd.md`) are UI-agnostic — paint cards, badges, and layout order are preserved; only styling changes.

## Desired End State

- **Visual:** Parchment background (`#fbf9f5`), Burnt Sienna primary actions, ink-line card borders, recessed inputs, serif page titles, mono metadata on paint names and step labels.
- **Technical:** All in-scope styling uses semantic tokens from `global.css` (`bg-background`, `text-foreground`, `bg-primary`, `border-border`, etc.) backed by `DESIGN.md` hex values. No `bg-cosmic`, `purple-*`, `blue-100/*`, or `backdrop-blur` in `/auth` or `/entries` files.
- **Structural:** Shared Astro primitives (`PageCard`, `PageHeading`, `Alert`, `StatusChip`) replace duplicated inline class strings. `Banner.astro` removed or superseded by `Alert.astro`.
- **Verification:** `npm run lint`, `npm run build`, `npm run test:integration` pass; manual sign-in → entry workflow walkthrough confirms readability and brand alignment.

## What We're NOT Doing

- Redesigning `Welcome.astro` or `/` landing page
- Implementing dark mode / Midnight Sketchbook / theme toggle
- Building progress bars, dotted leader lists, or paper grain texture
- Installing new shadcn components via CLI (`card`, `input`, `badge`, etc.)
- Refactoring to a 12-column ledger CSS grid
- Adding Playwright visual regression screenshots
- Changing routes, auth logic, data model, or API handlers

## Implementation Approach

Phased migration by area: foundation tokens first (invisible until pages adopt them), then shared primitives, then auth shell, then entry pages, then cleanup grep. Each phase ends with automated CI checks; phases 3–5 require manual visual confirmation before proceeding.

Token strategy: populate shadcn-compatible `:root` variables with `DESIGN.md` hex values. Map semantic roles:

| shadcn alias | DESIGN.md source |
| ------------ | ---------------- |
| `--background` | `background` / `surface` `#fbf9f5` |
| `--foreground` | `on-background` / `on-surface` `#1b1c1a` |
| `--primary` | `primary` `#6c2f00` |
| `--primary-foreground` | `on-primary` `#ffffff` |
| `--secondary` | `secondary-container` `#c6e9e9` |
| `--secondary-foreground` | `on-secondary-container` `#4a6a6a` |
| `--muted` | `surface-container` `#efeeea` |
| `--muted-foreground` | `on-surface-variant` `#54433a` |
| `--accent` | `surface-container-high` `#eae8e4` |
| `--border` | `outline-variant` `#dac2b6` |
| `--input` | `surface-container-low` `#f5f3ef` |
| `--ring` | `surface-tint` `#934b19` |
| `--destructive` | `error` `#ba1a1a` |
| `--card` | `surface-container-lowest` `#ffffff` |

Add supplementary CSS variables for tertiary/success (`--success`, `--success-foreground`) mapped from tertiary green tokens for Ready badges and success alerts.

Fonts via `@fontsource/source-serif-4`, `@fontsource/work-sans`, `@fontsource/jetbrains-mono` imported in `global.css`.

## Critical Implementation Details

**Token-before-pages ordering:** Phase 1 changes `body` to parchment + dark text immediately. Until pages migrate off cosmic classes, the app may look briefly broken mid-phase. Complete Phase 2 primitives before starting Phase 3 page swaps to minimize mixed states.

**FormField is the critical path:** `FormField` and `TextareaField` are imported by auth forms and all entry forms. Restyle these in Phase 2 before touching individual pages.

**Keep shadcn Button, drop override:** `SubmitButton.tsx` should rely on token-mapped `bg-primary` after Phase 1 — remove the `bg-purple-600` className override.

**Cloudflare dev:** No `wrangler.jsonc` changes expected. If adding font files changes asset paths, verify `/@vite/client` still serves after any config touch (per `context/foundation/lessons.md`).

## Phase 1: Design Tokens & Typography

### Overview

Install fonts and rewrite `global.css` so the token layer reflects `DESIGN.md`. Remove `bg-cosmic`. Establish base typography rules.

### Changes Required:

#### 1. Font packages

**File**: `package.json`

**Intent**: Add self-hosted font packages for the three type families specified in DESIGN.md.

**Contract**: New dependencies `@fontsource/source-serif-4`, `@fontsource/work-sans`, `@fontsource/jetbrains-mono` (regular + semibold/bold weights as needed by typography scale).

#### 2. Global stylesheet

**File**: `src/styles/global.css`

**Intent**: Replace neutral OKLCH defaults with DESIGN.md hex values on shadcn aliases; register font families in `@theme inline`; set base typography; remove cosmic utility.

**Contract**:
- `:root` block uses DESIGN.md hex mapped to shadcn variable names (see Implementation Approach table).
- `@theme inline` adds `--font-serif`, `--font-sans`, `--font-mono` pointing to loaded families.
- `@layer base`: `body` uses `font-sans`; `h1, h2, h3` use `font-serif`; optional `.font-label` utility uses `font-mono` + `tracking-wider`.
- Delete `@utility bg-cosmic` block.
- Add `--success` / `--success-foreground` custom properties and `@theme` color mappings for Ready badge use.
- Set `--radius: 0.5rem` per DESIGN.md default corners.
- Leave `.dark` block unchanged (dormant until future slice).

#### 3. Font imports

**File**: `src/styles/global.css` (top of file, after tailwind import)

**Intent**: Import required font weight subsets from `@fontsource` packages.

**Contract**: At minimum: Source Serif 4 (600, 700), Work Sans (400), JetBrains Mono (500). Subset to latin.

### Success Criteria:

#### Automated Verification:

- `npm install` completes without errors
- `npm run lint` passes
- `npm run build` passes
- `bg-cosmic` no longer defined in `src/styles/global.css`

#### Manual Verification:

- Inspect compiled CSS: `:root --primary` resolves to `#6c2f00` (or equivalent)
- DevTools confirms font-family on `body` is Work Sans after hard refresh

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Shared Primitives & Form Restyle

### Overview

Create reusable Astro shell components and restyle React form primitives to use semantic tokens. This phase makes page migration mechanical.

### Changes Required:

#### 1. PageCard

**File**: `src/components/ui/PageCard.astro` (new)

**Intent**: Replace duplicated glass card wrapper with ink-line bordered parchment card per DESIGN.md elevation Level 1.

**Contract**: Props: optional `class`. Renders `rounded-lg border border-border bg-card p-8` (or `rounded-2xl` for large containers per DESIGN.md 16px). No shadow, no backdrop-blur.

#### 2. PageHeading

**File**: `src/components/ui/PageHeading.astro` (new)

**Intent**: Standardize page titles as Source Serif 4 headlines without gradient text.

**Contract**: Props: `title` (string), optional `subtitle`. Renders `h1` with `font-serif text-2xl font-semibold text-foreground` and optional `p` with `text-muted-foreground`.

#### 3. Alert

**File**: `src/components/ui/Alert.astro` (new)

**Intent**: Unified alert for config warnings, flash banners, and inline messages; replaces `Banner.astro`.

**Contract**: Props: `variant` (`info` | `warning` | `error` | `success`), `message` (string). Uses token backgrounds: info → `secondary-container`, warning → custom amber tokens or `accent`, error → `destructive/10`, success → `success/10`. 1px border, no hardcoded hex.

#### 4. StatusChip

**File**: `src/components/ui/StatusChip.astro` (new)

**Intent**: Extract Draft/Ready pill pattern used on list, detail, and edit pages.

**Contract**: Props: `status` (`draft` | `ready`). Draft → `bg-muted text-muted-foreground`; Ready → `bg-success/20 text-success-foreground` with tertiary green. `rounded-full px-2 py-0.5 text-xs font-label`.

#### 5. Layout integration

**File**: `src/layouts/Layout.astro`

**Intent**: Swap `Banner` for `Alert` at config warning call sites.

**Contract**: Import `Alert` instead of `Banner`; pass same warning/error messages with appropriate `variant`.

#### 6. Form primitives

**Files**: `src/components/auth/FormField.tsx`, `src/components/auth/TextareaField.tsx`

**Intent**: Replace glass `inputBase` with recessed ledger inputs using semantic tokens.

**Contract**: Input classes use `bg-input text-foreground border-border placeholder:text-muted-foreground focus:ring-ring focus:border-ring rounded-lg`. Labels use `text-foreground`. Errors use `text-destructive border-destructive`. Icons use `text-muted-foreground`.

#### 7. Submit and error components

**Files**: `src/components/auth/SubmitButton.tsx`, `src/components/auth/ServerError.tsx`, `src/components/auth/PasswordToggle.tsx`

**Intent**: Remove all cosmic/purple/red-glass classes; rely on tokens.

**Contract**: `SubmitButton` drops `bg-purple-600` override — uses default shadcn `Button` primary variant. `ServerError` uses `Alert` styling or `border-destructive bg-destructive/10 text-destructive`. `PasswordToggle` uses `text-muted-foreground hover:text-foreground`.

#### 8. Remove Banner

**File**: `src/components/Banner.astro`

**Intent**: Delete after `Alert.astro` replaces all usages.

**Contract**: No remaining imports of `Banner` in codebase.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `grep -r "Banner" src/` returns no imports (except delete confirmation)
- `grep -r "bg-purple-600" src/components/auth/` returns no matches

#### Manual Verification:

- Render a throwaway test page or dev-only preview with `PageCard` + `PageHeading` + `Alert` + `StatusChip` — visually matches parchment/ink aesthetic
- FormField renders recessed input on parchment background

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Shell & Auth Pages

### Overview

Migrate the app shell and authentication flow to the new design system.

### Changes Required:

#### 1. App layout

**File**: `src/layouts/AppLayout.astro`

**Intent**: Replace cosmic shell with parchment page container and responsive desktop margins.

**Contract**: Outer div: `bg-background text-foreground min-h-screen flex flex-col p-4 lg:px-16`. Inner: `mx-auto w-full max-w-4xl`. Remove `bg-cosmic`.

#### 2. Topbar

**File**: `src/components/Topbar.astro`

**Intent**: Restyle navigation bar as a subtle surface-container strip with secondary-colored links.

**Contract**: Bar uses `bg-surface-container or bg-muted rounded-xl border border-border px-4 py-3`. Links use `text-secondary-foreground hover:text-primary`. Sign-out uses `text-muted-foreground`. No `text-purple-300` or `border-white/10`.

#### 3. Auth pages

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Replace cosmic full-page wrapper and glass card with parchment background + `PageCard` + `PageHeading`.

**Contract**: Page wrapper: `bg-background min-h-screen flex items-center justify-center p-4`. Card: `<PageCard class="w-full max-w-sm">`. Title: `<PageHeading>`. Footer links use `text-primary hover:underline`. Remove all gradient `h1`, `backdrop-blur`, `text-white`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `grep -r "bg-cosmic\|backdrop-blur\|purple-" src/pages/auth/ src/layouts/` returns no matches

#### Manual Verification:

- Sign-in page readable on parchment; form fields recessed; submit button Burnt Sienna
- Sign-up and confirm-email pages match
- Topbar visible and navigable on `/entries` shell
- Sign-in flow still works end-to-end (manual or existing e2e)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Entry Workflow Pages & Components

### Overview

Migrate all `/entries/**` pages and entry-specific components. Largest phase by file count.

### Changes Required:

#### 1. Entry pages — shell swap

**Files**:
- `src/pages/entries/index.astro`
- `src/pages/entries/new.astro`
- `src/pages/entries/[id].astro`
- `src/pages/entries/[id]/edit.astro`
- `src/pages/entries/[id]/paints.astro`
- `src/pages/entries/[id]/steps.astro`

**Intent**: Replace inline glass card wrappers with `PageCard`; replace gradient headings with `PageHeading`; replace inline status pills with `StatusChip`; replace flash banners with `Alert`.

**Contract**: Each page's outer card div becomes `<PageCard>`. All `h1` gradient classes removed. Query-param success/error banners use `<Alert variant="success|error">`. Footer nav links: `text-primary` instead of `text-purple-300`. List dividers: `divide-border` instead of `divide-white/10`. Section rules: `border-t border-border`.

#### 2. Entry list

**File**: `src/pages/entries/index.astro`

**Intent**: Restyle list rows as ledger entries with hairline separators.

**Contract**: Row text uses `text-foreground` / `text-muted-foreground`. Thumbnail border `border-border`. Empty state CTA uses primary button classes. `StatusChip` for Draft/Ready.

#### 3. Entry components — React

**Files**:
- `src/components/entries/PaintCard.tsx`
- `src/components/entries/ColorField.tsx`
- `src/components/entries/EntryListActionsMenu.tsx`
- `src/components/entries/EntryStepForm.tsx`
- `src/components/entries/EntryStepInlinePaintAdd.tsx`
- `src/components/entries/StepPhotoField.tsx`
- `src/components/entries/EntryFinalPhotoForm.tsx`
- `src/components/entries/EntryPaintForm.tsx`

**Intent**: Replace glass/hardcoded colors with semantic tokens throughout React islands.

**Contract**: `PaintCard` — `border-border bg-card`; paint name uses `font-mono text-sm`. `ColorField` — recessed inputs matching FormField. `EntryListActionsMenu` — `bg-card border-border shadow-sm` (soft lift per DESIGN.md Level 2, not `shadow-lg`); delete action `text-destructive`. Checkbox accent `text-primary`. File inputs `bg-input`. Hints `text-muted-foreground`.

#### 4. Entry components — Astro

**Files**:
- `src/components/entries/EntryStepReadOnly.astro`
- `src/components/entries/EntryPaintReadOnlyRow.astro`

**Intent**: Read-only cards match ledger entry style.

**Contract**: Card borders `border-border bg-card`. Step position label uses `font-mono text-xs tracking-wider text-muted-foreground uppercase`. Section headings `font-serif`.

#### 5. Detail page grids

**File**: `src/pages/entries/[id].astro`

**Intent**: Preserve existing 1→2 and 1→3 column grids; restyle only.

**Contract**: Grid structure unchanged (`md:grid-cols-2`, `md:grid-cols-3`). Colors/tokens only.

#### 6. Edit page actions

**File**: `src/pages/entries/[id]/edit.astro`

**Intent**: Status action buttons (Mark Ready, Revert to Draft) and danger zone use token semantics.

**Contract**: Ready action → primary or success outline. Revert → secondary outline. Delete → destructive. No green/red glass pill classes.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `npm run test:integration` passes (Supabase local)
- `grep -rE "bg-cosmic|backdrop-blur|purple-|blue-100" src/pages/entries/ src/components/entries/` returns no matches

#### Manual Verification:

- Entry list: readable rows, Draft/Ready chips, create CTA works
- Create entry → add paint (color picker) → add step with photo → view detail
- Edit entry, paints page, steps page all on-brand
- Kebab menu opens; edit and delete still work
- Final photo and step photos display correctly

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Cleanup & Verification

### Overview

Sweep for residual cosmic styling in scope, delete dead code, run full CI, document deferred work.

### Changes Required:

#### 1. Residual class grep

**Files**: All `src/` (excluding `Welcome.astro`, `dev/`)

**Intent**: Confirm no in-scope cosmic classes remain.

**Contract**: Zero matches for `bg-cosmic`, `backdrop-blur`, `purple-`, `blue-100`, `border-white/10`, `bg-white/10` under `src/pages/entries/`, `src/pages/auth/`, `src/layouts/`, `src/components/auth/`, `src/components/entries/`, `src/components/Topbar.astro`, `src/components/ui/` (except `Welcome.astro` explicitly excluded).

#### 2. Dev-only components

**File**: `src/components/dev/SentryTestButton.tsx`, `src/pages/dev/sentry-test.astro`

**Intent**: Optionally restyle dev pages with tokens for consistency (low priority).

**Contract**: If touched, remove `bg-purple-600`; otherwise leave as-is and note in plan progress.

#### 3. LibBadge

**File**: `src/components/ui/LibBadge.astro`

**Intent**: Update to use tokens if still referenced; unused file can stay unchanged.

**Contract**: If used by `Welcome.astro` only, no change required this slice.

#### 4. Update change metadata

**File**: `context/changes/system-design/change.md`

**Intent**: Mark change as implemented when all phases complete.

**Contract**: `status: implemented` (or leave `planned` until PR merges — implementer discretion).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `npm run test:integration` passes
- `npx astro sync` succeeds (if types affected)

#### Manual Verification:

- Full walkthrough: `/auth/signin` → `/entries` → create → paints → steps → detail → edit → delete
- `/` (Welcome) still renders (cosmic is acceptable — out of scope)
- No console font 404 errors
- Text contrast acceptable on parchment (WCAG spot-check on primary button and body text)

---

## Testing Strategy

### Unit Tests:

- No new unit tests required — visual-only change with no business logic modification.
- Existing tests should pass unchanged.

### Integration Tests:

- `npm run test:integration` — validates Supabase RLS and entry workflow; styling changes must not alter HTML structure that tests depend on (verify if tests assert element text only).

### Manual Testing Steps:

1. Sign in with valid credentials — form fields visible, submit works.
2. Create new entry with title and description.
3. Add paint with color picker — swatch and mono name visible.
4. Add step with photo upload and paint assignment.
5. View entry detail — serif title, paint grid, step cards, final photo.
6. Mark entry Ready from edit page — success alert appears.
7. Delete entry from list kebab menu — confirm dialog, redirect to list.
8. Sign out — return to sign-in page on parchment.

## Performance Considerations

- `@fontsource` adds ~200–400KB total (latin subsets). Acceptable for MVP; subset weights aggressively (only used weights).
- Removing `backdrop-blur-xl` from all cards improves paint performance on lower-end devices.
- No runtime theme switching — zero JS cost for design tokens.

## Migration Notes

- **No data migration** — purely presentational.
- **No route changes** — `PROTECTED_ROUTES` unchanged.
- **Rollback:** Revert CSS + component commits; no database rollback needed.
- **Follow-up slices:** `Welcome.astro` redesign, dark mode, decorative patterns (dotted leaders, progress bars), optional shadcn expansion.

## References

- Research: `context/changes/system-design/research.md`
- Design spec: `context/changes/system-design/DESIGN.md`
- Token file: `src/styles/global.css`
- Form critical path: `src/components/auth/FormField.tsx:5-6`
- Shell: `src/layouts/AppLayout.astro:13-14`
- Archived UI patterns: `context/archive/2026-06-01-account-auth-shell/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Design Tokens & Typography

#### Automated

- [x] 1.1 `npm install` completes without errors — ae73b82
- [x] 1.2 `npm run lint` passes — ae73b82
- [x] 1.3 `npm run build` passes — ae73b82
- [x] 1.4 `bg-cosmic` no longer defined in `src/styles/global.css` — ae73b82

#### Manual

- [x] 1.5 `:root --primary` resolves to Burnt Sienna; `body` uses Work Sans in DevTools — ae73b82

### Phase 2: Shared Primitives & Form Restyle

#### Automated

- [x] 2.1 `npm run lint` passes — 04f5075
- [x] 2.2 `npm run build` passes — 04f5075
- [x] 2.3 No remaining `Banner` imports in `src/` — 04f5075
- [x] 2.4 No `bg-purple-600` in `src/components/auth/` — 04f5075

#### Manual

- [x] 2.5 Primitives preview: PageCard, PageHeading, Alert, StatusChip on-brand — 04f5075
- [x] 2.6 FormField recessed input renders correctly on parchment — 04f5075

### Phase 3: Shell & Auth Pages

#### Automated

- [x] 3.1 `npm run lint` passes — 74153aa
- [x] 3.2 `npm run build` passes — 74153aa
- [x] 3.3 No cosmic/purple classes in `src/pages/auth/` and `src/layouts/` — 74153aa

#### Manual

- [x] 3.4 Sign-in, sign-up, confirm-email pages on-brand and functional — 74153aa
- [x] 3.5 Topbar navigable; sign-in flow works end-to-end — 74153aa

### Phase 4: Entry Workflow Pages & Components

#### Automated

- [x] 4.1 `npm run lint` passes — cb067c9
- [x] 4.2 `npm run build` passes — cb067c9
- [x] 4.3 `npm run test:integration` passes — cb067c9
- [x] 4.4 No cosmic/purple/blue-100 classes in `src/pages/entries/` and `src/components/entries/` — cb067c9

#### Manual

- [x] 4.5 Full entry workflow walkthrough on-brand (list → create → paints → steps → detail → edit) — cb067c9

### Phase 5: Cleanup & Verification

#### Automated

- [x] 5.1 `npm run lint` passes — 23c9268
- [x] 5.2 `npm run build` passes — 23c9268
- [x] 5.3 `npm run test:integration` passes — 23c9268
- [x] 5.4 `npx astro sync` succeeds — 23c9268

#### Manual

- [x] 5.5 Full auth + entry walkthrough including delete — 23c9268
- [x] 5.6 No font 404 errors; contrast spot-check on primary button and body text — 23c9268
