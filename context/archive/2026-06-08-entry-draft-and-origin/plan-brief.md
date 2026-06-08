# Entry Draft and Origin — Plan Brief

> Full plan: `context/changes/entry-draft-and-origin/plan.md`
> Change notes: `context/changes/entry-draft-and-origin/change.md`

## What & Why

S-02 is the first slice where users persist paint log data. They create a draft entry with title, description, model information, and a freeform model origin note (FR-003, FR-004) — the foundation for paints, steps, and photos in later slices.

## Starting Point

F-01 provides the `entries` table and RLS. S-01 protects `/entries` with `AppLayout`, but the index page is a placeholder and there are no entry APIs or forms.

## Desired End State

Authenticated users browse a minimal entry list (title, Draft badge, updated date), create entries at `/entries/new`, and edit basics at `/entries/[id]`. Saves use native form POST + redirect (auth pattern). Reads use server-rendered Supabase queries. New entries default to `draft` with only title required.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Scope | Create + edit + minimal list | User can confirm saves and fix mistakes; sets up S-06 | Plan |
| Submit pattern | Native form POST + redirect | Matches auth mutations; works without JS | Plan |
| Read path | Astro frontmatter + RLS | No premature GET API surface | Plan |
| Status UI | Defer toggle; read-only Draft badge on list/detail | Keep forms minimal; still signal lifecycle | Plan |
| After create | Redirect to `/entries?created=` | Success feedback on list | Plan |
| After edit | Redirect to `/entries/[id]?saved=1` | POST-redirect-GET with inline banner | Plan |
| List columns | Title + status badge + updated_at | Enough to find entries at low volume | Plan |
| Empty list | Empty state + Create entry CTA | Clear onboarding after sign-up | Plan |
| API auth | Middleware + handler `getUser()` | `lessons.md` compliance | Plan |
| Validation | Title required only | Matches DB constraint; low-friction drafts | Plan |
| `published` status | Out of scope | F-01 enum is `draft \| ready` only | Research |
| Remote branch | Fresh start from this plan | User preference; do not reuse unpulled commits | Plan |

## Scope

**In scope:**

- `POST /api/entries`, `POST /api/entries/[id]`
- `/api/entries` in `PROTECTED_ROUTES`
- `EntryBasicsForm` + `TextareaField`
- Pages: `/entries` (list + empty state + banners), `/entries/new`, `/entries/[id]` (edit)
- Read-only Draft badges on list and edit pages

**Out of scope:**

- Status toggle, `published` enum, delete
- Paints, steps, photos, full detail recall (S-03–S-06)
- JSON `fetch` SPA save flow, search/filter, automated tests

## Architecture / Approach

```
/entries, /entries/[id]  →  Astro frontmatter reads (Supabase SSR + RLS)
/entries/new, forms      →  React form POST → /api/entries → redirect
```

Shared `EntryBasicsForm` handles create and edit. `src/lib/entries-api.ts` centralizes parse/auth for handlers; `src/lib/entries-page.ts` handles SSR reads.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. API and route protection | POST handlers + middleware; curl smoke | First entry API — establish redirect error pattern early |
| 2. Entry basics form | `EntryBasicsForm` + `TextareaField` | Textarea styling parity with `FormField` |
| 3. Pages and entry list | List, new, edit routes; banners + badges | Edit 404 vs redirect semantics for missing entries |

**Prerequisites:** F-01 migration applied locally; Supabase env + `.cookies` for auth smoke.

**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Remote Supabase must have F-01 schema before cloud testing.
- `published` status deferred — add enum migration later if PRD requires it.
- No automated tests; regression relies on lint/build + manual smoke.
- List has no pagination — acceptable per PRD non-goals at low volume.

## Success Criteria (Summary)

- User can create, list, and edit entry basics end-to-end while signed in.
- APIs and pages reject unauthenticated access; RLS blocks cross-owner reads/writes.
- `npm run lint` and `npm run build` pass.
