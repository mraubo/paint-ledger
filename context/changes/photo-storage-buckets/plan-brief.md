# Photo Storage Buckets — Plan Brief

> Full plan: `context/changes/photo-storage-buckets/plan.md`
> Research: _(none — F-01 archive + codebase baseline)_

## What & Why

Paint Ledger needs private photo storage before S-05 can attach step and final photos (FR-009, FR-010). F-02 delivers the Supabase Storage foundation — one private bucket, owner-scoped policies tied to F-01 entry ownership, and nullable path columns on `steps` and `entries`.

## Starting Point

F-01 provides the paint-log schema with owner-only RLS on four tables but explicitly deferred all photo work. Storage is enabled in `config.toml` with no active buckets; no `storage.objects` policies or photo columns exist. The SSR client handles auth only — no `.storage` calls yet.

## Desired End State

`supabase db reset` creates private bucket `entry-photos` with JPEG/PNG/WebP at 4 MiB, RLS policies mirroring `entries.user_id` ownership, and `steps.storage_path` / `entries.final_photo_path` columns. Types and README are updated. Two-user manual smoke confirms cross-owner Storage access is denied. S-05 can implement upload UI against a stable path contract.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Bucket layout | Single private `entry-photos` bucket | One policy set; path prefixes distinguish step vs final | Plan |
| Photo metadata | Columns on `steps` + `entries` | One photo per step MVP; matches F-01 flat schema | Plan |
| Path convention | `{user_id}/{entry_id}/…` | Fast ownership check; aligns with Supabase folder RLS examples | Plan |
| F-02 scope | Infra only (no upload UI) | Matches F-01 foundation pattern; S-05 owns integration | Plan |
| Delete cleanup | Defer to S-05 | Avoid Edge Functions/triggers in foundation slice | Plan |
| File limits | JPEG/PNG/WebP, 4 MiB | User preference; covers phone photos with tight storage budget | Plan |
| Replace behavior | Fixed path + upsert | Enforces one object per step; requires UPDATE policy | Plan |
| Verification | Manual two-user RLS smoke | Same pattern as F-01; no test harness yet | Plan |

## Scope

**In scope:**

- Migration: `entry-photos` bucket, `storage.objects` RLS (SELECT/INSERT/UPDATE/DELETE)
- Columns: `steps.storage_path`, `entries.final_photo_path`
- `config.toml` local bucket block
- Regenerated `database.types.ts`
- README Storage documentation and verification steps

**Out of scope:**

- Upload UI, resize, API routes (S-05)
- Storage object cleanup on cascade delete
- Public buckets or signed URL helpers
- Dedicated `photos` table
- Automated tests / CI Storage integration

## Architecture / Approach

```
auth.users
    └── entries (final_photo_path → Storage: {user_id}/{entry_id}/final)
            └── steps (storage_path → Storage: {user_id}/{entry_id}/steps/{step_id})

Bucket: entry-photos (private)
RLS: split_part path segments + EXISTS on entries/steps (mirrors F-01 subquery pattern)
```

S-05 writes objects to fixed paths, upserts on replace, and stores the object key in DB columns. Private bucket — access only via authenticated Storage API.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Storage migration | Bucket, policies, photo path columns | Policy gaps (UPDATE/SELECT for upsert; step path validation) |
| 2. Config, types, docs | `config.toml`, `database.types.ts`, README | Local vs remote bucket setting drift |
| 3. RLS verification | Two-user Storage smoke, advisors | False confidence if only Studio superuser testing |

**Prerequisites:** F-01 applied locally; Docker for Supabase; `.env` with local `SUPABASE_URL` / `SUPABASE_KEY`.

**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Orphaned Storage objects until S-05 implements delete-on-replace/entry-delete.
- HEIC iPhone photos need client-side conversion in S-05 (not in allowed MIME list).
- Remote bucket apply is manual (`supabase db push`); coordinate before S-05 targets cloud.
- Path predicate edge cases (malformed paths) are denied by RLS — S-05 must construct paths correctly.

## Success Criteria (Summary)

- `supabase db reset` applies bucket + columns + policies cleanly.
- Two local users cannot access each other's Storage objects.
- Types and README reflect the path contract S-05 will use.
- Lint and build pass.
