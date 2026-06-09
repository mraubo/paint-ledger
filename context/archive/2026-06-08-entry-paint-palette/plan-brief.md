# Entry Paint Palette — Plan Brief

> Full plan: `context/changes/entry-paint-palette/plan.md`

## What & Why

S-03 lets users build the entry-level paint list (FR-005): each paint has name, brand, color description, and an approximate hex color. This palette becomes the source of truth for step assignments in S-04 and paint cards in recall views.

## Starting Point

F-01 provides `entry_paints` with owner-only RLS. S-02 delivers entry create/edit/list at `/entries/**` with form POST + redirect, but there is no paint API, UI, or color input primitive.

## Desired End State

From entry edit, users open `/entries/[id]/paints` to add, inline-edit, and delete paints. Each row shows a color swatch and metadata; list sorts alphabetically by name. Color capture uses native picker + hex text (no catalog). Name is the only required field.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| UI placement | Dedicated `/entries/[id]/paints` page | Keeps basics edit focused; room for steps later | Plan |
| CRUD scope | Add, edit, delete | Full list management; delete safe before S-04 assignments | Plan |
| Color input | Native picker + hex text field | PRD Socrates resolution; no new dependency | Plan |
| Edit UX | Inline expand on paints page | Single-page list + form mental model | Plan |
| Delete UX | `confirm()` then POST | Simple guard; form POST pattern | Plan |
| List order | Alphabetical by name | User preference; no schema `position` column | Plan |
| Navigation | Link from entry edit only | Clear entry → paints flow without cluttering list | Plan |
| Validation | Name required only | Matches DB constraint; low-friction adds | Plan |
| Submit pattern | Native form POST + redirect | Matches S-02 and auth mutations | Plan |
| API auth | Existing `/api/entries` middleware + handler `getUser()` | Prefix already protected per `lessons.md` | Plan |

## Scope

**In scope:**

- `entry-paints-api.ts`, `entry-paints-page.ts`
- `POST /api/entries/[id]/paints`, `POST .../paints/[paintId]`, `POST .../paints/[paintId]/delete`
- `ColorField`, `EntryPaintForm`, `EntryPaintList`
- `/entries/[id]/paints.astro` + "Manage paints" on entry edit

**Out of scope:**

- Paint catalog, reorder, step assignment (S-04), delete-when-assigned guards
- Topbar/list shortcuts, JSON fetch saves, automated tests

## Architecture / Approach

```
/entries/[id]/paints  →  Astro SSR load paints (ORDER BY name)
                      →  React forms POST → /api/entries/[id]/paints/**
                      →  redirect ?added|updated|deleted=
```

Shared helpers mirror `entries-api.ts` / `entries-page.ts`. `ColorField` syncs picker and hex client-side; server normalizes and validates hex on every write.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Paint API and helpers | CRUD POST handlers + parse/validate | Establish hex validation and redirect errors early |
| 2. Paint form components | `ColorField`, add/edit form, inline list | Picker + hex sync edge cases |
| 3. Paints page and navigation | SSR page, banners, edit-page link | Entry-not-found vs empty paints distinction |

**Prerequisites:** F-01 + S-02 shipped locally; Supabase env + `.cookies` for auth smoke.

**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- S-04 may need delete protection when paints are assigned to steps — out of scope here.
- Default `#000000` swatch if user skips color — acceptable per name-only validation.
- No automated tests; regression relies on lint/build + manual smoke.
- Alphabetical order may not match painting sequence — manual reorder deferred.

## Success Criteria (Summary)

- User can manage entry paint list (add, edit, delete) with color swatches while signed in.
- Paint APIs and page reject unauthenticated access; RLS blocks cross-owner access.
- `npm run lint` and `npm run build` pass.
