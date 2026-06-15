# E2E Green Path for Entry Workflow — Plan Brief

> Full plan: `context/changes/e2e-green-path/plan.md`
> Research: `context/changes/e2e-green-path/research.md`

## What & Why

Paint Ledger needs a Playwright e2e test that proves the critical browser path — create entry, add paint, add step, remove step — because integration tests validate DB/loaders but skip Astro forms, React islands, redirects, and native confirm dialogs. The Playwright scaffold is partially configured but runs the wrong specs in CI.

## Starting Point

`tests/e2e/seed.spec.ts` prototypes sign-in and entry create/delete, but `playwright.config.ts` points at `e2e/example.spec.ts` (Playwright.dev scaffold). Integration tests in `entry-workflow-integration.test.ts` already cover risks #2, #4, #5, #8 without a browser.

## Desired End State

`npm run test:e2e` runs two specs — workflow green path plus seed create/delete — locally and in CI. Playwright CI starts local Supabase, writes `.env`, boots the dev server, and executes real app tests. Test-plan §6.3 documents how to add future e2e specs.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| CI scope | Separate `playwright.yml` with Supabase + dev server | PRs catch broken browser paths without merging into ci.yml | Plan |
| Photo upload | Defer | Integration owns Risk #4; avoids multipart flakiness | Plan |
| Test structure | New `entry-workflow.spec.ts`; keep `seed.spec.ts` | Focused green path; delete entry stays separate | Plan |
| Assertions | Banners + URL params only | Fastest, least brittle; integration owns recipe oracle | Plan |
| Test directory | `tests/e2e/` | Aligns with `tests/integration/` layout | Plan |
| Auth | Per-test UI sign-in | Matches prototype; no globalSetup yet | Research |

## Scope

**In scope:** Harness fix (`testDir`, `webServer`, `test:e2e`), shared `signInAsUserA` helper, `entry-workflow.spec.ts`, CI workflow update, test-plan §6.3 + AGENTS.md.

**Out of scope:** Photo upload e2e, detail page assertions, entry delete in workflow spec, `data-testid` additions, DB assertions in e2e, merging into `ci.yml`.

## Architecture / Approach

Single Playwright project (Chromium). Specs sign in via UI using seed user `USER_A`, create ephemeral entries, and assert redirect query params (`created=`, `added=`, `deleted=`) plus flash banners. `webServer` runs `npm run dev` with Supabase env vars. CI mirrors the integration job's Supabase bootstrap before `npx playwright test`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Harness + helpers | Config, npm script, sign-in helper, remove scaffold | `webServer` env not reaching Astro dev |
| 2. Green-path spec | `entry-workflow.spec.ts` | Ambiguous **Delete** / **Add paint** buttons |
| 3. CI + docs | `playwright.yml`, test-plan §6.3 | CI `.env`/`.dev.vars` mismatch with local dev |

**Prerequisites:** Local Supabase with seed; `.env` populated; Playwright browsers installed (`npx playwright install`).

**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Astro dev in CI requires both `.env` and `.dev.vars` — plan writes both from `supabase status` output.
- React island hydration depends on Vite paths being served correctly in dev (see `lessons.md` wrangler rule — verify if e2e fails mysteriously).
- Two e2e specs creating ephemeral entries may leave list clutter in local DB (cosmetic; reset clears).

## Success Criteria (Summary)

- `npm run test:e2e` passes locally with Supabase running.
- Playwright CI workflow green on PR.
- A contributor can add a new e2e spec using §6.3 without reading research.
