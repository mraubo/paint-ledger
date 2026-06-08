# Paint Log Schema and RLS — Plan Brief

> Full plan: `context/changes/paint-log-schema-rls/plan.md`
> Research: _(none — PRD + roadmap baseline)_

## What & Why

Paint Ledger cannot persist private paint logs until Postgres has tables and owner-only RLS. F-01 delivers the data foundation — entries, paints, ordered steps, and step↔paint assignments — so S-02+ can build entry workflows on top of FR-002 isolation at the database layer (S-01 only guards routes).

## Starting Point

Supabase CLI config exists (`supabase/config.toml`, Postgres 17) but there are no migrations, no seed file, and no generated types. The SSR client handles auth only (`src/lib/supabase.ts`). README still describes an auth-only database.

## Desired End State

`supabase db reset` creates four RLS-protected tables with a junction trigger enforcing “assigned paints belong to the entry.” Local seed provides one fixture entry. `src/lib/database.types.ts` is committed and wired into `createClient`. Developers can verify two-user isolation manually before S-02 ships.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Junction table | Include in F-01 | Full schema in one migration; S-04 wires UI only | Plan |
| Photo columns | Defer to F-02 | Storage buckets and policies are a separate foundation slice | Plan |
| TypeScript types | Commit `database.types.ts` | S-02 gets typed queries immediately | Plan |
| RLS ownership | Subquery via `entries.user_id` | Single source of truth; no denormalized `user_id` on children | Plan |
| Paint invariant | FK + trigger on junction | FR-006 enforced even if app regresses | Plan |
| Entry delete | `ON DELETE CASCADE` | Private notes — no orphan children | Plan |
| Entry status | `draft \| ready` | Simpler two-state workflow for MVP | Plan |
| Local seed | Minimal fixture + dev auth user | Enables RLS verification without S-02 UI | Plan |

## Scope

**In scope:**

- Migration: `entries`, `entry_paints`, `steps`, `step_paint_assignments`
- RLS policies (owner-only, subquery pattern on children)
- Junction trigger (same-entry paint assignment)
- `supabase/seed.sql` (local dev user + one fixture entry)
- `src/lib/database.types.ts` + typed `createClient`
- README migration/seed documentation

**Out of scope:**

- Storage buckets / photo paths (F-02)
- Entry CRUD UI or API (S-02+)
- `published` status value
- CI remote migration apply
- Automated tests

## Architecture / Approach

```
auth.users
    └── entries (user_id, status, text fields)
            ├── entry_paints (name, brand, color_description, approximate_color)
            ├── steps (position, description)
            └── step_paint_assignments (step_id ↔ entry_paint_id + trigger)
```

All app queries use the anon SSR client; Postgres RLS filters rows by `auth.uid()` matching `entries.user_id`. Child tables never store `user_id` — policies subquery through `entries`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Postgres migration | Tables, enum, FKs, CASCADE, trigger, RLS | Policy gaps on child tables (UPDATE needs SELECT) |
| 2. Seed, types, docs | `seed.sql`, `database.types.ts`, README | Seed `auth.users` insert is local-only |
| 3. RLS verification | Two-user smoke tests, `db advisors` | False confidence if only Studio superuser testing |

**Prerequisites:** Docker (for local Supabase), `.env` with local `SUPABASE_URL` / `SUPABASE_KEY`.

**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Status enum omits PRD `published` — add later via migration if needed.
- Remote Supabase migration apply is manual; coordinate before S-02 targets cloud DB.
- Seed auth user SQL must never run against production.
- No app queries in F-01 — RLS verification is manual until S-02.

## Success Criteria (Summary)

- `supabase db reset` succeeds with migration + seed.
- Two local users cannot access each other's paint-log rows.
- Junction trigger blocks cross-entry paint assignment.
- Lint and build pass with committed types.
