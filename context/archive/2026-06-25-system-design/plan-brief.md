# Field Journal Narrative — Plan Brief

> Full plan: `context/changes/system-design/plan.md`
> Research: `context/changes/system-design/research.md`
> Design spec: `context/changes/system-design/DESIGN.md`

## What & Why

Paint Ledger still ships the Astro starter's cosmic glassmorphism UI while the product vision calls for **Field Journal Narrative** — a warm parchment ledger aesthetic defined in stitch.withgoogle.com. This change migrates the authenticated product surface (`/auth/*`, `/entries/**`) from hardcoded purple/blue glass classes to a token-driven design system grounded in `DESIGN.md`.

## Starting Point

The codebase has Tailwind 4 CSS-first setup and a shadcn `Button` primitive, but ~90% of visible UI bypasses theme tokens in favor of `bg-cosmic`, `purple-600`, and `backdrop-blur-xl` patterns duplicated across 20+ files. `DESIGN.md` tokens are documented but not wired into `global.css`. No web fonts are loaded.

## Desired End State

After this plan: signing in and managing entries feels like writing in a chronicler's ledger — parchment background, Burnt Sienna actions, Source Serif 4 headings, Work Sans body, JetBrains Mono metadata, ink-line card borders, recessed inputs. All cosmic/glass styling is removed from `/auth` and `/entries/**`. `Welcome.astro` and dark mode remain unchanged until follow-up slices.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ------------------ | ------ |
| Default color mode | Light-first (parchment) | Matches stitch export and brand narrative | Plan |
| Dark mode | Defer entirely | Halves token scope; light-first is the priority | Plan (default) |
| Font loading | `@fontsource` npm packages | Self-hosted, no CDN, Cloudflare-safe | Plan |
| Token naming | shadcn aliases with M3 hex values | Keeps existing `button.tsx` working; maps DESIGN.md underneath | Plan |
| shadcn adoption | Custom Astro/React primitives only | User choice; no new CLI installs | Plan |
| Landing page | Defer `Welcome.astro` | Core product paths first | Plan |
| Decorative patterns | Defer progress bars, dotted leaders, paper grain | No product feature uses them yet | Plan |
| Input style | Recessed background | Consistent across multi-field forms including ColorField | Plan |
| Layout | Evolve current `max-w-4xl` + responsive margins | Avoids risky 12-col grid refactor | Plan |
| Banner | Replace with custom `Alert.astro` | Unify config warnings with semantic tokens | Plan (default) |
| Delivery | Phased: foundation → auth → entries | Reviewable increments per area | Plan (default) |
| Testing | Manual visual + existing CI | E2E specs don't assert cosmic classes; no visual regression infra | Plan (default) |

## Scope

**In scope:**
- `global.css` token rewrite + `@fontsource` fonts
- Custom primitives: `PageCard`, `PageHeading`, `Alert`, `StatusChip`
- Form field restyle (`FormField`, `TextareaField`, `SubmitButton`, etc.)
- Shell: `AppLayout`, `Topbar`, `Layout.astro`
- All `/auth/*` and `/entries/**` pages and entry components
- Remove `bg-cosmic` usage from in-scope files

**Out of scope:**
- `Welcome.astro` / `/` landing redesign
- Dark mode / Midnight Sketchbook / theme toggle
- Progress bars, dotted leaders, paper grain texture
- New shadcn CLI component installs
- 12-column ledger grid refactor
- Visual regression screenshot infrastructure

## Architecture / Approach

Single source of truth: `src/styles/global.css` holds shadcn-compatible CSS variables populated from `DESIGN.md` hex values, bridged to Tailwind via `@theme inline`. Three `@fontsource` packages load in `global.css`; base layer assigns serif to headings, sans to body, mono to label utilities.

Repeated cosmic patterns consolidate into Astro shell components (`PageCard`, `PageHeading`, `Alert`, `StatusChip`). React form islands swap hardcoded glass classes for semantic Tailwind utilities (`bg-surface-container`, `text-on-surface`, `border-outline-variant`). Existing shadcn `Button` drops purple override once tokens map primary to Burnt Sienna.

```
DESIGN.md hex → :root CSS vars → @theme inline → Tailwind utilities
                     ↓
              Astro primitives (shells)
              React islands (forms, menus)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Tokens & typography | Fonts + parchment palette in `global.css` | Token mapping errors show only after page migration |
| 2. Shared primitives | PageCard, PageHeading, Alert, StatusChip, form restyle | FormField change propagates widely — test all forms |
| 3. Shell & auth | AppLayout, Topbar, sign-in/up/confirm on-brand | Auth is first user touch — must not break sign-in flow |
| 4. Entry workflow | All `/entries/**` pages + entry components | Largest file count; easy to miss a cosmic class |
| 5. Cleanup & verify | Grep sweep, CI, manual visual pass | Residual cosmic on deferred Welcome may confuse reviewers |

**Prerequisites:** `DESIGN.md` and `research.md` reviewed; feature branch (not `main`).
**Estimated effort:** ~4–5 implementation sessions across 5 phases.

## Open Risks & Assumptions

- Round 3 delivery/testing answers used recommended defaults (user interrupted Q&A) — adjust if you want dark mode or visual regression in scope.
- `Welcome.astro` stays cosmic until follow-up — `/` will look inconsistent with `/entries`.
- Custom primitives (not shadcn Card/Input) mean more maintenance, but matches explicit user choice.
- Light-only: users accustomed to dark cosmic UI get a full visual reset.

## Success Criteria (Summary)

- `/auth/*` and `/entries/**` render on parchment with DESIGN.md colors and fonts — no `bg-cosmic`, `purple-*`, or `backdrop-blur` in those paths.
- `npm run lint`, `npm run build`, and `npm run test:integration` pass.
- Manual walkthrough: sign-in → create entry → add paint → add step → view detail — all readable and on-brand.
