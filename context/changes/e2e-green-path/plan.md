# E2E Green Path for Entry Workflow Implementation Plan

## Overview

Add a Playwright e2e test that proves the browser green path — sign in, create entry, add paint, add step, remove step — and wire the Playwright harness so real tests run locally and in CI. Integration tests already cover risks #2, #4, #5, and #8 at the DB/loader layer; this change proves form submission, redirects, flash banners, confirm dialogs, and paint-checkbox wiring in the browser.

## Current State Analysis

**Already in place:**

- `@playwright/test ^1.61.0` in `package.json`; `playwright.config.ts` with `baseURL: http://localhost:4321` but `testDir: './e2e'` (scaffold only).
- Prototype `tests/e2e/seed.spec.ts` — sign-in, create entry, reload, delete entry — outside `testDir`.
- Duplicate scaffold at `e2e/example.spec.ts` and `tests/e2e/example.spec.ts` (hits `playwright.dev`, not the app).
- `.github/workflows/playwright.yml` runs scaffold with no Supabase or dev server.
- Integration coverage for paint invariant (#2), photo recall (#4), loader completeness (#5), delete cascade (#8) in `tests/integration/entry-workflow-integration.test.ts`.
- Seed credentials `USER_A` in `tests/helpers/seed-fixtures.ts`.

**Gaps:**

- `testDir` mismatch — real specs never run via `npx playwright test`.
- No `test:e2e` npm script.
- No shared sign-in helper for e2e specs.
- No entry-workflow spec covering paint → step → remove step.
- CI does not exercise app e2e.

### Key Discoveries:

- Selectors are role + label based; no `data-testid` in workflow components (`research.md`).
- Step delete uses native `confirm('Delete this step?')` — requires `page.once('dialog', …)` (`src/pages/entries/[id]/steps.astro:255-266`).
- Success contracts are redirect query params + flash banners: `created=`, `added=`, `deleted=` (`research.md` code refs).
- After create, URL is `/entries?created={entryId}` — entry ID is parseable for direct navigation to `/entries/{id}/paints`.
- CI integration job already starts Supabase and exports `API_URL` / `ANON_KEY` (`.github/workflows/ci.yml:25-33`) — same pattern applies to Playwright CI.

## Desired End State

After this change:

- `tests/e2e/entry-workflow.spec.ts` runs the green path: sign-in → create entry → add paint → add step → remove step → **delete entire entry** (cleanup).
- `tests/e2e/seed.spec.ts` remains for create/reload/**delete entry** persistence check (refactored to use shared sign-in helper).
- `playwright.config.ts` points at `tests/e2e/`, includes `webServer` for `npm run dev`, and passes Supabase env to the dev server.
- `npm run test:e2e` runs Playwright locally (documented prerequisites: Supabase reset + env).
- `.github/workflows/playwright.yml` starts Supabase, writes `.env`/`.dev.vars`, installs browsers, runs real e2e tests on PR/push.
- `context/foundation/test-plan.md` §6.3 documents the e2e pattern; `AGENTS.md` mentions `test:e2e`.

### Verification

- `npx supabase start && npx supabase db reset`, `.env` populated, then `npm run test:e2e` — both specs green.
- Playwright CI workflow green on PR.
- `npm run lint` unchanged.

## What We're NOT Doing

- Photo upload in browser (Risk #4 deferred — integration owns Storage recall).
- Detail page recipe assertions (banners and URL params only per plan decision).
- Entry delete cascade assertions (integration owns Risk #8 DB oracle).
- `globalSetup` / `storageState` auth optimization (per-test UI sign-in matches existing prototype).
- Duplicating DB/RPC paint invariant or delete-cascade oracles (integration layer).
- Merging Playwright into `ci.yml` (separate `playwright.yml` workflow per decision).
- Adding `data-testid` attributes to production components.

## Implementation Approach

Three phases: (1) fix harness and shared helpers, (2) implement the green-path spec, (3) wire CI and update test-plan docs. Reuse `USER_A` credentials and ephemeral entry titles (`Test Entry ${Date.now()}`). Extract sign-in into a shared helper used by both e2e specs.

## Critical Implementation Details

**Step delete dialog:** Register `page.once('dialog', dialog => dialog.accept())` immediately before clicking **Delete** on the step list row. Scope the button with `page.getByRole('listitem').filter({ hasText: stepDescription })` — multiple **Delete** buttons can exist on the page.

**Entry ID after create:** Parse `created` query param from `/entries?created={uuid}` after create submit. Navigate directly to `/entries/{id}/paints` (acceptable — this spec targets form flows, not list→detail navigation).

**Ambiguous buttons:** On the steps page, an inline **Add paint** form coexists with the add-step form. This spec adds paint on the paints page first, then navigates via **Manage steps** footer link (`src/pages/entries/[id]/paints.astro:192-193`) to avoid clicking the wrong **Add paint** button.

## Phase 1: Playwright harness and shared helpers

### Overview

Point Playwright at the real test directory, add npm script and `webServer`, remove scaffold noise, and extract a reusable sign-in helper.

### Changes Required:

#### 1. Playwright config

**File**: `playwright.config.ts`

**Intent**: Run specs from `tests/e2e/`, start the Astro dev server automatically, and pass Supabase secrets to the server process.

**Contract**: `testDir` → `'./tests/e2e'`. Uncomment/configure `webServer`: `command: 'npm run dev'`, `url: 'http://localhost:4321'`, `reuseExistingServer: !process.env.CI`, `timeout: 120_000`, `env` forwarding `SUPABASE_URL` and `SUPABASE_KEY` from `process.env`. Keep `baseURL: 'http://localhost:4321'`, `forbidOnly: !!process.env.CI`, CI retries/workers as today.

#### 2. npm script

**File**: `package.json`

**Intent**: Give contributors a single command to run e2e tests.

**Contract**: Add `"test:e2e": "playwright test"` to `scripts`.

#### 3. Shared sign-in helper

**File**: `tests/e2e/helpers/sign-in.ts` (new)

**Intent**: Deduplicate UI sign-in used by multiple e2e specs.

**Contract**: Export `signInAsUserA(page: Page)` that navigates to `/auth/signin`, fills email/password from `USER_A` in `tests/helpers/seed-fixtures.ts`, clicks **Sign in**, and waits for URL matching `/entries`. Mirror interaction style from `tests/e2e/seed.spec.ts:7-13` (`pressSequentially` on email).

#### 4. Refactor seed spec

**File**: `tests/e2e/seed.spec.ts`

**Intent**: Use shared sign-in helper; no behavior change.

**Contract**: Replace inline sign-in block with `signInAsUserA(page)` import.

#### 5. Remove scaffold files

**Files**: `e2e/example.spec.ts`, `tests/e2e/example.spec.ts`, empty `e2e/` directory

**Intent**: Eliminate Playwright.dev scaffold that CI currently runs.

**Contract**: Delete both example specs and the root `e2e/` directory. Only `tests/e2e/` remains.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- With Supabase running and `.env` set: `npm run test:e2e` discovers specs under `tests/e2e/` (may fail until Phase 2 spec lands — verify config picks up `seed.spec.ts`)

#### Manual Verification:

- `npx playwright test --list` shows `seed.spec.ts` (and `entry-workflow.spec.ts` after Phase 2)
- `webServer` starts dev server when not already running locally

**Implementation Note**: Pause for human confirmation after Phase 1 manual checks before Phase 2.

---

## Phase 2: Entry workflow green-path spec

### Overview

Add `entry-workflow.spec.ts` covering create entry → add paint → add step → remove step → delete entire entry with banner and URL assertions only.

### Changes Required:

#### 1. Entry workflow e2e spec

**File**: `tests/e2e/entry-workflow.spec.ts` (new)

**Intent**: Prove the browser green path for entry workflow forms and redirects.

**Contract**: Single `test()` (or one `test.describe` with one test) that:

1. Calls `signInAsUserA(page)`.
2. Creates entry with unique title (`E2E Workflow ${Date.now()}`); asserts `toHaveURL(/created=/)` and **Entry created** visible.
3. Parses `entryId` from `created` query param; navigates to `/entries/{entryId}/paints`.
4. Fills **Paint name** with a unique string; clicks **Add paint**; asserts `toHaveURL(/added=1/)` and **Paint added** visible.
5. Clicks **Manage steps** link; fills **Step description**; checks paint checkbox by paint name; clicks **Add step**; asserts `toHaveURL(/added=1/)` and **Step added** visible.
6. Registers dialog handler; scopes to step `listitem` containing the step description; clicks **Delete**; asserts `toHaveURL(/deleted=1/)` and **Step deleted** visible.
7. Navigates to `/entries`; scopes to entry `listitem` containing the entry title; registers dialog handler; opens **Entry actions** → **Delete**; asserts `toHaveURL(/deleted=/)` and `"{entryTitle}" deleted` visible; asserts entry link is gone from the list.

Use role locators per `research.md` selector table. Do not assert detail page content or DB state.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Prerequisites: `npx supabase start && npx supabase db reset`, `.env` with local Supabase URL/key
- `npm run test:e2e` — both `seed.spec.ts` and `entry-workflow.spec.ts` pass

#### Manual Verification:

- Run spec headed once (`npx playwright test --headed tests/e2e/entry-workflow.spec.ts`) to confirm forms hydrate and dialogs fire

**Implementation Note**: Pause for human confirmation after Phase 2 before Phase 3.

---

## Phase 3: CI wiring and test-plan documentation

### Overview

Make Playwright CI run real e2e tests against local Supabase + dev server, and document the e2e cookbook pattern.

### Changes Required:

#### 1. Playwright CI workflow

**File**: `.github/workflows/playwright.yml`

**Intent**: Mirror integration-test infra so e2e runs on every PR.

**Contract**:

- Align Node version with `.nvmrc` / `ci.yml` (Node 26, not `lts/*`).
- After `npm ci` and `npx playwright install --with-deps`, add Supabase steps matching `ci.yml`: `supabase start`, `supabase db reset --yes`, `eval "$(supabase status -o env)"`.
- Write `.env` and `.dev.vars` with `SUPABASE_URL=$API_URL` and `SUPABASE_KEY=$ANON_KEY` before `npx playwright test`.
- Keep playwright-report artifact upload.
- Do not require GitHub `SUPABASE_URL`/`SUPABASE_KEY` secrets (local Supabase in Actions, same as integration CI).

#### 2. Test plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.3 TBD with actionable e2e guidance.

**Contract**: §6.3 covers location (`tests/e2e/`), run command (`npm run test:e2e`), prerequisites (Supabase reset + `.env`), shared helpers (`signInAsUserA`, `seed-fixtures`), what e2e proves vs integration (reference risks #2/#5 browser slice), and anti-patterns (no DB assertion duplication). Update §4 e2e row version/notes and §5 quality gate "e2e on critical flows" from `planned` toward `required` or note wired in this change. Update freshness ledger date.

#### 3. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Document `test:e2e` for agents and contributors.

**Contract**: Add `test:e2e` to scripts list and a short e2e prerequisites bullet (Supabase + `.env` + Playwright browsers). Note that CI runs e2e via `.github/workflows/playwright.yml`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Playwright GitHub Actions workflow passes on PR (after push)

#### Manual Verification:

- Read updated §6.3 — a new contributor can add an e2e spec without reading research.md
- Confirm CI job logs show Supabase start, dev server via webServer, and both e2e specs passing

---

## Testing Strategy

### E2E tests:

- `entry-workflow.spec.ts` — green path (create → paint → step → remove step → delete entry)
- `seed.spec.ts` — create persistence + entry delete (existing, refactored)

### What integration still owns:

- Paint-list invariant at DB/RPC (#2)
- Storage upload + signed URL recall (#4)
- Loader recipe completeness (#5)
- Entry delete cascade (#8)

### Manual Testing Steps:

1. `npx supabase db reset` then `npm run test:e2e` — full green
2. Run workflow spec headed — verify React islands hydrate (Vite paths lesson)
3. Break a banner string in dev — confirm spec fails on assertion

## Performance Considerations

- Two specs with per-test UI sign-in — acceptable for two tests; revisit `storageState` if suite grows beyond ~5 specs.
- CI: single worker (`playwright.config.ts` already sets `workers: 1` on CI) avoids Supabase race conditions.

## Migration Notes

- Delete root `e2e/` directory — no production impact.
- Contributors who bookmarked `npx playwright test` against `e2e/` should use `npm run test:e2e`.

## References

- Research: `context/changes/e2e-green-path/research.md`
- Prototype: `tests/e2e/seed.spec.ts`
- Integration oracle: `tests/integration/entry-workflow-integration.test.ts`
- CI pattern: `.github/workflows/ci.yml:25-33`
- Archived Phase 3 plan: `context/archive/2026-06-12-testing-entry-workflow-integration/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Playwright harness and shared helpers

#### Automated

- [x] 1.1 `npm run lint` passes — a67c7c9
- [x] 1.2 `npm run test:e2e` discovers specs under `tests/e2e/` — a67c7c9

#### Manual

- [x] 1.3 `npx playwright test --list` shows `seed.spec.ts` — a67c7c9
- [x] 1.4 `webServer` starts dev server when not already running locally — a67c7c9

### Phase 2: Entry workflow green-path spec

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run test:e2e` — both `seed.spec.ts` and `entry-workflow.spec.ts` pass

#### Manual

- [x] 2.3 Run spec headed once to confirm forms hydrate and dialogs fire

### Phase 3: CI wiring and test-plan documentation

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 Playwright GitHub Actions workflow passes on PR

#### Manual

- [x] 3.3 Updated §6.3 is sufficient for a new contributor to add an e2e spec
- [x] 3.4 CI job logs show Supabase start, dev server, and both e2e specs passing
