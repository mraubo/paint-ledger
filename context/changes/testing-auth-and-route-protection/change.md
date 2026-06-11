---
change_id: testing-auth-and-route-protection
title: Auth and route protection (test rollout Phase 2)
status: impl_reviewed
created: 2026-06-11
updated: 2026-06-11
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Auth and route protection".
Risks covered: #3, #6. Test types planned: integration (HTTP + cookies).
Risk response intent:
- Risk #3: Prove unauthenticated request to protected prefix redirects; authenticated session returns 200. Challenge "Auth API works, so all routes are covered". Avoid testing sign-in form only, not protected entry routes.
- Risk #6: Prove API rejects cross-user entry_id with 403/404, not 200 with data. Challenge "RLS handles it without verifying API error shape". Avoid only testing unauthenticated case.
After creating the folder, follow the downstream continuation rule.
