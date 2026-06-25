---
date: 2026-06-25T11:15:16+02:00
researcher: Cursor Agent
git_commit: abbab9ee54521f71ac1b2d9f477636058c6dc8b8
branch: sentry
repository: paint-ledger
topic: "Migrate application UI from cosmic glassmorphism to Field Journal Narrative design system (stitch.withgoogle.com)"
tags: [research, codebase, design-system, tailwind, shadcn, typography, field-journal]
status: complete
last_updated: 2026-06-25
last_updated_by: Cursor Agent
---

# Research: System Design Migration — Field Journal Narrative

**Date**: 2026-06-25T11:15:16+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: `abbab9ee54521f71ac1b2d9f477636058c6dc8b8`  
**Branch**: `sentry`  
**Repository**: `mraubo/paint-ledger`

## Research Question

How should Paint Ledger migrate from its current visual implementation to the new **Field Journal Narrative** design system authored in stitch.withgoogle.com (`context/changes/system-design/DESIGN.md`)? What exists today, what gaps remain, and what is the highest-leverage migration path?

## Summary

Paint Ledger runs **three parallel design layers** that do not agree:

1. **Target design** — `DESIGN.md` defines a full Material Design 3–style token set (Burnt Sienna / Slate Blue / Forest Green on parchment), three font families, tactile-minimalism elevation, and ledger-specific components (dotted leaders, ink-wash progress bars, paint swatch chips).
2. **shadcn scaffold** — `src/styles/global.css` holds default neutral OKLCH tokens and `@theme inline` mappings; only `button.tsx` consumes them.
3. **Shipped product UI** — ~20+ components and 10 page shells use a **cosmic glassmorphism** palette (`bg-cosmic`, `purple-600` CTAs, `border-white/10`, `backdrop-blur-xl`) inherited from the Astro starter and the `account-auth-shell` slice.

The migration is **not a token swap** — it is a full visual refactor: replace hardcoded Tailwind palette classes across pages, load three web fonts, remap CSS variables to `DESIGN.md` tokens, extract repeated glass-card patterns into shared primitives, and adopt missing shadcn components (`card`, `input`, `label`, `badge`, `alert`, `separator`).

**Recommended phasing:** (1) foundation — fonts + CSS tokens in `global.css`; (2) shell — `AppLayout`, `Topbar`, auth pages; (3) primitives — form fields, buttons, alerts, status chips; (4) pages — entries list/detail/edit; (5) landing — `Welcome.astro`; (6) dark mode — "Midnight Sketchbook" via `.dark` class.

## Detailed Findings

### Target Design System (`DESIGN.md`)

The stitch.withgoogle.com export defines **"Field Journal Narrative"** — a Chronicler's Archive aesthetic:

| Category | Key values |
|----------|------------|
| **Primary** | Burnt Sienna `#6c2f00` / container `#8b4513` |
| **Secondary** | Slate Blue `#446464` / container `#c6e9e9` |
| **Tertiary** | Forest Green `#35470f` / container `#4c5f25` |
| **Surface** | Parchment `#fbf9f5` with container ladder (`surface-container-low` → `highest`) |
| **Typography** | Source Serif 4 (headlines), Work Sans (body), JetBrains Mono (labels) |
| **Radius** | 8px default, 16px large cards |
| **Spacing** | 4px baseline; desktop margin 64px, mobile 16px |
| **Elevation** | Tonal layers + 1px ink borders; minimal shadow (8px blur @ 5% on hover only) |
| **Dark mode** | "Midnight Sketchbook" charcoal `#1A1C1E` |

Component specs include ink-stamp buttons, serif card headers, recessed inputs, circular paint swatch chips with mono labels, dotted leader lists, and ink-wash progress bars.

### Current Token Architecture

**Single source file:** `src/styles/global.css`

- Tailwind 4 CSS-first mode (no `tailwind.config.*`); Vite plugin in `astro.config.mjs`
- shadcn `components.json`: `new-york` style, `baseColor: neutral`, `cssVariables: true`
- `:root` tokens are achromatic shadcn defaults (`--primary: oklch(0.205 0 0)` — dark gray, not brand hue)
- `.dark` overrides exist but **never activated** (no `class="dark"` anywhere)
- Custom `@utility bg-cosmic` with hardcoded hex gradient `#0a0e1a → #0f1529`
- No typography tokens, no custom spacing scale, no shadow tokens

```113:115:src/styles/global.css
@utility bg-cosmic {
  background-image: linear-gradient(to bottom, #0a0e1a, #0f1529, #0a0e1a);
}
```

### Cosmic UI Layer (What Users See)

The product UI bypasses theme tokens entirely:

| Pattern | Classes | Primary files |
|---------|---------|---------------|
| App shell | `bg-cosmic flex min-h-screen p-4` | `AppLayout.astro:13` |
| Glass card | `rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl p-8` | All entry pages, auth pages |
| Primary CTA | `bg-purple-600 hover:bg-purple-500` | `SubmitButton.tsx:18`, `Welcome.astro`, pages |
| Body text | `text-blue-100/70`, `text-blue-100/80` | Forms, lists, detail |
| Links | `text-purple-300 hover:text-purple-100` | `Topbar.astro`, page footers |
| Success/error | `border-green-500/30`, `border-red-500/30` | Flash banners, `ServerError.tsx` |
| Gradient headings | `bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text` | Every page `h1` |

### UI Component Inventory

**shadcn primitives installed:** 1 (`button.tsx`)

| Component | File | Styling approach |
|-----------|------|------------------|
| Button | `ui/button.tsx` | Theme tokens (unused in practice) |
| SubmitButton | `auth/SubmitButton.tsx` | shadcn Button + purple override |
| FormField | `auth/FormField.tsx` | Hardcoded glass inputs |
| TextareaField | `auth/TextareaField.tsx` | Same as FormField |
| PaintCard | `entries/PaintCard.tsx` | Glass card + inline swatch color |
| ColorField | `entries/ColorField.tsx` | Glass inputs + native color picker |
| EntryListActionsMenu | `entries/EntryListActionsMenu.tsx` | Glass dropdown + `shadow-lg` |
| Topbar | `Topbar.astro` | Glass nav bar |
| Welcome | `Welcome.astro` | Cosmic orbs, star field, gradient hero |
| Banner | `Banner.astro` | Hardcoded hex CSS (info/warning/error) |
| LibBadge | `ui/LibBadge.astro` | `font-mono` dev badge (unused) |

**Missing from both shadcn and custom:** Card, Input, Label, Badge/Chip, Alert, Separator, Progress bar, PageHeading, StatusChip.

**Repeated ad-hoc patterns** (candidates for extraction):

- Glass page card — 10+ page files
- Gradient `h1` — every page title
- Status pills (Draft/Ready) — `index.astro`, `[id].astro`, `edit.astro`
- Success/error flash banners — multiple pages
- Footer nav links (`text-purple-300` + `·` separators)

### Typography & Layout

**Fonts:** None loaded. No Google Fonts links, no `@font-face`, no Astro font integration, no `--font-*` in `@theme`.

| Role | Current | Target |
|------|---------|--------|
| Headlines | System sans + gradient | Source Serif 4 (24–48px scale) |
| Body | System sans (`text-sm`/`text-base`) | Work Sans (16–18px) |
| Labels | Sans `text-xs uppercase tracking-wide` | JetBrains Mono 12–14px, 0.05em tracking |
| Mono | `font-mono` on unused `LibBadge` only | JetBrains Mono for metadata, paint names, hex codes |

**Layout:**

- Single centered column `max-w-4xl` (~896px) with uniform `p-4` (16px) at all breakpoints
- Ad-hoc responsive grids: `md:grid-cols-2` (paints), `md:grid-cols-3` (steps), `sm:grid-cols-3` (Welcome features)
- No 12/6/2-column ledger grid
- Desktop margin 64px from design doc **not implemented**
- Section separators via `border-t border-white/10` and `divide-y divide-white/10` — close to design hairlines but wrong color/weight

### Gap Analysis: Current vs Target

| Aspect | Current | Target (`DESIGN.md`) | Migration effort |
|--------|---------|----------------------|------------------|
| Color tokens | Neutral OKLCH + cosmic hex | Full M3 palette (50+ named tokens) | **High** — rewrite `:root`/`.dark`, extend `@theme` |
| Primary action color | `purple-600` | Burnt Sienna `#6c2f00` | **High** — ~15 files |
| Background | Dark cosmic gradient | Warm parchment `#fbf9f5` | **High** — shell + all pages |
| Card style | Glass blur, translucent | 1px ink border, no shadow | **High** — all page shells |
| Fonts | System default | 3 web fonts | **Medium** — load + apply |
| Typography scale | Ad-hoc Tailwind sizes | Named tokens (display-lg → label-sm) | **Medium** — consolidate classes |
| Inputs | Full bordered glass boxes | Recessed fill or bottom-border only | **Medium** — FormField, ColorField |
| Buttons | Purple fill / white outline | Burnt Sienna solid / Slate Blue outline | **Low** — map shadcn variants |
| Paint chips | `PaintCard` sans name | Circular swatch + JetBrains Mono | **Low** — one component |
| Status chips | `rounded-full` glass/green pills | Tokenized Draft/Ready/Tertiary green | **Low** — extract component |
| Progress bars | Not implemented | Ink-wash semi-transparent fill | **New** — no existing code |
| Dotted leaders | Not implemented | `Name ......... 80%` pattern | **New** — no existing code |
| Dark mode | Defined but inactive | Midnight Sketchbook charcoal | **Medium** — activate + restyle |
| Elevation | `backdrop-blur`, `shadow-lg` | Tonal layers, 5% hover shadow | **Medium** — remove blur globally |
| Layout grid | Single column + simple grids | 12/6/2 ledger grid, 64px desktop margin | **Medium** — AppLayout + pages |
| shadcn adoption | 1 primitive (Button) | card, input, label, badge, alert, separator, dropdown-menu | **Medium** — install + theme |

## Code References

- `src/styles/global.css:6-110` — shadcn neutral tokens + `@theme inline` bridge
- `src/styles/global.css:113-115` — `bg-cosmic` hardcoded gradient
- `src/layouts/AppLayout.astro:13-14` — cosmic shell wrapper
- `src/components/auth/FormField.tsx:5-6` — shared glass input classes
- `src/components/auth/SubmitButton.tsx:15-18` — shadcn Button with purple override
- `src/components/entries/PaintCard.tsx:14-25` — paint swatch card
- `src/components/Topbar.astro:6-37` — glass navigation bar
- `src/components/Welcome.astro:5-124` — cosmic landing page
- `src/components/Banner.astro:27-40` — hardcoded hex banner variants
- `src/pages/entries/index.astro:31` — canonical glass card shell pattern
- `components.json:1-21` — shadcn config (only Button installed)
- `context/changes/system-design/DESIGN.md:1-172` — target design system (stitch export)

## Architecture Insights

1. **Three-layer mismatch** — The codebase is structurally ready for a design-system swap (Tailwind 4 CSS-first, shadcn + `cn()`, CSS variables) but visually still on the starter's cosmic theme. `DESIGN.md` tokens are documented but not wired.

2. **Decentralized styling** — ~90% of product UI uses hardcoded Tailwind palette classes instead of semantic tokens. A token swap in `global.css` alone will not change the visible UI.

3. **shadcn is under-adopted** — `components.json` is configured but only `Button` is installed, and even that is overridden with purple classes. Installing and theming `card`, `input`, `label`, `badge`, `alert` would reduce duplication and give a migration target for each repeated pattern.

4. **Form primitives are the critical path** — `FormField`/`TextareaField` constants are imported by both auth and entry forms. Restyling these two files propagates to sign-in, sign-up, entry create/edit, step forms, and paint forms.

5. **Page shells are highly duplicated** — The `rounded-2xl border-white/10 bg-white/10 backdrop-blur-xl p-8` pattern appears in 10+ page files. Extracting a `PageCard` Astro component or shadcn Card wrapper is the highest-ROI structural change.

6. **Product requirements are UI-agnostic** — `prd.md` specifies what to show (paint cards with name + color, Draft/Ready badges, step photos) but not visual styling. The design migration does not conflict with functional requirements.

7. **Archived slices document shipped patterns, not future design** — Entry list/detail, paint palette, steps, and auth shell archives describe cosmic glass patterns as implementation decisions. `DESIGN.md` represents a deliberate pivot not yet reflected in code.

## Historical Context (from prior changes)

- `context/changes/system-design/DESIGN.md` — Full visual design system from stitch.withgoogle.com; status `new`
- `context/archive/2026-06-01-account-auth-shell/` — Introduced `AppLayout` with cosmic background, `Topbar`, centered `max-w-4xl` shell
- `context/archive/2026-06-08-entry-draft-and-origin/` — Form primitives (`FormField`, `TextareaField`), Draft badge, green success banners
- `context/archive/2026-06-08-entry-paint-palette/` — `ColorField`, `PaintCard` swatch pattern, card shell on paint pages
- `context/archive/2026-06-09-steps-with-paint-cards/` — `PaintCard` on steps, checkbox paint assignment
- `context/archive/2026-06-10-entry-list-and-detail/` — Detail layout order, step card grid (1→3 cols), paint grid (1→2 cols), Ready badge green-tinted
- `context/archive/2026-06-12-entry-delete/` — `EntryListActionsMenu` kebab dropdown (replaces inline delete)
- `context/foundation/prd.md` — Functional UI requirements (paint cards, badges, list) without visual styling
- `context/foundation/roadmap.md` — Notes Tailwind 4 + shadcn-style UI as present stack

## Related Research

- No prior `research.md` artifacts for design/styling in `context/archive/`

## Open Questions

1. **Light-first or dark-first?** `DESIGN.md` describes parchment as default with "Midnight Sketchbook" dark mode, but the current UI is always dark cosmic. Should migration ship light mode first (matching design doc default) or preserve dark-as-default UX?

2. **Font loading strategy** — Google Fonts `<link>` vs `@fontsource` npm packages vs Astro experimental fonts? Affects build size, FOUT/FOIT, and Cloudflare Worker compatibility.

3. **Token naming** — Map `DESIGN.md` M3 names directly (`primary-container`, `on-surface`) or keep shadcn aliases (`primary`, `primary-foreground`) with M3 values underneath? Latter preserves shadcn CLI compatibility.

4. **Scope of landing page** — `Welcome.astro` is a full cosmic marketing page with orbs and star fields. Redesign to ledger aesthetic or defer landing to a later slice?

5. **Progress bars and dotted leaders** — Specified in `DESIGN.md` but no product feature uses them yet. Build now as design-system primitives or defer until a feature needs them?

6. **Paper grain texture** — Design mentions "slight grain of heavy-stock paper." Implement as CSS background texture/SVG noise or skip for MVP?

7. **Banner.astro** — Config warning banners use hardcoded light-theme hex colors (`#dbeafe`, `#fef3c7`). Remap to semantic tokens or replace with shadcn Alert?
