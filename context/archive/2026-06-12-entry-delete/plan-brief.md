# Entry Delete — Plan Brief

> Full plan: `context/changes/entry-delete/plan.md`

## What & Why

Users need to remove paint log entries they no longer want — including paints, steps, and photos — without leaving orphaned database rows or (best-effort) storage files. This capability was explicitly deferred during S-02 and S-06; F-02/S-05 noted that full entry delete required a follow-up slice for storage cleanup.

## Starting Point

Database and RLS already support owner-scoped entry delete with CASCADE to child tables. Paint and step delete UIs/APIs exist as patterns. What's missing is the entry-level delete route, storage cleanup **before** DB delete (Storage RLS constraint), UI on edit and list pages, tests, and foundation doc registration.

## Desired End State

Users delete entries from the edit page danger zone or an inline list-row button. After native confirm, the entry and all child data are removed; photos are cleaned up best-effort first. The list shows a green `"<title>" deleted` banner. HTTP tests cover auth and IDOR denial.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| UI placement | Edit page + list row | Maximum convenience; user chose both surfaces | Plan |
| Confirmation | Native `confirm()` dialog | Matches paint/step delete; no new components | Plan |
| Status gate | Any status (draft or ready) | Simplest rule; user owns their data | Plan |
| Storage failure | Best-effort cleanup, always delete DB row | Matches step delete philosophy; user not blocked | Plan |
| List delete UX | Inline red Delete button per row | Consistent with existing delete button patterns | Plan |
| Success feedback | `/entries?deleted=<title>` personalized banner | Stronger confirmation than generic `?deleted=1` | Plan |
| Testing | HTTP IDOR + workflow cascade test | Matches test-plan Phase 3; no storage CI assertions | Plan |
| Foundation docs | PRD FR-013 + roadmap S-07 | User wants both updated if not already present | Plan |

## Scope

**In scope:**

- `deleteEntryWithPhotos` helper and `POST /api/entries/[id]/delete`
- Danger zone on edit page; inline Delete on list
- Personalized list success banner
- HTTP integration tests; PRD and roadmap updates

**Out of scope:**

- Detail-page delete, typed confirmation, status gates
- Abort on storage failure; storage assertions in CI
- Schema migrations, soft delete, bulk delete

## Architecture / Approach

```
User clicks Delete (edit or list)
  → POST /api/entries/[id]/delete
  → load entry + step storage paths
  → deleteEntryPhoto() for each path (best-effort)
  → DELETE entries row (CASCADE children)
  → redirect /entries?deleted=<title>
```

Follows paint/step POST+redirect+confirm. Inverts step-delete ordering: storage first, then DB (Storage RLS requires rows to exist).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Delete mutation and API route | Helper + POST handler with storage-before-DB | Storage RLS ordering wrong → orphans or blocked delete |
| 2. Delete UI on edit page and list | Danger zone, list buttons, title banner | Mis-clicks on dense list UI |
| 3. Tests and foundation docs | HTTP IDOR, workflow test, PRD + roadmap | HTTP tests need dev server running |

**Prerequisites:** S-06 complete; local Supabase + dev server for integration tests.

**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Storage cleanup may still leave orphans if delete fails after DB row is removed — accepted (same as step delete).
- Long entry titles produce long query strings — mitigated by 200-char title max in schema.
- List inline delete increases accidental-tap risk on mobile — mitigated by native confirm.

## Success Criteria (Summary)

- User deletes entry from edit or list; sees title confirmation banner; entry gone everywhere.
- Cross-user delete attempts fail without removing data.
- `npm run lint`, `npm run build`, and `npm test` pass with new coverage.
