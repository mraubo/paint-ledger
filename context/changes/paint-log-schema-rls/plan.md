# Paint Log Schema and RLS Implementation Plan

## Overview

Deliver F-01: the Postgres foundation for Paint Ledger — tables for entries, entry-level paints, ordered steps, and step↔paint assignments, with owner-only row-level security. Generate TypeScript types, wire the SSR client, and add local seed fixtures so RLS can be verified before S-02 ships entry UI.

## Current State Analysis

**Already in place:**

- Supabase CLI config (`supabase/config.toml`, Postgres 17, migrations enabled).
- SSR auth client (`src/lib/supabase.ts`) using anon key + cookie session — RLS will apply to future queries.
- Route-level protection on `/entries` (`src/middleware.ts`) from archived S-01.
- PRD and shape-notes define the product model (fields, invariants, access control).

**Gaps for F-01:**

- No `supabase/migrations/` directory or SQL schema.
- `config.toml` references `./seed.sql` but the file does not exist.
- No generated `database.types.ts`; `createClient` is untyped.
- README states auth-only DB usage (line ~131) — stale after F-01.
- No `.from()` table queries in application code.

### Key Discoveries

- Roadmap baseline confirms data layer is absent (`context/foundation/roadmap.md`).
- FR-002 data isolation was explicitly deferred from S-01 to F-01 (`context/archive/2026-06-01-account-auth-shell/plan.md`).
- `supabase` CLI is a devDependency (`package.json`); no npm scripts for `db reset` or `gen types` yet.
- F-02 (`photo-storage-buckets`) depends on F-01 entry ownership for storage policies — photo columns stay out of this migration.

## Desired End State

After F-01:

- `supabase db reset` applies one migration creating four tables with FKs, `draft | ready` status enum, CASCADE deletes, and a junction trigger enforcing the paint-assignment invariant.
- RLS is enabled on all four tables; authenticated users can only read/write rows belonging to their entries (`entries.user_id = auth.uid()`; child tables use subquery policies).
- `supabase/seed.sql` inserts a local dev auth user plus one fixture entry (2 paints, 2 steps, 1 assignment).
- `src/lib/database.types.ts` exists; `createClient` is typed with `Database`.
- README documents migration workflow, seed credentials, and RLS verification steps.
- `npm run lint` and `npm run build` still pass (types file is committed; no runtime query changes required).

### Verification

- `supabase db reset` succeeds locally.
- Manual RLS smoke: user A cannot read user B's rows via Supabase client or Studio SQL as `authenticated` role.
- Seed data visible in Studio after reset; seed user can sign in locally and (once S-02 queries exist) would see only their fixture.

## What We're NOT Doing

- Storage buckets or photo path columns (F-02).
- Entry CRUD UI or API routes (S-02+).
- `published` entry status (planning decision: `draft | ready` only — see plan-brief).
- Soft delete / `deleted_at` columns.
- Denormalized `user_id` on child tables.
- `SECURITY DEFINER` helper functions for RLS.
- CI migration apply to remote Supabase (local-first; remote push documented as manual deploy step).
- Automated test suite (none exists in repo).
- npm scripts for every Supabase CLI command (optional nice-to-have; not required).

## Implementation Approach

Three phases: (1) single forward migration with schema + RLS + trigger, (2) seed fixture + generated types + client wiring + docs, (3) verification. Keep all SQL in versioned migrations; iterate locally with `supabase db reset` before committing.

## Critical Implementation Details

**Seed runs as superuser and bypasses RLS**, but fixture `user_id` values must reference a real `auth.users` row for FK integrity and for signing in as the seed user. The seed must insert both `auth.users` and `auth.identities` rows (local dev only — never run auth-user seed SQL against production).

**Child-table UPDATE policies need SELECT access.** Per Supabase security guidance, each table with UPDATE policy also needs a SELECT policy (or UPDATE silently affects 0 rows).

**Status enum is `draft | ready` only.** PRD FR-003 mentions `published`; planning session narrowed to two states. If product later needs `published`, add a follow-up enum migration in S-02 or a dedicated change.

## Phase 1: Postgres migration (schema, RLS, trigger)

### Overview

Create the first migration file defining enums, tables, FKs with `ON DELETE CASCADE`, the cross-entry paint assignment trigger, grants for `authenticated`, and owner-only RLS policies.

### Changes Required

#### 1. Initial migration

**File**: `supabase/migrations/<timestamp>_paint_log_schema.sql` (create via `supabase migration new paint_log_schema`)

**Intent**: Define the full paint-log relational model and enforce owner isolation at the database layer.

**Contract**:

- **Enum** `entry_status`: `'draft'`, `'ready'` (default `'draft'` on `entries`).
- **Table `entries`**
  - `id` uuid PK default `gen_random_uuid()`
  - `user_id` uuid NOT NULL references `auth.users(id)` ON DELETE CASCADE
  - `title` text NOT NULL
  - `description` text NOT NULL default `''`
  - `model_info` text NOT NULL default `''`
  - `model_origin_note` text NOT NULL default `''`
  - `status` entry_status NOT NULL default `'draft'`
  - `created_at`, `updated_at` timestamptz NOT NULL default `now()`
  - Index on `user_id` (list queries in S-06)
- **Table `entry_paints`**
  - `id` uuid PK
  - `entry_id` uuid NOT NULL references `entries(id)` ON DELETE CASCADE
  - `name` text NOT NULL
  - `brand` text NOT NULL default `''`
  - `color_description` text NOT NULL default `''`
  - `approximate_color` text NOT NULL default `'#000000'` (hex from color picker)
  - `created_at`, `updated_at` timestamptz NOT NULL default `now()`
  - Index on `entry_id`
- **Table `steps`**
  - `id` uuid PK
  - `entry_id` uuid NOT NULL references `entries(id)` ON DELETE CASCADE
  - `position` integer NOT NULL (1-based ordering)
  - `description` text NOT NULL default `''`
  - `created_at`, `updated_at` timestamptz NOT NULL default `now()`
  - UNIQUE (`entry_id`, `position`)
  - Index on `entry_id`
- **Table `step_paint_assignments`**
  - `step_id` uuid NOT NULL references `steps(id)` ON DELETE CASCADE
  - `entry_paint_id` uuid NOT NULL references `entry_paints(id)` ON DELETE CASCADE
  - `created_at` timestamptz NOT NULL default `now()`
  - PRIMARY KEY (`step_id`, `entry_paint_id`)
- **Trigger** `enforce_step_paint_same_entry` BEFORE INSERT OR UPDATE on `step_paint_assignments`: raise exception if `entry_paints.entry_id` ≠ `steps.entry_id` for the referenced rows.
- **`updated_at`**: optional `moddatetime` trigger or simple `BEFORE UPDATE` set `updated_at = now()` on `entries`, `entry_paints`, `steps` (keep consistent across tables).
- **Grants**: `GRANT USAGE ON SCHEMA public TO authenticated`; `GRANT SELECT, INSERT, UPDATE, DELETE` on all four tables to `authenticated`.
- **RLS**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all four tables.
- **Policies** (all `TO authenticated`; use `(select auth.uid())` form):
  - `entries`: `user_id = (select auth.uid())` for SELECT, INSERT (`WITH CHECK`), UPDATE (`USING` + `WITH CHECK`), DELETE.
  - `entry_paints`, `steps`, `step_paint_assignments`: `USING` / `WITH CHECK` via `EXISTS (SELECT 1 FROM entries e JOIN ... WHERE e.user_id = (select auth.uid()) AND <child belongs to e>)`. Junction policies must join through both `steps` and `entry_paints` to the owning entry.

Do **not** use deprecated `auth.role()` checks; do **not** use `TO authenticated` without ownership predicate.

### Success Criteria

#### Automated Verification

- `supabase migration new paint_log_schema` creates the migration file
- `supabase db reset` applies migration without SQL errors
- `supabase migration list --local` shows applied migration

#### Manual Verification

- `\d entries`, `\d entry_paints`, `\d steps`, `\d step_paint_assignments` in local psql show expected columns and FKs
- Inserting a junction row pairing a step with another entry's paint fails with trigger error

**Implementation Note**: Pause for human confirmation after migration applies cleanly before Phase 2.

---

## Phase 2: Seed fixture, TypeScript types, and documentation

### Overview

Add local dev seed data, generate and commit Supabase types, type the SSR client, and update README for the new database workflow.

### Changes Required

#### 1. Local seed fixture

**File**: `supabase/seed.sql`

**Intent**: Provide one realistic paint-log fixture after `db reset` so developers can inspect data in Studio and test RLS without building S-02 UI.

**Contract**:

- Insert a **local-only** dev user into `auth.users` and `auth.identities` with fixed UUIDs and documented email/password (e.g. `seed@paint-ledger.local` / `seed-password-123`).
- Insert one `entries` row owned by that user (`status = 'ready'`, sample title/description/model fields).
- Insert two `entry_paints` rows and two `steps` rows (positions 1 and 2).
- Insert one `step_paint_assignments` row linking step 1 to paint 1.
- Add a header comment: **local development only — do not run against production**.

`config.toml` already has `sql_paths = ["./seed.sql"]` — no config change needed.

#### 2. Generated database types

**File**: `src/lib/database.types.ts`

**Intent**: Give S-02+ typed table access via supabase-js.

**Contract**: Generate with `npx supabase gen types typescript --local > src/lib/database.types.ts` after migration + seed apply. Commit the file.

#### 3. Typed SSR client

**File**: `src/lib/supabase.ts`

**Intent**: Wire `Database` generic into `createServerClient` without changing runtime behavior.

**Contract**: Import `Database` from `./database.types` and pass as generic to `createServerClient<Database>(...)`. Return type remains nullable when secrets missing.

#### 4. README database section

**File**: `README.md`

**Intent**: Replace stale "auth-only" database note; document migration and seed workflow.

**Contract**:

- Remove or replace line ~131 ("No database tables or migrations are required…").
- Add subsection: start local Supabase, `npx supabase db reset`, seed user credentials, optional `npx supabase gen types typescript --local` after schema changes.
- Note that remote/production migrations are applied separately (`supabase db push` or dashboard) and seed is local-only.

#### 5. Change metadata

**File**: `context/changes/paint-log-schema-rls/change.md`

**Intent**: Mark change as planned.

**Contract**: `status: planned`, `updated: 2026-06-08`.

### Success Criteria

#### Automated Verification

- `supabase db reset` applies migration and seed without errors
- `npm run lint` passes (including new `database.types.ts`)
- `npm run build` passes with `SUPABASE_URL` and `SUPABASE_KEY` set

#### Manual Verification

- Supabase Studio shows seed entry, paints, steps, and assignment after reset
- Seed user can sign in locally via existing auth forms

**Implementation Note**: Pause for human confirmation after seed sign-in works before Phase 3.

---

## Phase 3: RLS verification and security review

### Overview

Prove owner-only isolation works and run Supabase advisors before calling F-01 done.

### Changes Required

#### 1. RLS smoke verification

**File**: (no code change — manual SQL or authenticated client calls)

**Intent**: Confirm FR-002 holds at the data layer, not just middleware.

**Contract**: With two local users (seed user + a second account created via sign-up):

- User A sees only their entries/paints/steps/assignments via `supabase.from('entries').select('*')` with A's session.
- User B cannot SELECT, UPDATE, or DELETE user A's rows (empty result or permission error — not A's data).
- User B cannot INSERT a child row pointing at A's `entry_id`.
- Junction cross-entry paint assignment still blocked by trigger even if RLS were misconfigured (defense in depth).

Document steps in plan Progress manual items; optional short comment in README pointing to verification approach.

#### 2. Supabase advisors

**File**: (CLI output only)

**Intent**: Catch missing RLS, policy gaps, or security warnings before merge.

**Contract**: Run `npx supabase db advisors --local` (or MCP `get_advisors` if CLI version insufficient). Resolve any ERROR-level findings on new tables.

### Success Criteria

#### Automated Verification

- `npx supabase db advisors --local` reports no ERROR-level issues on new schema (or documented exceptions with fix plan)
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification

- RLS smoke tests pass for two-user isolation (see Phase 3 contract)
- `supabase migration list --local` shows single applied migration

---

## Testing Strategy

### Unit Tests

None planned (no test suite in repo).

### Integration Tests

None planned for F-01.

### Manual Testing Steps

1. `npx supabase start` (if not running) → `npx supabase db reset`.
2. Confirm four tables exist in Studio with RLS enabled.
3. Sign in as seed user → confirm auth works (no entry UI yet — Studio inspection is sufficient for F-01).
4. Create second user via sign-up; confirm in Studio/SQL that users cannot see each other's rows when querying as `authenticated`.
5. Attempt invalid junction insert (step from entry A + paint from entry B) → trigger rejects.
6. Run advisors, lint, build.

## Performance Considerations

Subquery-based RLS on child tables adds a small per-row cost — acceptable for MVP data volumes (single-user + dozen entries). `user_id` index on `entries` supports list queries; child `entry_id` indexes support joins inside policies.

## Migration Notes

- **Local**: `supabase db reset` is destructive — fine for dev.
- **Remote**: Apply with `supabase db push` or link project and push migrations before S-02 ships against cloud. Migrations are forward-only; `wrangler rollback` does not revert DB (`context/foundation/infrastructure.md`).
- **Seed**: Never apply `auth.users` inserts from `seed.sql` to production.
- **Types**: Regenerate after any schema change: `npx supabase gen types typescript --local > src/lib/database.types.ts`.

## References

- Roadmap F-01: `context/foundation/roadmap.md`
- PRD FR-002, FR-003–FR-008, Business Logic: `context/foundation/prd.md`
- Shape notes (status, origin, invariants): `context/foundation/shape-notes.md`
- S-01 auth shell (FR-002 split): `context/archive/2026-06-01-account-auth-shell/plan.md`
- Supabase skill security checklist: `.agents/skills/supabase/SKILL.md`
- GitHub issue [#2](https://github.com/mraubo/paint-ledger/issues/2)
- Existing client: `src/lib/supabase.ts`
- Middleware: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Postgres migration (schema, RLS, trigger)

#### Automated

- [x] 1.1 `supabase migration new paint_log_schema` creates migration file — ed9b7fe
- [x] 1.2 `supabase db reset` applies migration without SQL errors — ed9b7fe
- [x] 1.3 `supabase migration list --local` shows applied migration — ed9b7fe

#### Manual

- [x] 1.4 Tables, FKs, and indexes match contract in local psql/Studio — ed9b7fe
- [x] 1.5 Cross-entry junction insert rejected by trigger — ed9b7fe

### Phase 2: Seed fixture, TypeScript types, and documentation

#### Automated

- [ ] 2.1 `supabase db reset` applies migration and seed without errors
- [ ] 2.2 `npm run lint` passes
- [ ] 2.3 `npm run build` passes

#### Manual

- [ ] 2.4 Studio shows seed fixture; seed user can sign in locally

### Phase 3: RLS verification and security review

#### Automated

- [ ] 3.1 `npx supabase db advisors --local` — no ERROR-level issues on new schema
- [ ] 3.2 `npm run lint` passes
- [ ] 3.3 `npm run build` passes

#### Manual

- [ ] 3.4 Two-user RLS isolation smoke tests pass
- [ ] 3.5 `supabase migration list --local` confirms single applied migration
