<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: E2E Green Path for Entry Workflow

- **Plan**: context/changes/e2e-green-path/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-06-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING ⚠️ |
| Scope Discipline | WARNING ⚠️ |
| Safety & Quality | PASS ✅ |
| Architecture | PASS ✅ |
| Pattern Consistency | WARNING ⚠️ |
| Success Criteria | WARNING ⚠️ |

## Automated verification (re-run 2026-06-15)

| Command | Result |
|---------|--------|
| `npm run lint` | PASS |
| `npm run test:e2e` | PASS — 2 specs, 2 workers, 3.9s |

## Findings

### F1 — Unplanned production change in EntryListActionsMenu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/components/entries/EntryListActionsMenu.tsx:62-74
- **Detail**: Phase 1 commit `b3a568f` moved entry-delete `confirm()` from form `onSubmit` to submit-button `onClick` and removed `setOpen(false)` on successful delete. Not listed in any phase's Changes Required. Step/paint deletes still use native `onsubmit="return confirm(...)"` in Astro pages.
- **Fix A ⭐ Recommended**: Add a short plan addendum documenting the change and rationale (Playwright dialog timing with React synthetic submit).
  - Strength: Preserves working e2e delete flow; updates source of truth.
  - Tradeoff: Plan scope expands slightly post-hoc.
  - Confidence: HIGH — change is already shipped and tests pass.
  - Blind spot: Whether menu stays open after delete in real UI (UX regression).
- **Fix B**: Revert to `onSubmit` confirm and fix e2e interaction instead
  - Strength: Keeps confirm pattern consistent with steps/paints pages.
  - Tradeoff: May re-break entry delete in Playwright; needs re-verification.
  - Confidence: MEDIUM — root cause of original move unclear.
  - Blind spot: Haven't reproduced failure with `onSubmit` + current Playwright version.
- **Decision**: SKIPPED

### F2 — CI workflow success not evidenced on branch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (Progress 3.2, 3.4)
- **Detail**: Progress marks 3.2 (Playwright GH Actions passes on PR) and 3.4 (CI logs show Supabase + dev server + both specs) as complete with SHA `07aea76`, but `e2e-green-path` has no `gh run` history and `playwright.yml` is not on `main` yet. Local `npm run test:e2e` passes; CI gate is unverified.
- **Fix**: Push branch and open PR; confirm `playwright.yml` job green before merging. Update Progress 3.2/3.4 SHAs only after CI evidence.
- **Decision**: FIXED — push branch + open PR to verify CI (pending workflow run)

### F3 — webServer may start dev server with empty Supabase env

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: playwright.config.ts:79-82
- **Detail**: `webServer.env` forwards `SUPABASE_URL`/`SUPABASE_KEY` defaulting to `""` when unset. Dotenv loading is commented out. If Playwright starts `npm run dev` (no existing server) without shell-exported env, empty strings may override Astro's `.env` loading.
- **Fix A ⭐ Recommended**: Uncomment dotenv in `playwright.config.ts` (mirror `vitest.config.ts`) so `webServer.env` inherits real values.
  - Strength: Matches integration test env pattern; fixes cold-start local runs.
  - Tradeoff: Adds dotenv devDependency usage in Playwright config.
  - Confidence: HIGH — CI exports vars explicitly; local cold-start is the gap.
  - Blind spot: Whether Astro dev already reads `.env` despite `webServer.env` override.
- **Fix B**: Omit `webServer.env` keys when undefined instead of passing `""`
  - Strength: Avoids clobbering Astro's own env loading.
  - Tradeoff: Slightly less explicit about required vars.
  - Confidence: MED — depends on Astro env precedence.
  - Blind spot: Cloudflare adapter behavior when vars missing.
- **Decision**: FIXED via Fix A — loadEnv in playwright.config.ts

### F4 — Missing hydration waits on shared sign-in helper

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/e2e/helpers/sign-in.ts:5-10
- **Detail**: `SignInForm` is `client:load`. Helper interacts immediately after `goto` without `toBeEditable()`. Both specs depend on this helper; paints/steps forms in `entry-workflow.spec.ts` already wait for hydration.
- **Fix**: Add `await expect(emailInput).toBeEditable()` before filling credentials.
- **Decision**: FIXED — toBeEditable() in sign-in helper

### F5 — Steps navigation uses goto instead of Manage steps link

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/e2e/entry-workflow.spec.ts:40-41
- **Detail**: Phase 2 contract step 5 specifies clicking **Manage steps** footer link from paints page. Implementation uses `page.goto(\`/entries/${entryId}/steps\`)`. Functionally equivalent for form-flow risk; skips footer navigation coverage. Likely motivated by Astro dev toolbar intercepting footer link clicks in dev.
- **Fix A ⭐ Recommended**: Document goto substitution in plan Critical Implementation Details with toolbar rationale.
  - Strength: Honest drift record; avoids flaky click in dev.
  - Tradeoff: Footer link navigation untested in e2e.
  - Confidence: HIGH.
  - Blind spot: Whether `force: true` click would work without goto.
- **Fix B**: Use `getByRole('link', { name: 'Manage steps' }).click({ force: true })`
  - Strength: Matches plan contract literally.
  - Tradeoff: May mask real user click issues under toolbar.
  - Confidence: LOW — toolbar intercept caused 30s timeout in practice.
  - Blind spot: CI headed vs headless toolbar presence.
- **Decision**: FIXED via Fix A — documented in plan Critical Implementation Details

### F6 — Phase 1 Progress SHAs don't match commits

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/e2e-green-path/plan.md:277-283
- **Detail**: Phase 1 automated/manual rows reference SHA `a67c7c9`; actual Phase 1 commit on branch is `b3a568f`. Bookkeeping drift only — implementation is present.
- **Fix**: Update Phase 1 Progress rows to `b3a568f`.
- **Decision**: FIXED — updated to b3a568f

### F7 — seed.spec.ts omits delete redirect URL assertion

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/e2e/seed.spec.ts:31
- **Detail**: Entry delete asserts flash banner but not `toHaveURL(/deleted=/)`. `entry-workflow.spec.ts:75` asserts both, matching test-plan redirect contract.
- **Fix**: Add `await expect(page).toHaveURL(/deleted=/)` before banner assertion in `seed.spec.ts`.
- **Decision**: FIXED — added toHaveURL(/deleted=/) in seed.spec.ts

### F8 — AGENTS.md Playwright CLI section not in plan

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: AGENTS.md:44-52
- **Detail**: Phase 3 planned e2e script + prerequisites only. Branch also adds `### Playwright CLI (agent auth)` section for `playwright-cli` / `auth.json` — orthogonal to `@playwright/test` harness but useful for agents.
- **Fix**: No action required unless strict scope discipline desired; optionally note in plan Phase 3 as bonus doc.
- **Decision**: SKIPPED (accepted as useful bonus doc)
