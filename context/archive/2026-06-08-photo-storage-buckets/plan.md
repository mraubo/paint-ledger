# Photo Storage Buckets Implementation Plan

## Overview

Deliver F-02: a private Supabase Storage bucket for entry photos, owner-scoped `storage.objects` RLS mirroring F-01 entry ownership, and nullable photo path columns on `steps` and `entries`. This unblocks S-05 (upload UI) without shipping application upload code in the foundation slice.

## Current State Analysis

**Already in place (F-01):**

- Paint-log schema with owner-only RLS on `entries`, `entry_paints`, `steps`, `step_paint_assignments` (`supabase/migrations/20260608103251_paint_log_schema.sql`).
- Ownership anchor: `entries.user_id = auth.uid()`; child tables use `EXISTS` subqueries through `entries` — the pattern Storage policies should mirror.
- SSR auth client (`src/lib/supabase.ts`) with cookie session; anon key only (no service role in app).
- Local seed fixture with one entry, two steps (`supabase/seed.sql`).
- `database.types.ts` typed for four public tables.

**Gaps for F-02:**

- No Storage buckets defined (migration or active `config.toml` block).
- No `storage.objects` RLS policies.
- No photo path columns on `steps` or `entries`.
- No Storage-related types or documentation.
- No `.storage` usage in application code (expected — deferred to S-05).

### Key Discoveries

- F-01 explicitly deferred photo columns and buckets to F-02 (`context/archive/2026-06-08-paint-log-schema-rls/plan.md`).
- `config.toml` has Storage enabled globally (`50MiB` default) with a commented `images` bucket example only (`supabase/config.toml:109-119`).
- Supabase Storage upsert requires INSERT + SELECT + UPDATE policies on `storage.objects` (`.agents/skills/supabase/SKILL.md`).
- PRD FR-009/FR-010: one optional photo per step; at least one final photo; NFR privacy requires owner-only access.
- GitHub [#4](https://github.com/mraubo/paint-ledger/issues/4) tracks F-02; unblocked now that F-01 ([#2](https://github.com/mraubo/paint-ledger/issues/2)) is done.

## Desired End State

After F-02:

- `supabase db reset` applies a new migration that:
  - Creates private bucket `entry-photos` (JPEG/PNG/WebP, 4 MiB per object).
  - Adds `steps.storage_path` (nullable text) and `entries.final_photo_path` (nullable text).
  - Defines `storage.objects` policies so authenticated users can INSERT/SELECT/UPDATE/DELETE only objects under their own `{user_id}/{entry_id}/…` paths where the entry (and step, when applicable) belongs to them.
- `supabase/config.toml` declares matching `[storage.buckets.entry-photos]` for local dev parity.
- `src/lib/database.types.ts` reflects new columns (regenerated and committed).
- README documents bucket layout, path convention, MIME/size limits, and manual Storage RLS verification steps.
- `npm run lint` and `npm run build` still pass.

### Verification

- `supabase db reset` succeeds with F-01 + F-02 migrations.
- Manual two-user smoke: user A can upload/read objects under their paths; user B is denied cross-user and cross-entry access.
- `npx supabase db advisors --local` reports no ERROR-level issues on new schema/policies.

## What We're NOT Doing

- Upload UI, resize pipeline, or API routes (S-05).
- Automated Storage object cleanup on entry/step delete (deferred to S-05 — document orphan risk).
- Signed URL helpers or image transformation (S-05/S-06).
- Public buckets or CDN-style anonymous photo access (violates privacy NFR).
- Dedicated `photos` table (MVP uses columns on existing tables).
- HEIC/RAW support (S-05 may convert client-side before upload).
- CI remote migration apply or automated Storage integration tests.
- npm scripts for every Supabase CLI command.

## Implementation Approach

Three phases matching F-01 rhythm: (1) single forward migration for bucket + policies + columns, (2) local `config.toml` + regenerated types + README, (3) manual RLS verification. Iterate locally with `supabase db reset` before committing.

**Bucket layout:** one private bucket `entry-photos` with path prefixes distinguishing step vs final photos.

**Path convention (object keys relative to bucket):**

| Kind  | Object key pattern                         | DB column                 |
| ----- | ------------------------------------------ | ------------------------- |
| Step  | `{user_id}/{entry_id}/steps/{step_id}`     | `steps.storage_path`      |
| Final | `{user_id}/{entry_id}/final`               | `entries.final_photo_path` |

Fixed paths enable upsert overwrite (one object per step / per entry final). S-05 sets `Content-Type` on upload; no file extension in the object key.

**RLS strategy:** combine folder-segment check `(split_part(name, '/', 1) = auth.uid()::text)` with `EXISTS` subquery on `entries` (and `steps` for step paths) — same ownership model as F-01 child-table policies.

## Critical Implementation Details

**Storage upsert requires INSERT, SELECT, and UPDATE policies.** Granting only INSERT allows new uploads but replacement silently fails. Include DELETE for S-05 remove flows.

**Policy helper predicate (conceptual):** all `storage.objects` policies for `entry-photos` should require `bucket_id = 'entry-photos'`, first path segment matches `auth.uid()`, second segment is a UUID of an owned `entries` row, and third segment is either `steps` (with fourth segment matching a `steps.id` on that entry) or `final` (no fourth segment). Use `split_part(name, '/', n)` — do not use deprecated `auth.role()`.

**DB columns store the full object key** (not a public URL). S-05 will use `supabase.storage.from('entry-photos').download(path)` or signed URLs against the private bucket.

**Bucket DDL in migration + `config.toml`:** migration `insert into storage.buckets` is authoritative for remote; `config.toml` `[storage.buckets.entry-photos]` keeps local stack aligned (`public = false`, `file_size_limit = "4MiB"`, `allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]`).

**Orphaned Storage objects** are an accepted gap until S-05 implements delete-on-replace and delete-on-entry-remove.

## Phase 1: Storage migration (bucket, policies, columns)

### Overview

Create one migration adding the bucket, `storage.objects` RLS, and nullable photo path columns on `steps` and `entries`.

### Changes Required

#### 1. Photo storage migration

**File**: `supabase/migrations/<timestamp>_entry_photo_storage.sql` (create via `supabase migration new entry_photo_storage`)

**Intent**: Provision private photo storage scoped to entry ownership and add DB columns S-05 will populate.

**Contract**:

- **Bucket** `entry-photos`:
  - `public = false`
  - `file_size_limit` = 4 MiB (4194304 bytes in SQL if required by column type)
  - `allowed_mime_types` = `{'image/jpeg', 'image/png', 'image/webp'}`
- **Columns**
  - `steps.storage_path` — nullable `text`; when set, must equal `{user_id}/{entry_id}/steps/{step_id}` for the row's step (enforced by app in S-05; optional CHECK deferred)
  - `entries.final_photo_path` — nullable `text`; when set, must equal `{user_id}/{entry_id}/final`
- **`storage.objects` policies** (all `to authenticated`, `bucket_id = 'entry-photos'`):
  - **SELECT** — user owns entry at path segment 2; step paths also validate step belongs to entry
  - **INSERT** — same predicate in `WITH CHECK`
  - **UPDATE** — `USING` + `WITH CHECK` with same predicate (upsert support)
  - **DELETE** — same `USING` predicate
- **No changes** to existing table RLS on `entries` / `steps` — photo path updates remain governed by existing UPDATE policies.

Ownership predicate sketch (implementer adapts into each policy):

```sql
split_part(name, '/', 1) = (select auth.uid())::text
and exists (
  select 1 from public.entries e
  where e.id = split_part(name, '/', 2)::uuid
    and e.user_id = (select auth.uid())
)
and (
  (split_part(name, '/', 3) = 'final' and split_part(name, '/', 4) = '')
  or (
    split_part(name, '/', 3) = 'steps'
    and exists (
      select 1 from public.steps s
      where s.id = split_part(name, '/', 4)::uuid
        and s.entry_id = split_part(name, '/', 2)::uuid
    )
  )
)
```

### Success Criteria

#### Automated Verification

- `supabase migration new entry_photo_storage` creates migration file
- `supabase db reset` applies F-01 + F-02 migrations without SQL errors
- `supabase migration list --local` shows both migrations applied

#### Manual Verification

- Studio → Storage shows `entry-photos` bucket (private)
- `\d steps` and `\d entries` show new nullable text columns
- `storage.objects` policies visible in Studio for all four operations

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Local config, TypeScript types, and documentation

### Overview

Align local Supabase config with the migration, regenerate types, and document the Storage foundation for S-05 implementers.

### Changes Required

#### 1. Local bucket config

**File**: `supabase/config.toml`

**Intent**: Mirror migration bucket settings so `supabase start` / `db reset` on a fresh clone matches production bucket constraints.

**Contract**: Uncomment/adapt the storage bucket block:

```toml
[storage.buckets.entry-photos]
public = false
file_size_limit = "4MiB"
allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]
```

#### 2. Regenerate database types

**File**: `src/lib/database.types.ts`

**Intent**: Expose `storage_path` and `final_photo_path` to typed `createClient` consumers in S-02+.

**Contract**: Run `npx supabase gen types typescript --local > src/lib/database.types.ts`; `entries.Row` gains `final_photo_path: string | null`; `steps.Row` gains `storage_path: string | null`.

#### 3. README Storage section

**File**: `README.md`

**Intent**: Document F-02 foundation alongside existing schema/seed section.

**Contract**: Add subsection covering:

- Bucket name `entry-photos` (private)
- Path convention table (step vs final)
- MIME types and 4 MiB limit
- Regenerate types command (already documented — extend mention to photo columns)
- Pointer to manual Storage RLS verification (Phase 3)
- Note that upload UI is S-05; orphaned objects possible until then

### Success Criteria

#### Automated Verification

- `supabase db reset` succeeds with updated `config.toml`
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification

- `database.types.ts` includes new columns on `entries` and `steps`
- README accurately describes bucket and path rules

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Storage RLS verification and security review

### Overview

Prove cross-user isolation for Storage operations using the same two-user manual pattern as F-01, and run security advisors.

### Changes Required

#### 1. Manual verification procedure (document in README)

**File**: `README.md` (Phase 2 may draft; finalize here)

**Intent**: Give implementers and reviewers a repeatable smoke test without S-05 UI.

**Contract**: Document steps:

1. `supabase db reset`; sign in as seed user.
2. Using Supabase Studio Storage UI or a one-off script with the authenticated SSR client, upload a test image to `{seed_user_id}/{seed_entry_id}/steps/{step_id}`.
3. Confirm `download` / list succeeds for seed user.
4. Sign in as second user; confirm upload to seed user's path fails; download/list of seed user's object fails.
5. Confirm upload to own entry path succeeds for second user.
6. Repeat for `{user_id}/{entry_id}/final` path.
7. Run `npx supabase db advisors --local`; resolve any ERROR-level findings.

### Success Criteria

#### Automated Verification

- `npx supabase db advisors --local` — no ERROR-level issues on storage policies
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification

- Two-user Storage RLS isolation smoke tests pass (deny cross-owner paths)
- Upsert overwrite works on fixed step path (INSERT then UPDATE/upsert same key)
- `supabase migration list --local` confirms two applied migrations

---

## Testing Strategy

### Unit Tests

None in repo; not introduced in F-02.

### Integration Tests

Deferred — manual two-user smoke is the acceptance test for foundation slices (matches F-01).

### Manual Testing Steps

1. `npx supabase start` → `npx supabase db reset`.
2. Verify bucket + columns in Studio.
3. Seed user upload to own step path → success.
4. Second user denied on seed paths; allowed on own paths.
5. Replace step photo via upsert on same path → single object remains.
6. Advisors clean; lint + build pass.

## Performance Considerations

Subquery-based Storage RLS adds per-request policy evaluation — acceptable for solo MVP volumes. Fixed paths avoid listing bucket prefixes to find photos; S-05 reads paths from DB columns.

## Migration Notes

- **Local**: `supabase db reset` is destructive — fine for dev.
- **Remote**: Apply with `supabase db push` before S-05 targets cloud Storage. Migrations are forward-only; `wrangler rollback` does not revert buckets or objects (`context/foundation/infrastructure.md`).
- **Seed**: No photo objects in `seed.sql` for F-02 (optional tiny fixture image deferred — manual upload sufficient for verification).
- **Types**: Regenerate after migration: `npx supabase gen types typescript --local > src/lib/database.types.ts`.
- **Cleanup**: S-05 must delete Storage objects when replacing/removing photos and when deleting entries — document as contract for downstream slice.

## References

- Roadmap F-02: `context/foundation/roadmap.md`
- PRD FR-009, FR-010, privacy NFR: `context/foundation/prd.md`
- F-01 schema (ownership model): `supabase/migrations/20260608103251_paint_log_schema.sql`
- F-01 plan (photo deferral): `context/archive/2026-06-08-paint-log-schema-rls/plan.md`
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase skill security checklist: `.agents/skills/supabase/SKILL.md`
- GitHub issue [#4](https://github.com/mraubo/paint-ledger/issues/4)
- SSR client: `src/lib/supabase.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Storage migration (bucket, policies, columns)

#### Automated

- [x] 1.1 `supabase migration new entry_photo_storage` creates migration file — 231e642
- [x] 1.2 `supabase db reset` applies F-01 + F-02 migrations without SQL errors — 231e642
- [x] 1.3 `supabase migration list --local` shows both migrations applied — 231e642

#### Manual

- [x] 1.4 Studio shows `entry-photos` bucket and new columns on `entries` / `steps` — 231e642
- [x] 1.5 `storage.objects` policies exist for SELECT, INSERT, UPDATE, DELETE — 231e642

### Phase 2: Local config, TypeScript types, and documentation

#### Automated

- [x] 2.1 `supabase db reset` succeeds with `config.toml` bucket block — 0d6642b
- [x] 2.2 `npm run lint` passes — 0d6642b
- [x] 2.3 `npm run build` passes — 0d6642b

#### Manual

- [x] 2.4 `database.types.ts` includes `final_photo_path` and `storage_path` — 0d6642b
- [x] 2.5 README documents bucket, paths, limits, and verification pointer — 0d6642b

### Phase 3: Storage RLS verification and security review

#### Automated

- [x] 3.1 `npx supabase db advisors --local` — no ERROR-level issues — 9651724
- [x] 3.2 `npm run lint` passes — 9651724
- [x] 3.3 `npm run build` passes — 9651724

#### Manual

- [x] 3.4 Two-user Storage RLS isolation smoke tests pass — 9651724
- [x] 3.5 Upsert overwrite on fixed step path verified — 9651724
- [x] 3.6 `supabase migration list --local` confirms two applied migrations — 9651724
