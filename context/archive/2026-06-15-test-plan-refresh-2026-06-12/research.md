---
date: 2026-06-15T09:34:58+02:00
researcher: Cursor Agent
git_commit: c2821f8588397f3e970946bb624486320df0dd9d
branch: entry-delete
repository: mraubo/paint-ledger
topic: "Test plan refresh — S-07 entry delete (Risk #8 cascade), coverage gaps, Phase 4 CI"
tags: [research, codebase, test-plan, entry-delete, cascade, ci]
status: complete
last_updated: 2026-06-15
last_updated_by: Cursor Agent
---

# Research: Test plan refresh — S-07 entry delete

**Date**: 2026-06-15T09:34:58+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: c2821f8588397f3e970946bb624486320df0dd9d  
**Branch**: entry-delete  
**Repository**: mraubo/paint-ledger

## Research Question

Ground test-plan refresh for S-07 entry-delete (FR-013):

1. Risk #8 — after owner deletes an entry, do child paints, steps, or `step_paint_assignments` still exist?
2. Do existing S-07 tests fully cover #8?
3. What is the Phase 4 gap (CI `npm test`)?

## Summary

**Risk #8 is real but narrow.** Schema enforces `ON DELETE CASCADE` from `entries` to `entry_paints` and `steps`; `step_paint_assignments` cascades indirectly via both `steps` and `entry_paints` FKs. The app deletes only the `entries` row (after best-effort storage cleanup) and relies on CASCADE for all child DB rows — no app-layer gap for surviving child rows under normal FK behavior.

**Test coverage is partial.** `tests/integration/entry-workflow-integration.test.ts` proves owner delete removes `entries`, `entry_paints`, and `steps` rows, but the fixture never creates a `step_paint_assignments` row and the test never asserts that table is empty. That is the concrete #8 gap. HTTP delete IDOR tests in `auth-route-protection.test.ts` cover Risk #6 (cross-user denial), not owner cascade completeness.

**Phase 4 is still open.** `.github/workflows/ci.yml` runs lint + build only; `npm test` is local-only and requires local Supabase (`tests/helpers/supabase-client.ts` enforces localhost). HTTP tests additionally require `npm run dev` on port 4321 (`tests/helpers/http-client.ts`). CI already has `SUPABASE_URL` / `SUPABASE_KEY` secrets for build — wiring tests needs `supabase start` + `db reset` in the job and either a background dev server or a documented split between Supabase-only and HTTP suites.

**Response-guidance verification:** The anti-pattern "assert only `entries` row is null" is partially avoided today (paints + steps are checked) but incomplete without `step_paint_assignments`. The challenge "CASCADE exists so no test needed" is **half-true** — CASCADE is the mechanism, but an integration test still proves the app calls delete on the right path and that the live schema matches expectations.

## Detailed Findings

### Schema cascade (DB layer)

Migration `supabase/migrations/20260608103251_paint_log_schema.sql` defines:

| Child table | FK | Cascade |
|-------------|-----|---------|
| `entry_paints` | `entry_id → entries(id)` | line 29 |
| `steps` | `entry_id → entries(id)` | line 42 |
| `step_paint_assignments` | `step_id → steps(id)` | line 53 |
| `step_paint_assignments` | `entry_paint_id → entry_paints(id)` | line 54 |

`step_paint_assignments` has **no direct FK to `entries`**. On entry delete, junction rows are removed when either parent cascades — both paths fire.

No later migration alters these FKs.

### App delete path

`src/lib/entry-delete.ts` (`deleteEntryWithPhotos`):

1. Load entry scoped by `id` + `user_id` (lines 11–24)
2. Load `steps.storage_path` for photo cleanup (lines 26–38)
3. Best-effort `deleteEntryPhoto()` for each path — warns on failure, continues (lines 40–46)
4. Single `entries` DELETE scoped by `id` + `user_id` (lines 48–64)

Child DB tables are **not** explicitly deleted; CASCADE handles them.

`src/pages/api/entries/[id]/delete.ts` delegates entirely to `deleteEntryWithPhotos` (lines 23–28) and redirects with `deleted=` on success (line 28).

**Storage note (out of #8 scope but adjacent):** Storage cleanup is best-effort and non-transactional. Failed `storage.remove()` calls do not block DB delete (```40:46:src/lib/entry-delete.ts```). Orphaned storage objects are a separate failure mode from surviving child DB rows.

### Existing test coverage

#### Owner cascade — `entry-workflow-integration.test.ts`

```568:647:tests/integration/entry-workflow-integration.test.ts
describe("entry delete cascade", () => {
  // beforeAll: creates ephemeral entry + entry_paint + step (no assignment)
  it("deleteEntryWithPhotos removes entry and cascades child rows", async () => {
    // asserts: entries null, entry_paints length 0, steps length 0
    // does NOT query step_paint_assignments
  });
});
```

**Gap:** Fixture omits `step_paint_assignments` insert; assertion omits that table. To fully prove #8, create at least one assignment linking the ephemeral step and paint, then assert zero rows for that `step_id` or `entry_paint_id` after delete.

#### Cross-user denial — `auth-route-protection.test.ts`

```76:79:tests/integration/auth-route-protection.test.ts
it("unauthenticated POST /api/entries/{id}/delete redirects to sign-in", ...)
```

```162:179:tests/integration/auth-route-protection.test.ts
it("user B POST /api/entries/{ENTRY_A.id}/delete cannot delete user A entry", ...)
```

Covers Risk #6 (IDOR + redirect contract). Verifies `ENTRY_A` still exists after user B attempt — correct for #6, not #8.

#### RLS isolation — `rls-isolation.test.ts`

```59:82:tests/integration/rls-isolation.test.ts
it("user B cannot update or delete user A's entry", ...)
```

Proves user B cannot delete via direct Supabase client — Risk #1, not owner cascade.

#### No HTTP owner-delete success test

No integration test POSTs to `/api/entries/{id}/delete` as owner and asserts `deleted=` redirect + cascade. Current #8 proof is via direct `deleteEntryWithPhotos()` call only. Acceptable at integration layer (helper is what the route calls), but §6 cookbook should document both patterns.

### Phase 4 — CI quality gate

| Artifact | Current state |
|----------|---------------|
| `.github/workflows/ci.yml` | `npm ci`, `astro sync`, `lint`, `build` — **no `npm test`** (lines 18–24) |
| `package.json` | `"test": "vitest run"` (line 13) |
| `vitest.config.ts` | Loads `SUPABASE_URL`, `SUPABASE_KEY`, `APP_URL` from `.env` (lines 19–23) |
| `tests/helpers/supabase-client.ts` | Rejects non-localhost Supabase URLs (lines 7–23) |
| `tests/helpers/http-client.ts` | Requires local dev server at `APP_URL` (lines 1–3, 21–23) |
| `context/foundation/test-plan.md` §3 Phase 4 | Status `not started` — goal: `npm test` in CI |

Prior rollout phases explicitly deferred CI wiring to Phase 4 (`context/archive/2026-06-11-testing-runner-bootstrap-rls-floor/plan.md`, `context/archive/2026-06-11-testing-auth-and-route-protection/plan.md`).

**CI wiring options (cheapest first):**

1. **Supabase-only job** — `supabase/setup-cli` + `supabase start` + `db reset` + `npm test` with a Vitest filter excluding `auth-route-protection.test.ts`. Proves RLS + workflow + delete cascade without dev server. Does not gate HTTP/IDOR tests.
2. **Full suite job** — Above plus background `npm run dev` (or `astro dev`) before `npm test`. Matches local contributor workflow; higher CI complexity.
3. **Split jobs** — `test:integration` (Supabase) required; `test:http` (dev server) optional or parallel. Aligns with test-plan §6.2 vs §6.4 prerequisites.

CI already sets `SUPABASE_URL` and `SUPABASE_KEY` for build — reuse for test job pointed at local Supabase (`http://127.0.0.1:54321` + local anon key from `supabase status`).

### test-plan.md gaps (refresh targets)

| Section | Gap |
|---------|-----|
| §2 Risk map | No row for FR-013 / delete cascade (#8 proposed) |
| §2 Risk Response Guidance | No delete-specific row |
| §6.4 API cookbook | No `POST /api/entries/{id}/delete` pattern (`deleted=` success, `error=` denial) |
| §6.6 Phase notes | No S-07 / delete coverage note |
| §3 Phase 4 | Still `not started` |

## Code References

- `supabase/migrations/20260608103251_paint_log_schema.sql:29` — `entry_paints.entry_id` ON DELETE CASCADE
- `supabase/migrations/20260608103251_paint_log_schema.sql:42` — `steps.entry_id` ON DELETE CASCADE
- `supabase/migrations/20260608103251_paint_log_schema.sql:52-57` — `step_paint_assignments` dual FK CASCADE
- `src/lib/entry-delete.ts:6-65` — `deleteEntryWithPhotos` (storage then DB delete)
- `src/pages/api/entries/[id]/delete.ts:6-29` — POST handler, redirect contract
- `tests/integration/entry-workflow-integration.test.ts:568-647` — owner delete cascade test (partial #8)
- `tests/integration/auth-route-protection.test.ts:76-79,162-179` — delete auth/IDOR (Risk #6)
- `.github/workflows/ci.yml:18-24` — no test step
- `context/foundation/test-plan.md:73` — Phase 4 not started

## Architecture Insights

- **Delete ordering is intentional:** Storage cleanup runs while entry/step rows exist (required by `entry_photos_delete_own` RLS). DB delete is last.
- **Redirect-based API contract:** Success uses `deleted=` query param sourced from pre-delete row title (not client input) — same family as Risk #6 patterns in §6.4.
- **Integration-first test culture:** Phase 3 explicitly asserts `step_paint_assignments` for paint invariant (§6.6) but the delete cascade test does not mirror that rigor — inconsistency worth fixing in refresh implementation.
- **Local-only test guards:** Both Supabase and HTTP helpers reject non-localhost URLs — CI must spin up local stacks, not point at production Supabase.

## Historical Context (from prior changes)

- `context/archive/2026-06-12-entry-delete/plan.md` — S-07 shipped storage-before-DB delete, HTTP IDOR tests, and `deleteEntryWithPhotos` cascade test; explicitly scoped out storage object assertions in CI.
- `context/archive/2026-06-12-entry-delete/reviews/impl-review.md` — 47 tests passing at archive time.
- `context/archive/2026-06-12-testing-entry-workflow-integration/plan.md` — Phase 3 deferred CI to Phase 4; workflow tests need Supabase only.
- `context/archive/2026-06-11-testing-auth-and-route-protection/research.md` — documented CI still lint+build only.

## Risk #8 — Verified Response Guidance

| Field | Research-grounded value |
|-------|-------------------------|
| What would prove protection | After owner delete, zero rows in `entry_paints`, `steps`, and `step_paint_assignments` for the deleted `entry_id` |
| Must challenge | "CASCADE exists so no test needed" — schema is correct today but untested assignments path; also challenge "helper test equals API test" if only direct helper call exists |
| Context needed | FK CASCADE chain in `20260608103251_paint_log_schema.sql`; `deleteEntryWithPhotos` single-row delete; junction table has no direct `entry_id` |
| Likely cheapest layer | Extend `entry-workflow-integration.test.ts` — add assignment to fixture + post-delete query on `step_paint_assignments` |
| Anti-pattern to avoid | Asserting only `entries` row is null; skipping junction table because CASCADE "should" handle it |

## Related Research

- `context/archive/2026-06-12-entry-delete/plan.md` — S-07 implementation decisions
- `context/archive/2026-06-11-testing-auth-and-route-protection/research.md` — HTTP test + CI deferral
- `context/archive/2026-06-12-testing-entry-workflow-integration/research.md` — Phase 3 integration patterns

## Open Questions

1. **Phase 4 scope:** Full `npm test` (Supabase + dev server) in one CI job, or required Supabase-only gate with HTTP tests documented as manual/local until a follow-up?
2. **Storage orphan risk:** Should refresh add a separate low-likelihood risk for best-effort storage cleanup failures, or keep it out of §2 per S-07 "no storage assertions in CI" decision?
3. **HTTP owner-delete test:** Is extending the workflow test sufficient, or should refresh add one happy-path `httpPostForm` delete test for §6.4 cookbook completeness?

## Recommended refresh plan scope

1. **§2** — Add Risk #8 + response guidance (evidence: FR-013, S-07 archive, refresh interview, hot-spot `src/lib/`).
2. **§6** — Extend §6.4 with delete endpoint pattern; add §6.6 note for S-07 coverage.
3. **Tests** — Add `step_paint_assignments` to delete cascade fixture + assertion (minimal #8 close).
4. **§3 Phase 4** — Wire `npm test` in CI (at minimum Supabase-only subset; document HTTP prerequisite if full suite deferred).
