# Entry List and Detail Recall — Plan Brief

> Full plan: `context/changes/entry-list-and-detail/plan.md`
> Change notes: `context/changes/entry-list-and-detail/change.md`

## What & Why

S-06 is the north-star slice (FR-011, FR-012, US-01): users browse saved paint log entries and reopen a read-only detail view that reconstructs the full recipe without external notes. This completes the must-have product hypothesis — add a complete entry, find it later, recall paints, steps, and photos.

## Starting Point

The entry list already exists with title, Draft badge, updated date, and final-photo thumbnails (S-05 preview). `/entries/[id]` is an edit hub (basics form + final photo upload). SSR loaders for paints, steps, and signed photo URLs are in place. No read-only recall page; no mark-ready UI; list lacks step count and Ready badge.

## Desired End State

Users click a list row → `/entries/[id]` shows read-only recall (hero final photo, description when set, model info, origin note, paint palette, ordered steps with paint cards and step photos). **Edit entry** opens `/entries/[id]/edit`. Status changes via `POST /api/entries/[id]/status-change` with target `status` (`draft` or `ready`); mark ready requires final photo; ready entries can revert to draft. List rows show step count plus Draft or Ready badge.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Detail route | `/entries/[id]` recall; edit at `/edit` | North-star reopen is primary action | Plan |
| Edit access from detail | Single "Edit entry" CTA → edit hub | Clean recall surface | Plan |
| Description on detail | Show when non-empty | US-01 basic information includes it | Plan |
| Empty sections | Hide entirely | Cleaner recall for partial drafts | Plan |
| Draft visibility | Show all; Draft/Ready badges | Matches current list; WIP browsable | Plan |
| Paint palette display | Full rows (swatch, name, brand, description) | Complete palette context for FR-005 | Plan |
| List enhancements | Step count + Ready badge | User request beyond minimal FR-012 | Plan |
| Final photo layout | Hero at top below title | User preference; visual payoff first | Plan |
| Status API | `POST .../status-change` with `status` field | Single endpoint for draft ↔ ready | Plan |
| Mark ready | Requires final photo | Aligns with S-05 warning | Plan |
| Revert to draft | Button on ready entries | User can reopen editing | Plan |
| Data loading | Compose existing SSR loaders | No new GET API surface | Plan |

## Scope

**In scope:**

- Move edit hub to `/entries/[id]/edit`; update API redirects and footers
- Read-only detail page at `/entries/[id]`
- Status-change POST handler + edit UI (draft ↔ ready)
- List step count and Ready badge
- Optional read-only display components for paints/steps

**Out of scope:**

- Search, filter, pagination
- Delete entry
- JSON GET API, schema migrations
- Automated tests

## Architecture / Approach

```
/entries              →  loadEntryList (+ step counts) → list with badges → link to detail
/entries/[id]         →  parallel SSR loads → read-only recall
/entries/[id]/edit    →  existing edit hub + mark-ready form
POST .../status-change  →  status=draft|ready (ready requires final photo)
```

Detail composes `loadEntryForEdit`, `loadEntryPaints`, `loadEntrySteps`, and signed photo URLs. Writes stay form POST + redirect.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Route split + status change | Edit at `/edit`; redirect/link updates; status-change API | Missing a redirect leaves users on wrong page after save |
| 2. Detail recall | Read-only `[id].astro` with full recipe layout | Duplicated markup vs paints/steps pages — extract if needed |
| 3. List badges | Step count + Ready badge on list rows | Batch step-count query must avoid N+1 |

**Prerequisites:** S-05 shipped (photos + list thumbnails); local Supabase + `.cookies` for auth smoke.

**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Bookmarked `/entries/[id]` URLs will show detail instead of edit — intentional route swap.
- Mark-ready hard-blocks without final photo; revert to draft has no extra gate; no requirement for steps/paints at MVP.
- No automated tests; regression relies on lint/build + manual smoke.
- Signed URL generation on detail load adds latency proportional to step count — acceptable at hobby scale.

## Success Criteria (Summary)

- User can browse entries, open detail recall, and see the full recipe without edit forms.
- User can change entry status from edit (draft ↔ ready); mark ready requires final photo; list reflects status badges.
- List shows step count and status badges; `npm run lint` and `npm run build` pass.
