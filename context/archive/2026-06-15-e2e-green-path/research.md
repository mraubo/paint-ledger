---
date: 2026-06-15T12:34:38+02:00
researcher: Cursor Agent
git_commit: 2b110a65747622e1262f6462e5d6829bae85e2ef
branch: main
repository: paint-ledger
topic: "E2E green path for entry workflow (add entry → paint → step → remove step)"
tags: [research, codebase, e2e, playwright, entry-workflow, risks-2-4-5-8]
status: complete
last_updated: 2026-06-15
last_updated_by: Cursor Agent
---

# Research: E2E green path for entry workflow integration

**Date**: 2026-06-15T12:34:38+02:00
**Researcher**: Cursor Agent
**Git Commit**: 2b110a65747622e1262f6462e5d6829bae85e2ef
**Branch**: main
**Repository**: paint-ledger

## Research Question

How should Playwright e2e tests cover the entry workflow green path — add entry, add paint, add step, remove step — for rollout Phase 3 risks #2, #4, #5, and #8, given existing integration coverage and the partially configured Playwright scaffold?

## Summary

Integration tests already prove DB/RPC paint invariants (#2), Storage recall (#4), loader recipe completeness (#5), and delete cascade (#8) without a browser. E2e must prove the **browser path**: Astro pages, React forms, redirects, native confirm dialogs, and paint checkbox wiring that integration bypasses.

A prototype test exists at `tests/e2e/seed.spec.ts` (sign-in → create entry → reload → delete entry) but is **not executed** because `playwright.config.ts` sets `testDir: './e2e'`, which only contains the default Playwright scaffold hitting `playwright.dev`. CI (`.github/workflows/playwright.yml`) runs that scaffold with no Supabase or dev server.

The target green path maps to these routes and APIs:

1. **Create entry** — `/entries/new` → `POST /api/entries` → `/entries?created={id}`
2. **Add paint** — `/entries/{id}/paints` → `POST /api/entries/{id}/paints` → `?added=1`
3. **Add step** — `/entries/{id}/steps` → `POST /api/entries/{id}/steps` → `?added=1`
4. **Remove step** — step list `Delete` button → `confirm('Delete this step?')` → `POST .../delete` → `?deleted=1`

Stable selectors are **role + label based** (no `data-testid` in workflow components). Auth uses UI sign-in with seed user `USER_A` (`seed@paint-ledger.local` / `seed-password-123`).

## Detailed Findings

### Playwright scaffold state

| Area | Status | Reference |
|------|--------|-----------|
| Package installed | `@playwright/test ^1.61.0` | `package.json` |
| Config `testDir` | `./e2e` (scaffold only) | `playwright.config.ts:15` |
| `baseURL` | `http://localhost:4321` | `playwright.config.ts:29` |
| `webServer` | Commented out | `playwright.config.ts:74-78` |
| `storageState` / global auth | Absent | `playwright.config.ts` |
| npm script | None (`npx playwright test` manual) | `package.json` |
| CI workflow | Runs scaffold; no Supabase/dev server | `.github/workflows/playwright.yml:20-21` |
| Real app test | `tests/e2e/seed.spec.ts` — outside `testDir` | `tests/e2e/seed.spec.ts` |

### Entry workflow UI routes

| Action | Page | API |
|--------|------|-----|
| List + create CTA | `/entries` | — |
| Create entry | `/entries/new` | `POST /api/entries` |
| Manage paints | `/entries/{id}/paints` | `POST /api/entries/{id}/paints` |
| Manage steps | `/entries/{id}/steps` | `POST /api/entries/{id}/steps` |
| Remove step | `/entries/{id}/steps` (list row) | `POST /api/entries/{id}/steps/{stepId}/delete` |
| Entry detail (optional assert) | `/entries/{id}` | — |

Navigation after create: success redirect to `/entries?created={entryId}` with banner **Entry created** (`src/pages/api/entries/index.ts:39`, `src/pages/entries/index.astro:46-48`). From edit page footer, **Manage paints** and **Manage steps** links reach paint/step pages (`src/pages/entries/[id]/edit.astro:201-203`).

Suggested e2e navigation:

```
/auth/signin → /entries → /entries/new → /entries?created={id}
  → /entries/{id}/edit → Manage paints → /entries/{id}/paints
  → add paint → ?added=1 → Manage steps → /entries/{id}/steps
  → add step → ?added=1 → Delete step → ?deleted=1
```

### Form fields and selectors

No `data-testid` in entry workflow components. Use Playwright role locators wired through shared `FormField` / `TextareaField` (`htmlFor` / `id`).

| Step | Locator |
|------|---------|
| Sign in | `getByRole("textbox", { name: "Email" })`, `getByRole("button", { name: "Sign in" })` |
| Create entry link | `getByRole("link", { name: "Create entry" })` |
| Title | `getByRole("textbox", { name: "Title" })` |
| Create entry submit | `getByRole("button", { name: "Create entry" })` |
| Manage paints | `getByRole("link", { name: "Manage paints" })` |
| Paint name | `getByRole("textbox", { name: "Paint name" })` |
| Add paint | `getByRole("button", { name: "Add paint" })` |
| Manage steps | `getByRole("link", { name: "Manage steps" })` |
| Step description | `getByRole("textbox", { name: "Step description" })` |
| Assign paint checkbox | `getByRole("checkbox", { name: /<paint name>/ })` |
| Add step | `getByRole("button", { name: "Add step" })` |
| Delete step | `getByRole("button", { name: "Delete" })` within filtered `listitem` |

**Caveats:** Multiple **Add paint** / **Delete** buttons can coexist (inline paint form on steps page + list row deletes). Scope with `filter({ hasText: … })` on parent `listitem` or section heading.

### Remove step confirmation

Step delete uses native `confirm('Delete this step?')` on the list form (`src/pages/entries/[id]/steps.astro:255-266`). Playwright must register `page.once('dialog', dialog => dialog.accept())` before clicking **Delete** — same pattern as entry delete in `tests/e2e/seed.spec.ts:30-40`.

Success: redirect to `?deleted=1`, banner **Step deleted** (`src/pages/api/entries/[id]/steps/[stepId]/delete.ts:52`, `steps.astro:158-161`).

### React components

| Component | Role |
|-----------|------|
| `EntryBasicsForm` | Create/edit entry basics |
| `EntryPaintForm` | Add/edit paint on paints page |
| `EntryStepForm` | Add/edit step with paint checkboxes |
| `EntryStepInlinePaintAdd` | Inline add paint from steps page (`<details>`) |
| `StepPhotoField` | Optional step photo upload |
| `ColorField` | Hex + color picker (`aria-label` on picker) |

### Integration coverage vs e2e gaps

**Already proven (do not duplicate in e2e):**

| Risk | Integration evidence |
|------|-------------------|
| #2 Paint invariant | `entry-workflow-integration.test.ts` — RPC, trigger, `updateStepWithAssignments`, junction rows |
| #4 Photo recall | Same file — `uploadEntryPhoto`, signed URL, `fetch` 200, loader `photo_url` |
| #5 Recipe completeness | Same file — `loadEntryForEdit`, `loadEntryPaints`, `loadEntrySteps` vs seed oracle |
| #8 Delete cascade | Same file — `deleteEntryWithPhotos` removes all child tables |
| #3, #6 Auth/IDOR | `auth-route-protection.test.ts` — redirects and cross-user denial |

**E2e must add:**

| Gap | Why browser |
|-----|-------------|
| Create entry via form | No owner HTTP happy-path test |
| Add paint via form | IDOR tests only denial |
| Add step + paint checkbox | Integration uses `updateStepWithAssignments` directly |
| Remove step via UI | Not covered anywhere |
| Form → redirect → banner chain | Proves Astro/React wiring |
| Optional: detail page visible recipe | Loaders proven; HTML rendering not |
| Optional: photo via file input | Integration uses Storage API; `httpPostForm` has no multipart |

### Test credentials and isolation

- **USER_A**: `seed@paint-ledger.local` / `seed-password-123` (`tests/helpers/seed-fixtures.ts:5-9`, `supabase/seed.sql:5-6`)
- **ENTRY_A** (`22222222-…`) is mutated by integration tests — use ephemeral entries with timestamp titles (pattern in `tests/e2e/seed.spec.ts:5`)
- Prerequisites: `npx supabase start && npx supabase db reset` + `npm run dev` on port 4321
- Send `Origin: http://localhost:4321` is handled by browser forms automatically (CSRF lesson applies to curl only)

### Proposed green path test structure

Extend or replace `tests/e2e/seed.spec.ts` with a single flow:

1. Sign in as `USER_A`
2. Create entry with unique title; assert `created=` URL and **Entry created**
3. Open entry (link or navigate to edit); go to paints; add paint name; assert `added=1` and **Paint added**
4. Navigate to steps; fill description; check paint checkbox; submit; assert `added=1` and **Step added**
5. On step list, accept confirm dialog; click **Delete**; assert `deleted=1` and **Step deleted**
6. Optional: visit `/entries/{id}` and assert title, paint name, remaining steps visible (Risk #5 browser slice)

**Risk mapping in e2e:**

- **#2**: After add step, assert assigned paint name appears on step row (`PaintCard` in list) — not DB rows
- **#4**: Defer to integration unless photo upload is in scope (file input + visible image on detail)
- **#5**: Optional detail page assertions with recipe strings
- **#8**: Out of scope for this path (step delete ≠ entry delete cascade); entry delete already in `seed.spec.ts`

### Wiring fixes required before CI value

1. Point `testDir` to `tests/e2e/` (or consolidate into one directory)
2. Remove or relocate `e2e/example.spec.ts` scaffold
3. Add `webServer` or document manual `npm run dev` prerequisite
4. Add Supabase start/reset to CI (mirror `.github/workflows/ci.yml`)
5. Add `test:e2e` npm script
6. Consider `globalSetup` for one-time sign-in + `storageState` to speed suite

## Code References

- `playwright.config.ts:15` — `testDir: './e2e'` mismatch with real tests
- `playwright.config.ts:29` — `baseURL: 'http://localhost:4321'`
- `tests/e2e/seed.spec.ts:4-43` — prototype create + delete flow
- `src/pages/entries/new.astro` — create entry page
- `src/pages/entries/[id]/paints.astro` — paints list + add form
- `src/pages/entries/[id]/steps.astro:255-266` — step delete form with confirm
- `src/components/entries/EntryBasicsForm.tsx` — create entry form
- `src/components/entries/EntryPaintForm.tsx` — add paint form
- `src/components/entries/EntryStepForm.tsx:75-95` — paint assignment checkboxes
- `src/pages/api/entries/index.ts:39` — create redirect `?created=`
- `src/pages/api/entries/[id]/paints/index.ts:65` — paint redirect `?added=1`
- `src/pages/api/entries/[id]/steps/index.ts:57` — step redirect `?added=1`
- `src/pages/api/entries/[id]/steps/[stepId]/delete.ts:52` — delete redirect `?deleted=1`
- `tests/helpers/seed-fixtures.ts:3-15` — `USER_A`, `USER_B`, `SEED_PASSWORD`
- `tests/integration/entry-workflow-integration.test.ts` — Phase 3 integration oracle
- `tests/integration/auth-route-protection.test.ts` — HTTP auth patterns
- `.github/workflows/playwright.yml:20-21` — CI runs scaffold only
- `src/middleware.ts:4-5` — `PROTECTED_ROUTES` includes `/entries`

## Architecture Insights

- Entry workflow uses **redirect-based success/error contracts** (`created=`, `added=`, `deleted=`, `error=`) not JSON APIs — e2e should assert URL query params and flash banners.
- Paint assignment invariant is enforced at DB/RPC/app layers; UI uses checkboxes bound to `entry_paint_ids`. E2e proves the checkbox → visible assignment chain; integration owns DB oracle.
- Step delete renumbers via server-side RPC (`delete_step_and_renumber`) — after delete, remaining steps should show updated positions.
- Auth for e2e is UI sign-in per test today; integration HTTP helpers (`signInViaHttp`) and `.cookies` fixture are available but not wired to Playwright.
- `AGENTS.md` documents `auth.json` + `playwright-cli state-load` for agent browser automation — separate from `@playwright/test` harness.

## Historical Context (from prior changes)

- `context/archive/2026-06-12-testing-entry-workflow-integration/plan.md:52-61` — Phase 3 integration explicitly deferred Playwright/e2e and HTTP multipart uploads.
- `context/foundation/test-plan.md:59` — Risk #5 notes "optional e2e for one golden path" after integration.
- `context/foundation/test-plan.md:137-139` — §6.3 "Adding an e2e test" still TBD (stale vs partial Playwright setup).
- `context/foundation/test-plan.md:182-184` — Phase 3 integration patterns and anti-patterns (no UI checkbox-only paint invariant tests).

## Related Research

- `context/archive/2026-06-12-testing-entry-workflow-integration/research.md` — Phase 3 integration grounding (loaders, RPC, Storage)
- `context/changes/testing-auth-and-route-protection/research.md` — HTTP redirect contract for auth/IDOR (if present in archive)

## Open Questions

1. **Scope photo upload in e2e?** Risk #4 is fully covered at integration layer; browser file-picker test adds CI complexity (multipart, Storage, signed URL visibility). Recommend defer unless explicitly required.
2. **Consolidate test directories?** `e2e/` vs `tests/e2e/` — pick one convention aligned with `tests/integration/`.
3. **Entry delete in same spec?** `seed.spec.ts` already covers entry delete; green path could extend that spec or split into focused files.
4. **CI secrets:** E2e CI needs `SUPABASE_URL`/`SUPABASE_KEY` (or local Supabase in Actions) plus dev server — not yet wired.
5. **Detail page assertion depth?** Minimum: paint name on step row after add. Fuller: navigate to `/entries/{id}` and assert ordered steps section.
