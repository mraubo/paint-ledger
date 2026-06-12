---
change_id: testing-entry-workflow-integration
title: Entry workflow integration tests for paint invariant, photo recall, and detail completeness
status: implementing
created: 2026-06-12
updated: 2026-06-12
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Entry workflow integration".
Risks covered: #2, #4, #5. Test types planned: integration.
Risk response intent:
- Risk #2: Step cannot retain a paint_id outside the entry paint list; inline-add flows keep invariant — challenge "UI validates, so DB does not need to"; avoid asserting only UI state without DB.
- Risk #4: After upload, detail recall resolves a viewable image for the owner; non-owner cannot access — challenge "upload returned 200"; avoid mocking entire Supabase Storage stack.
- Risk #5: Complete entry detail shows model info, origin, paints, ordered steps with cards, step photos, final photo — challenge "list page loads"; avoid HTML snapshot without recipe completeness assertions.
