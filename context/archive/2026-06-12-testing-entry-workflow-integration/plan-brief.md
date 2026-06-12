# Entry Workflow Integration Tests — Plan Brief

> Full plan: `context/changes/testing-entry-workflow-integration/plan.md`
> Research: `context/changes/testing-entry-workflow-integration/research.md`

## What & Why

Paint Ledger's entry workflow has three failure modes the test plan prioritizes: steps keeping paints not on the entry palette, photos that upload but don't display on recall, and detail views that omit recipe data. Phase 3 adds integration tests that prove protection at the DB, Storage, and loader layers — not UI checkboxes or HTML snapshots.

## Starting Point

Phases 1–2 shipped RLS isolation and HTTP auth/IDOR tests. The app already enforces paint invariants via RPC + trigger, stores photos in a private `entry-photos` bucket, and composes detail pages through `src/lib/*-page.ts` loaders. No workflow-specific integration tests exist yet; seed fixture `ENTRY_A` has paints and steps but no photos.

## Desired End State

`tests/integration/entry-workflow-integration.test.ts` runs green with only local Supabase, covering paint invariant DB assertions, real Storage upload + signed URL fetch, and loader completeness against seed data. `context/foundation/test-plan.md` documents the pattern for future contributors.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Test layer | Supabase client integration | Cheapest signal per test-plan §2; no dev server | Research |
| Photo upload in tests | `supabase.storage.upload` + loader recall | Real Storage without HTTP multipart | Research |
| Cross-entry paint cases | Ephemeral second entry in `beforeAll` | Same-user isolation without cross-user noise | Research |
| Detail assertions | Import `src/lib` loaders | Same contract as `[id].astro`; avoids HTML snapshots | Research |
| HTTP multipart / e2e | Out of scope | Phase 2 HTTP covers auth; e2e deferred in §6.3 | Research / Plan |
| Test file layout | Single `entry-workflow-integration.test.ts` | Groups related workflow risks; matches Phase 2 style | Plan |

## Scope

**In scope:** `test-image.ts` helper; paint invariant (#2), photo recall (#4), loader completeness (#5) integration tests; test-plan §6.6 Phase 3 note; minimal AGENTS.md prerequisite clarification.

**Out of scope:** Dev server tests, Playwright, Storage mocks, CI wiring (Phase 4), schema/handler changes, HTML snapshots.

## Architecture / Approach

```
Vitest → createTestClient + signInAs
         ├─ Risk #2: RPC / mutations → query step_paint_assignments
         ├─ Risk #4: storage.upload → DB path → createSignedPhotoUrl → fetch
         └─ Risk #5: loadEntryForEdit / loadEntryPaints / loadEntrySteps → assert shapes
```

Oracle data comes from `supabase/seed.sql` and `tests/helpers/seed-fixtures.ts`, not from re-implementing app validation logic.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Paint invariant | Helper + Risk #2 DB tests | Silent-drop false positives if only checking `{ ok: true }` |
| 2. Photo recall | Risk #4 Storage + signed URL + fetch | Storage bucket not cleared by `db reset` |
| 3. Loader completeness | Risk #5 structured loader assertions | Confusing list vs detail loaders |
| 4. Cookbook docs | test-plan §6.6 + AGENTS note | Doc drift if anti-patterns not recorded |

**Prerequisites:** Local Supabase (`npx supabase start && db reset`), `.env` with anon key, Node per `.nvmrc`.

**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Full `npm test` still includes HTTP auth tests that need `npm run dev` — workflow file alone does not.
- Storage objects may persist across runs; tests use upsert/cleanup to stay idempotent.
- Invalid paint IDs produce empty junction rows, not user-visible errors — tests document this behavior.

## Success Criteria (Summary)

- Forged/cross-entry paint IDs never appear in `step_paint_assignments` for the target step.
- Owner-uploaded photos resolve to fetchable signed URLs; user B cannot access them.
- Detail loaders return complete seed recipe data (and photo URLs after upload setup).
