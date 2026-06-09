# Steps with Paint Cards — Plan Brief

> Full plan: `context/changes/steps-with-paint-cards/plan.md`

## What & Why

S-04 completes the recipe core: ordered tutorial steps with descriptions, paints assigned from the entry palette (including inline add during step writing), and paint cards on each step showing name and approximate color. This unlocks S-05 photos and S-06 full recall while enforcing the product invariant that the entry paint list is the source of truth for assignments.

## Starting Point

F-01 provides `steps`, `step_paint_assignments`, RLS, and a same-entry trigger. S-03 delivers entry paint CRUD at `/entries/[id]/paints` with POST + redirect, URL-based `?edit=` paint edit, and swatch rendering. No step queries or UI exist in `src/` yet.

## Desired End State

From entry edit, users open `/entries/[id]/steps` to add, edit, reorder, and delete steps. Each step shows its description and assigned paint cards. Step edit offers a paint checklist plus collapsible inline add-to-palette. Paints assigned to steps cannot be deleted until unassigned. Order is controlled with move up/down; delete renumbers steps to contiguous positions.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Page placement | Dedicated `/entries/[id]/steps` | Matches S-03 paints sub-route pattern | Plan |
| Step edit UX | URL `?edit=<stepId>` full-page form | Shipped S-03 precedent | Plan |
| Step reorder | Move up / move down buttons | Simple, accessible; fits `position` column | Plan |
| Paint assignment | Multi-select checklist on step edit | One POST syncs description + assignments | Plan |
| Inline add (FR-006) | Collapsible mini-form on step edit | Stays in step context; reuses paint API | Plan |
| Delete step | Renumber to contiguous 1…n | Keeps move logic and mental model clean | Plan |
| Paint delete when assigned | Block with clear error | Protects recipe integrity for S-06 | Plan |
| Priority if tight | Keep all FR-006/007/008 | Roadmap S-04 outcome intact | Plan |
| Schema | No migration | F-01 tables already exist | Research |
| Submit pattern | Native form POST + redirect | Matches S-02/S-03 | Research |

## Scope

**In scope:**

- `entry-steps-api.ts`, `entry-steps-page.ts`
- Step CRUD + move APIs; assignment sync on update
- Paint create `redirect_to` + paint delete assignment guard
- `PaintCard`, `EntryStepForm`, inline paint add
- `/entries/[id]/steps.astro` + "Manage steps" on entry edit

**Out of scope:**

- Step photos (S-05), detail recall (S-06), drag-drop reorder
- Step titles, paint catalog, automated tests
- JSON fetch SPA saves

## Architecture / Approach

```
/entries/[id]/steps  →  Astro SSR load steps + assignments (ORDER BY position)
                     →  React EntryStepForm POST → /api/entries/[id]/steps/**
                     →  redirect ?added|updated|deleted|moved=
                     →  inline paint add POST → /api/entries/[id]/paints (redirect_to step edit)
```

Assignment sync replaces junction rows on step update. DB trigger enforces same-entry invariant; server validates paint IDs against entry palette before insert.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Step API and helpers | CRUD, move, renumber, assignment sync, paint guards | Position swap/renumber ordering bugs |
| 2. Step form components | Step form, PaintCard, inline paint add | Checkbox + redirect_to wiring |
| 3. Steps page and navigation | SSR list with cards, move/delete, nav links | List vs edit view parity with paints |

**Prerequisites:** F-01 + S-02 + S-03 shipped locally; Supabase env + `.cookies` for auth smoke.

**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Assignment replace-on-update must stay transactional enough to avoid orphaned junction rows on partial failure (use sequential delete+insert with error handling).
- Large palettes make long checkbox lists — acceptable for MVP hobby scale.
- No automated tests; regression relies on lint/build + manual smoke.
- CSRF on form POSTs remains accepted MVP limitation (per S-02/S-03).

## Success Criteria (Summary)

- User can manage ordered steps with paint cards and inline palette add while signed in.
- Entry paint list invariant enforced in API, UI, and DB; assigned paints cannot be deleted blindly.
- `npm run lint` and `npm run build` pass.
