---
change_id: testing-runner-bootstrap-rls-floor
title: Runner bootstrap and RLS floor (test rollout Phase 1)
status: implementing
created: 2026-06-11
updated: 2026-06-11
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Runner bootstrap + RLS floor".
Risks covered: #1 (cross-user entry access), #7 (migration/RLS policy drift).
Test types planned: integration + SQL smoke.
Risk response intent:
- Risk #1: prove a second authenticated user cannot SELECT/UPDATE/DELETE another user's entry rows via Supabase client or app API.
- Risk #7: prove after db reset, RLS smoke passes for two seed users on all four tables.
After creating the folder, follow the downstream continuation rule.
