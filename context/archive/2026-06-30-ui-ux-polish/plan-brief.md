# UI/UX Polish — Plan Brief

> Full plan: `context/changes/ui-ux-polish/plan.md`  
> Research: `context/changes/ui-ux-polish/research.md`

## What & Why

Paint Ledger needs a cohesive polish pass: smoother entry workflow (redirect, navigation, badges, paint UI) plus a Field Journal landing page that matches the Stitch mockup. Users currently land on the list after creating an entry, struggle to find workflow navigation, and see visual inconsistencies (square swatches, duplicate color preview, misaligned status badge, cosmic homepage vs product UI).

## Starting Point

Research mapped all files. Authenticated pages already use Field Journal tokens via `AppLayout` + `PageCard`; `Welcome.astro` is still the cosmic starter. Workflow footers are copy-pasted dot-links. `public/logo-paint-ledger.svg` exists but is unused. Create redirect is one line in `src/pages/api/entries/index.ts:39`.

## Desired End State

After create, users edit immediately. Workflow pages show an icon-labelled action bar. Circular paint swatches and a deduped color field. Topbar shows the logo (email on desktop+). `/` is a Stitch-style marketing page with auth-aware CTAs. All CI checks and e2e specs pass.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Complexity | MEDIUM, 5 phases | Homepage is largest piece; rest are targeted file edits | Plan |
| Workflow nav pattern | Icon + label button group (Lucide) | User preference; more scannable than dot-links | Plan |
| Homepage CTAs | Auth-aware (signup vs `/entries/new`) | Better UX for returning users without complicating logged-out flow | Plan |
| Topbar logo layout | Logo always; email `hidden sm:inline` | Brand visible on mobile; account identifiable on desktop | Plan |
| Landing logo | Same `/logo-paint-ledger.svg` as Topbar | Single brand asset, consistent mark | Plan |
| Post-create redirect | `/entries/{id}/edit?created=1` | Matches update flow and user request | Research |
| Swatch sizes | Keep per-context sizes, only shape → `rounded-full` | Minimal diff; DESIGN.md specifies shape not size | Research |
| Marketing nav | In-page anchors (`#features`, `#cta`) | Stitch links are placeholders; anchors are functional | Plan |

## Scope

**In scope:** Create redirect + banner; `EntryWorkflowNav`; badge fix; circular swatches; ColorField dedup; `BrandLogo` + Topbar; Stitch homepage + CSS utilities; e2e updates; SVG cleanup.

**Out of scope:** Dark mode; new routes/APIs; `PaintSwatch` refactor; visual regression screenshots; legal page content; entry list badge unification.

## Architecture / Approach

Incremental phases: quick wins → shared workflow nav component → header branding → landing page composition → tests. New Astro components: `EntryWorkflowNav`, `BrandLogo`, landing sections under `src/components/landing/`. Homepage uses `Layout` (full width); app pages keep `AppLayout` (narrow shell). Redirects remain API-owned.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Quick wins | Redirect, swatches, ColorField, badge | E2e breakage until Phase 5 |
| 2. Workflow nav | Shared icon action bar | Link matrix wrong for `?edit=` views |
| 3. Header & logo | Topbar + SVG cleanup | Black rect in SVG asset |
| 4. Homepage | Stitch landing + tokens | Scope creep on marketing copy |
| 5. E2E & verify | Updated specs, full CI | E2e env prerequisites |

**Prerequisites:** Feature branch (not `main`); local Supabase for integration tests; Playwright + dev server for e2e.  
**Estimated effort:** ~3–4 implementation sessions across 5 phases.

## Open Risks & Assumptions

- Logo SVG background rect must be removed manually — asset may look broken until Phase 3.
- Lucide in Astro components: confirm project pattern (`lucide-react` vs inline SVG) at implement time; plan assumes same approach as existing entry icons.
- Auth-aware landing requires session available in `index.astro` middleware — verify `Astro.locals.user` on `/` (public route).

## Success Criteria (Summary)

- Create entry → edit page with success banner
- Workflow navigation obvious on every entry sub-page
- Logo visible when signed in; landing matches Stitch with working CTAs
- Lint, build, integration, and e2e green
