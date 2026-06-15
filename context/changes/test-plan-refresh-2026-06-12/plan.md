# Test Plan Refresh (S-07 Entry Delete) Implementation Plan

## Overview

Refresh `context/foundation/test-plan.md` after S-07 entry delete shipped: add Risk #8 (delete cascade completeness), extend the API cookbook for the delete endpoint, close the `step_paint_assignments` gap in the existing cascade integration test, and complete rollout Phase 4 by wiring a required Supabase-only `npm run test:integration` gate in GitHub Actions.

## Current State Analysis

Phases 1–3 of the test rollout are complete. S-07 added `deleteEntryWithPhotos`, the `POST /api/entries/{id}/delete` handler, HTTP IDOR tests for delete, and a partial owner-cascade test. The foundation guide still lacks delete-specific risk documentation and Phase 4 CI wiring.

### Key Discoveries:

- Schema enforces `ON DELETE CASCADE` from `entries` → `entry_paints` / `steps`; `step_paint_assignments` cascades indirectly via both FKs (`supabase/migrations/20260608103251_paint_log_schema.sql:29,42,52-57`).
- `deleteEntryWithPhotos` deletes only the `entries` row after best-effort storage cleanup — child DB rows rely on CASCADE (`src/lib/entry-delete.ts:48-64`).
- Delete cascade test creates `entry_paints` + `steps` but no `step_paint_assignments` and does not assert that table (`tests/integration/entry-workflow-integration.test.ts:568-647`).
- HTTP delete tests cover Risk #6 (IDOR) only; no owner happy-path HTTP test is required for this refresh (`tests/integration/auth-route-protection.test.ts:76-79,162-179`).
- CI runs lint + build only; no test step (`.github/workflows/ci.yml:18-24`).
- Integration helpers reject non-localhost Supabase/APP URLs — CI must spin up local Supabase, not use remote secrets for tests (`tests/helpers/supabase-client.ts:7-23`).

## Desired End State

After this plan:

1. `context/foundation/test-plan.md` documents Risk #8 with response guidance, delete API cookbook pattern in §6.4, S-07 note in §6.6, updated §5 quality gates, and §3 Phase 4 marked `complete`.
2. `tests/integration/entry-workflow-integration.test.ts` proves owner delete removes `step_paint_assignments` rows (not only `entries`, `entry_paints`, `steps`).
3. GitHub Actions runs `npm run test:integration` on every PR after `supabase start && supabase db reset`, excluding the HTTP suite.
4. `AGENTS.md` documents that CI runs Supabase-only integration tests while local `npm test` includes HTTP tests (requires dev server).

### Verification:

- `npm run test:integration` passes locally with Supabase running (no dev server).
- `npm test` passes locally with Supabase + dev server.
- `npm run lint` passes.
- PR CI job includes the integration test step and is green.

## What We're NOT Doing

- Adding a separate Risk #9 for storage orphan objects (best-effort storage cleanup failures).
- Adding an HTTP owner-delete happy-path test (`httpPostForm` + `deleted=` redirect).
- Wiring the full `npm test` suite (including `auth-route-protection.test.ts`) in CI — HTTP tests remain local/manual until a follow-up.
- Splitting test files into separate directories.
- Changing delete implementation or schema.

## Implementation Approach

Work in three incremental phases: close the concrete test gap first (fast feedback), then update the foundation guide (documents the shipped behavior and cookbook), then wire CI and contributor docs. Use `vitest run --exclude` via a new `test:integration` npm script rather than restructuring test directories. Export local Supabase env vars in CI via `supabase status -o env` with anon key mapping so tests use the same localhost guardrails as local development.

## Phase 1: Close Risk #8 Test Gap

### Overview

Extend the existing delete cascade integration test so the fixture includes a `step_paint_assignments` row and post-delete assertions query that table by `step_id`.

### Changes Required:

#### 1. Delete cascade fixture and assertions

**File**: `tests/integration/entry-workflow-integration.test.ts`

**Intent**: Prove Risk #8 protection — after owner delete, junction rows do not survive even though `step_paint_assignments` has no direct `entry_id` FK.

**Contract**: In the `describe("entry delete cascade")` block (`~568-647`):

- Capture ephemeral `entry_paint` and `step` IDs from `beforeAll` inserts (`.select("id").single()` on paint/step creation).
- After both rows exist, insert one `step_paint_assignments` row linking `step_id` + `entry_paint_id`.
- In the test body, after `deleteEntryWithPhotos` succeeds, add a query: `step_paint_assignments` filtered by the ephemeral `step_id` must return length 0.
- Reuse the existing `assignmentsForStep` helper at file top if convenient.

No HTTP layer changes; direct helper call remains the cheapest integration proof (route delegates to same helper).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Supabase-only integration tests pass: `npx supabase start && npx supabase db reset && npx vitest run tests/integration/entry-workflow-integration.test.ts -t "entry delete cascade"`

#### Manual Verification:

- Confirm the new assignment insert uses paints and steps from the same ephemeral entry (not seed `ENTRY_A` fixtures).
- Confirm test still cleans up by deleting the entry (ephemeral entry is destroyed; no orphan rows).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Refresh test-plan.md

### Overview

Update the foundation test plan with Risk #8, response guidance, delete cookbook pattern, S-07 phase notes, quality-gate status, and freshness ledger. Do not add file:line anchors to §2 Source column (per test-plan principle #3).

### Changes Required:

#### 1. Risk map and response guidance

**File**: `context/foundation/test-plan.md`

**Intent**: Document the delete cascade failure scenario and how future tests should prove protection.

**Contract**: §2 Risk Map — add row #8:

| # | Risk | Impact | Likelihood | Source |
|---|------|--------|------------|--------|
| 8 | After owner deletes an entry, child paints, steps, or step_paint_assignments still exist in DB | High | Medium | PRD FR-013; roadmap S-07 archive risk note; refresh interview (cascade gaps worry); hot-spot dir `src/lib/` |

§2 Risk Response Guidance — add row for #8:

| Risk | What would prove protection | Must challenge | Context needed | Likely cheapest layer | Anti-pattern |
|------|----------------------------|----------------|----------------|----------------------|--------------|
| #8 | After owner delete, zero rows in `entry_paints`, `steps`, and `step_paint_assignments` for the deleted entry | "CASCADE exists so no test needed" | FK CASCADE chain; `deleteEntryWithPhotos` single-row delete; junction has no direct `entry_id` | Integration (extend workflow test) | Asserting only `entries` row is null; skipping junction table |

#### 2. API cookbook — delete endpoint

**File**: `context/foundation/test-plan.md`

**Intent**: Give contributors a copy-paste pattern for testing new delete-style endpoints and the shipped entry delete route.

**Contract**: §6.4 — append delete subsection after existing entry API pattern:

- Route: `POST /api/entries/{id}/delete`
- Unauthenticated: `302`/`303` redirect to `/auth/signin` (extend `auth-route-protection.test.ts`)
- Cross-user: redirect denial with `error=` query, never `deleted=` success (Risk #6)
- Owner success at integration layer: call `deleteEntryWithPhotos` directly; assert child tables empty including `step_paint_assignments` by `step_id`
- Redirect contract: success uses `deleted=` query param with entry title; denial uses `error=`
- `POST` requires `Origin: http://localhost:4321` when using HTTP helpers

#### 3. Phase notes, gates, freshness

**File**: `context/foundation/test-plan.md`

**Intent**: Reflect what S-07 shipped and that Phase 4 CI gate is landing in this change.

**Contract**:

- §6.6 — add S-07 note: delete cascade test in `entry-workflow-integration.test.ts`; HTTP delete IDOR in `auth-route-protection.test.ts`; Risks #6 and #8.
- §5 Quality Gates — update `unit + integration` row to `required` (no longer "required after §3 Phase 4").
- §8 Freshness Ledger — update strategy/stack review dates to implementation date; note refresh trigger (S-07 entry delete).
- §3 Phase 4 — set Status to `complete` and Change folder to `test-plan-refresh-2026-06-12` (finalized in Phase 3 after CI lands).

#### 4. Change metadata

**File**: `context/changes/test-plan-refresh-2026-06-12/change.md`

**Intent**: Record that planning is complete and implementation is underway.

**Contract**: `status: implementing` (or leave `planned` until Phase 3 starts — update when implement begins).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint` (markdown included in format scope if touched)

#### Manual Verification:

- §2 Risk #8 Source column cites evidence only (no file:line anchors).
- §6.4 delete pattern aligns with `src/pages/api/entries/[id]/delete.ts` redirect contract.
- §6.6 S-07 note distinguishes Risk #6 (HTTP IDOR) from Risk #8 (owner cascade).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Wire Phase 4 CI + Contributor Docs

### Overview

Add a Supabase-only integration test script, extend GitHub Actions to run it against a local Supabase stack, update AGENTS.md, and finalize test-plan Phase 4 status.

### Changes Required:

#### 1. Integration test npm script

**File**: `package.json`

**Intent**: Give CI and contributors a single command for the Supabase-only subset (excludes HTTP tests that need `npm run dev`).

**Contract**: Add script:

```
"test:integration": "vitest run --exclude tests/integration/auth-route-protection.test.ts"
```

Keep existing `"test": "vitest run"` unchanged for local full suite.

#### 2. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Enforce integration tests on every PR without requiring an Astro dev server.

**Contract**: After existing lint step (or as a parallel job — prefer same job for simplicity unless runtime is problematic), add:

1. `supabase/setup-cli@v2` (version from lockfile or `latest`)
2. `supabase start` (starts local stack with migrations)
3. `supabase db reset` (applies migrations + seed)
4. Export env vars for Vitest — use `supabase status -o env` with anon key override:

   ```
   supabase status -o env --override-name api.url=SUPABASE_URL --override-name anon.key=SUPABASE_KEY >> $GITHUB_ENV
   ```

   (Adjust override names to match `supabase status` output if CLI version differs.)

5. `npm run test:integration`

Do **not** start `npm run dev`. Existing build step may keep remote `SUPABASE_URL`/`SUPABASE_KEY` secrets for `astro:env` build — test step uses exported local values only.

#### 3. Contributor documentation

**File**: `AGENTS.md`

**Intent**: Document the CI vs local test split so agents and contributors run the right commands.

**Contract**: Update **Tests** paragraph (~line 29):

- CI runs `npm run test:integration` (Supabase only; no dev server).
- Local full suite: `npm test` requires Supabase **and** dev server for HTTP tests.
- Reference `context/foundation/test-plan.md` §6.2 vs §6.4 prerequisites.

#### 4. Finalize Phase 4 in test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Mark rollout Phase 4 complete once CI gate is wired.

**Contract**: §3 Phase 4 row — Status `complete`, Change folder `test-plan-refresh-2026-06-12`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build` (with Supabase secrets if required locally)
- Local Supabase integration suite passes: `npx supabase start && npx supabase db reset && npm run test:integration`
- CI workflow YAML is valid (no syntax errors; verify via PR or `gh workflow view` after push)

#### Manual Verification:

- Confirm CI job exports anon key (not service_role) so RLS tests remain meaningful.
- Confirm `test:integration` excludes only `auth-route-protection.test.ts` (2 other integration files still run).
- Skim AGENTS.md — CI vs local distinction is clear in one reading.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None — this refresh extends integration coverage and infrastructure only.

### Integration Tests:

- **Risk #8 cascade**: ephemeral entry with paint + step + assignment → `deleteEntryWithPhotos` → zero rows in all child tables including `step_paint_assignments` by `step_id`.
- **Regression**: existing RLS and workflow tests must remain green under `test:integration`.

### Manual Testing Steps:

1. `npx supabase start && npx supabase db reset && npm run test:integration` — all green without dev server.
2. `npm run dev` (second terminal) + `npm test` — full suite including HTTP delete IDOR tests.
3. Open a PR or push branch — verify CI runs `test:integration` and passes.

## Performance Considerations

`supabase start` in CI adds ~1–3 minutes per job. Acceptable for Phase 4; cache Docker layers if runtime becomes painful later. `fileParallelism: false` in `vitest.config.ts` keeps integration tests sequential — fine for current 3-file suite.

## Migration Notes

No schema or data migration. CI uses fresh `db reset` per run — no production impact.

## References

- Research: `context/changes/test-plan-refresh-2026-06-12/research.md`
- Change brief: `context/changes/test-plan-refresh-2026-06-12/change.md`
- S-07 archive: `context/archive/2026-06-12-entry-delete/plan.md`
- Foundation guide: `context/foundation/test-plan.md`
- Delete handler: `src/pages/api/entries/[id]/delete.ts`
- Delete lib: `src/lib/entry-delete.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Close Risk #8 Test Gap

#### Automated

- [x] 1.1 Linting passes: `npm run lint`
- [x] 1.2 Supabase-only delete cascade test passes: `npx supabase start && npx supabase db reset && npx vitest run tests/integration/entry-workflow-integration.test.ts -t "entry delete cascade"`

#### Manual

- [x] 1.3 Ephemeral fixture uses same-entry paint/step/assignment; no seed fixture pollution

### Phase 2: Refresh test-plan.md

#### Automated

- [ ] 2.1 Linting passes: `npm run lint`

#### Manual

- [ ] 2.2 §2 Risk #8 and response guidance added without file anchors
- [ ] 2.3 §6.4 delete cookbook and §6.6 S-07 note match shipped behavior

### Phase 3: Wire Phase 4 CI + Contributor Docs

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`
- [ ] 3.3 Local integration suite passes: `npx supabase start && npx supabase db reset && npm run test:integration`

#### Manual

- [ ] 3.4 CI exports anon key; `test:integration` excludes HTTP suite only
- [ ] 3.5 AGENTS.md documents CI vs local full suite
- [ ] 3.6 §3 Phase 4 marked `complete` with change folder `test-plan-refresh-2026-06-12`
