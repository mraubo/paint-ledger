# Test Plan Refresh (S-07 Entry Delete) — Plan Brief

> Full plan: `context/changes/test-plan-refresh-2026-06-12/plan.md`
> Research: `context/changes/test-plan-refresh-2026-06-12/research.md`

## What & Why

S-07 entry delete shipped (FR-013) but the foundation test plan has no delete cascade risk, no delete API cookbook, a partial integration test (missing `step_paint_assignments` assertion), and Phase 4 CI still not started. This refresh closes those gaps so contributors know how to test delete and CI enforces the Supabase integration floor.

## Starting Point

Rollout Phases 1–3 are complete with Vitest, RLS isolation, HTTP auth/IDOR tests, and entry workflow integration. S-07 added `deleteEntryWithPhotos`, delete API route, HTTP delete IDOR tests, and a cascade test that checks `entries`, `entry_paints`, and `steps` but not `step_paint_assignments`. CI runs lint + build only.

## Desired End State

`test-plan.md` documents Risk #8 and delete cookbook patterns. The cascade integration test proves junction rows are removed. GitHub Actions runs `npm run test:integration` (Supabase-only) on every PR. AGENTS.md explains CI vs local `npm test`. Phase 4 is marked complete.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Phase 4 CI scope | Required Supabase-only gate | Cheapest signal for RLS + workflow + delete without dev-server complexity | Plan |
| Storage orphan risk | Omit from §2 | Separate failure mode; S-07 explicitly scoped out storage assertions | Plan |
| HTTP owner-delete test | Helper test only | Route delegates to `deleteEntryWithPhotos`; direct call is sufficient | Research / Plan |
| Phase 4 completion | Mark complete when CI lands | Phase 4 goal is quality-gate wiring | Plan |
| CI test filter | `test:integration` npm script with Vitest exclude | Reusable locally and in CI; no directory restructure | Plan |
| Junction assertion | Query by `step_id` | Matches existing `assignmentsForStep` helper pattern | Plan |
| Contributor docs | Update AGENTS.md | Agents need CI vs local test distinction | Plan |

## Scope

**In scope:**

- Add Risk #8 + response guidance to `test-plan.md` §2
- Extend §6.4 delete API cookbook and §6.6 S-07 note
- Close `step_paint_assignments` gap in delete cascade test
- Add `test:integration` script and CI workflow step
- Update AGENTS.md for CI vs local testing
- Mark §3 Phase 4 complete

**Out of scope:**

- Storage orphan risk in risk map
- HTTP owner-delete happy-path test
- Full `npm test` (including HTTP) in CI
- Delete implementation or schema changes

## Architecture / Approach

Three phases: (1) extend the existing delete cascade test with a junction row + post-delete query, (2) update the foundation guide, (3) wire CI using `supabase/setup-cli` → `start` → `db reset` → export local anon env → `npm run test:integration`. HTTP tests remain a local-only gate documented in AGENTS.md and §6.4.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Close Risk #8 test gap | Junction row in fixture + `step_paint_assignments` assertion | Fixture accidentally uses seed `ENTRY_A` data |
| 2. Refresh test-plan.md | Risk #8, delete cookbook, gates, freshness | §2 Source column drifts into file anchors |
| 3. Wire Phase 4 CI | `test:integration` script, CI job, AGENTS.md update | CI exports service_role instead of anon key |

**Prerequisites:** Local Supabase CLI; Node per `.nvmrc`; existing Vitest harness from Phases 1–3.

**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- `supabase status -o env` override flag names may differ by CLI version — verify in CI first run.
- CI job runtime increases with `supabase start`; acceptable for now.
- HTTP IDOR tests are not gated in CI until a follow-up change.

## Success Criteria (Summary)

- Owner delete integration test asserts zero `step_paint_assignments` rows by `step_id`.
- `test-plan.md` documents Risk #8 and delete API testing pattern.
- PR CI runs `npm run test:integration` and passes without a dev server.
