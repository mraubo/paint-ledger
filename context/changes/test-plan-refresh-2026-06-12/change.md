---
change_id: test-plan-refresh-2026-06-12
title: Test plan refresh for S-07 entry delete
status: implementing
created: 2026-06-15
updated: 2026-06-15
plan: context/changes/test-plan-refresh-2026-06-12/plan.md
archived_at: null
---

## Notes

Open a change folder for test-plan refresh (2026-06-12). Trigger: S-07 entry-delete shipped (FR-013) but context/foundation/test-plan.md has no delete risk or cookbook; Phase 4 quality-gates still not started.

Current guide state:
- Risks #1–#7 mapped; rollout Phases 1–3 complete; Phase 4 (CI npm test) not started
- §6 documents RLS, HTTP auth/IDOR, entry workflow — no delete endpoint pattern
- S-07 implementation added partial coverage: auth-route-protection delete IDOR tests, entry-workflow deleteEntryWithPhotos cascade test

Refresh brief — add to §2:
- Risk #8: After owner deletes an entry, child paints, steps, or step_paint_assignments still exist in DB. Impact High, Likelihood Medium. Sources: PRD FR-013; roadmap S-07 archive risk note; refresh interview (cascade gaps worry); hot-spot dir src/lib/ (35 commits/30d).
- Risk response for #8: prove zero child rows for entry_id after delete; challenge "CASCADE exists so no test needed"; research must ground ON DELETE CASCADE + deleteEntryWithPhotos path; cheapest layer integration; anti-pattern asserting only entries row is null.

Also update §6 with delete API cookbook (extend §6.4 pattern: POST /api/entries/{id}/delete, deleted= success redirect, cascade assertions on child tables). Verify existing S-07 tests fully cover #8 or add gaps. Complete Phase 4 quality-gates wiring (npm test in CI).

Hot-spot scope: src/, supabase/. Test base: meaningful (vitest, 5 test files). Stack grounding: Context7, web search, Supabase skill available.

After creating the folder, follow the downstream continuation rule.
