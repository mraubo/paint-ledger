# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-15 (S-07 entry delete refresh — Risk #8, delete cookbook)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|----------------------------------|
| 1 | User A reads or mutates User B's entry (paint list, steps, photos) because RLS or API checks fail | High | High | PRD FR-002 + Access Control; interview Q3; archive F-01 outcome |
| 2 | Step shows paints not on the entry paint list, or assignment silently drops after edit | High | Medium | PRD Business Logic + FR-006; roadmap S-04 risk note; hot-spot dir `src/components/entries/` (19 commits/30d) |
| 3 | Logged-in owner cannot reach `/entries/**` or APIs return 401/403 incorrectly after auth/middleware change | High | Medium | PRD FR-001; AGENTS.md PROTECTED_ROUTES rule; hot-spot dirs `src/middleware/`, `src/pages/api/auth/` |
| 4 | Photo upload reports success but detail recall shows broken/missing image (storage policy or signed URL path) | Medium | Medium | PRD FR-009/FR-010; archive F-02 outcome; hot-spot dir `src/pages/api/entries/` |
| 5 | Detail view omits or misorders recipe data — user cannot reconstruct the paint log without external notes | High | Medium | PRD US-01 + Success Criteria; roadmap north star S-06; hot-spot dir `src/pages/entries/` (11 commits/30d) |
| 6 | Authenticated user manipulates another user's `entry_id` via API and receives a success redirect or sees another user's data — not just "not logged in" | High | Medium | PRD Access Control; abuse lens; hot-spot dir `src/pages/api/entries/`; Phase 2 research (redirect contract) |
| 7 | Migration applies without error but RLS policies are wrong — cross-user leak appears only with a second account | High | Medium | interview Q3; hot-spot dir `supabase/migrations/` (5 commits/30d) |
| 8 | After owner deletes an entry, child paints, steps, or step_paint_assignments still exist in DB | High | Medium | PRD FR-013; roadmap S-07 archive risk note; refresh interview (cascade gaps worry); hot-spot dir `src/lib/` |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Second authenticated user cannot SELECT/UPDATE/DELETE another user's entry rows via Supabase client or app API | "Middleware protects pages, so DB is fine" | RLS policies per table; how app queries scope by `user_id`; seed second-user fixture | Integration (Supabase local + typed client) | Happy-path-only as owner; never testing as User B |
| #2 | Step cannot retain a paint_id outside the entry's paint list; inline-add flows keep invariant | "UI validates, so DB doesn't need to" | Junction trigger / constraint; API paths that assign paints; inline-add flow | Integration against local DB | Asserting only UI state; mirroring app validation in test without DB |
| #3 | Unauthenticated request to protected prefix redirects; authenticated session returns 200 | "Auth API works, so all routes are covered" | `PROTECTED_ROUTES` list; which routes are outside middleware | Integration (HTTP against dev server + cookie fixture) | Testing sign-in form only, not protected entry routes |
| #4 | After upload, detail recall resolves a viewable image for the owner; non-owner cannot access | "Upload returned 200" | Storage bucket policies; signed URL generation; path scoping to entry | Integration (Storage + one read path) | Mocking entire Supabase Storage stack |
| #5 | Complete entry detail shows model info, origin, paints, ordered steps with cards, step photos, final photo | "List page loads" | SSR loader composition; empty-section omission rules; status gates | Integration (loaders) + optional e2e for one golden path | Snapshot of HTML without asserting recipe completeness |
| #6 | Cross-user `entry_id` request gets redirect denial (sign-in or not-found error URL), never a success redirect; no persisted mutation | "RLS handles it" (without verifying app redirect shape) | Redirect-based API contract (not HTTP 403/404); per-handler ownership checks; `Origin` on POST | Integration (two-user HTTP) | Asserting HTTP 403/404; only testing unauthenticated case |
| #7 | After `db reset`, RLS smoke passes for two seed users on all four tables | "Migration applied" | Migration SQL; seed users; which operations each policy allows | SQL/integration against local Supabase | Running migration once as superuser only |
| #8 | After owner delete, zero rows in `entry_paints`, `steps`, and `step_paint_assignments` for the deleted entry | "CASCADE exists so no test needed" | FK CASCADE chain; `deleteEntryWithPhotos` single-row delete; junction has no direct `entry_id` | Integration (extend workflow test) | Asserting only `entries` row is null; skipping junction table |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-------------------|---------------|------------|--------|---------------|
| 1 | Runner bootstrap + RLS floor | Install Vitest; prove owner-only isolation and migration/RLS smoke with two users | #1, #7 | integration + SQL smoke | complete | testing-runner-bootstrap-rls-floor |
| 2 | Auth and route protection | Prove protected prefixes, session shape, and IDOR rejection on entry APIs | #3, #6 | integration (HTTP + cookies) | complete | testing-auth-and-route-protection |
| 3 | Entry workflow integration | Paint invariant, photo recall path, detail loader completeness | #2, #4, #5 | integration | complete | testing-entry-workflow-integration |
| 4 | Quality-gates wiring | `npm test` in CI; document cookbook patterns | cross-cutting | complete | test-plan-refresh-2026-06-12 |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | ^3.2.6 | wired locally; `npm test`; Vite-native fit for Astro toolchain |
| API mocking | MSW | TBD | none yet — prefer real local Supabase over mocks for RLS tests |
| e2e | Playwright | — | none yet; defer until integration proves critical paths |
| accessibility | — | — | none yet |
| lint + typecheck | ESLint + `astro check` | current | wired in CI today |

**Stack grounding tools (current session):**
- Docs: Context7 — Vitest library ID resolved; checked: 2026-06-10
- Search: web search MCP — available; not used for initial write; checked: 2026-06-10
- Runtime/browser: Playwright MCP — not available in current session; checked: 2026-06-10
- Provider/platform: Supabase skill — available for RLS/migration grounding; checked: 2026-06-10

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required | syntactic / type drift |
| unit + integration | local + CI | required | logic regressions, RLS, auth, delete cascade |
| e2e on critical flows | CI on PR | planned — optional after Phase 3 | broken critical user paths |
| post-edit hook | local (agent loop) | wired — `.cursor/hooks.json` `afterFileEdit` | ESLint auto-fix on agent `Write`/`StrReplace` edits |
| visual diff (deterministic) | CI on PR | not planned | — |
| pre-prod smoke | between merge + prod | optional | environment-specific failures |

**post-edit hook:** `.cursor/hooks.json` registers `afterFileEdit` on agent `Write`/`StrReplace` — runs `npx eslint --fix --quiet` on the edited file (5s timeout). Complements `npm run lint` locally and in CI; does not run typecheck or tests.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test

**Location:** colocate under `src/` as `*.test.ts` next to the module (convention TBD until the first unit test ships).

This rollout is **integration-first** — RLS and auth boundaries are covered before pure unit tests. When unit tests arrive, follow Vitest defaults in `vitest.config.ts` (`tests/**/*.test.ts` for integration; add a `src/**/*.test.ts` include if colocated unit tests are introduced).

### 6.2 Adding an integration test

**Location:** `tests/integration/<feature>.test.ts`

**Helpers:** `tests/helpers/supabase-client.ts` (`createTestClient`, `signInAs`, `requireLocalSupabase`); fixture UUIDs in `tests/helpers/seed-fixtures.ts`.

**Run:** `npx supabase start && npx supabase db reset`, then `npm test` (or `npm run test:watch`).

**Pattern:** sign in as seed user A or B, assert observable outcomes (empty data, errors, or unchanged rows) — not policy SQL text. Reference: `tests/integration/rls-isolation.test.ts`. Entry workflow coverage (paint invariant, Storage recall, detail loaders): `tests/integration/entry-workflow-integration.test.ts` with `tests/helpers/test-image.ts` for minimal PNG uploads — Supabase only, no dev server.

### 6.3 Adding an e2e test

TBD — see §3 Phase 3 if a golden recall path warrants e2e after integration.

### 6.4 Adding a test for a new API endpoint

**Location:** extend [tests/integration/auth-route-protection.test.ts](../../tests/integration/auth-route-protection.test.ts) (or add a sibling under `tests/integration/` if the surface is unrelated to entry auth).

**Helpers:** [tests/helpers/http-client.ts](../../tests/helpers/http-client.ts) (`requireDevServer`, `signInViaHttp`, `httpGet`, `httpPostForm`); fixture users in [tests/helpers/seed-fixtures.ts](../../tests/helpers/seed-fixtures.ts).

**Prerequisites:** `npx supabase start && npx supabase db reset`, then `npm run dev` on port 4321, then `npm test`.

**Pattern:**

1. Register new protected prefixes in `PROTECTED_ROUTES` when adding pages or `/api/entries/*` routes.
2. Unauthenticated case: assert `302`/`303` redirect to `/auth/signin` (not HTTP 401).
3. Authenticated cross-user case: sign in as user B via `signInViaHttp`, call the route with user A's `entry_id`; assert redirect denial (`error=` query or sign-in), never success redirects (`saved=1`, `added=1`, etc.).
4. On `POST`, always send `Origin: http://localhost:4321` (Astro CSRF) — `httpPostForm` does this.

Entry APIs use redirect-based errors, not 403/404 JSON. See Risk #6 in §2.

**Delete endpoint (`POST /api/entries/{id}/delete`):**

1. Unauthenticated: extend `auth-route-protection.test.ts` — assert `302`/`303` redirect to `/auth/signin`.
2. Cross-user (Risk #6): sign in as user B, POST with user A's `entry_id`; assert redirect denial with `error=` query, never `deleted=` success redirect; verify user A's entry still exists.
3. Owner cascade (Risk #8): extend `entry-workflow-integration.test.ts` — call `deleteEntryWithPhotos` directly; fixture must include `entry_paints`, `steps`, and at least one `step_paint_assignments` row; after delete assert zero rows in all child tables including junction rows queried by `step_id`.
4. Success redirect contract: `deleted=` query param carries entry title (from pre-delete row, not client input); denial uses `error=`.
5. On `POST`, always send `Origin: http://localhost:4321` when using HTTP helpers.

### 6.5 Adding a test for a new RLS policy or migration

After changing RLS policies or seed fixtures:

1. `npx supabase db reset`
2. Extend `tests/integration/rls-isolation.test.ts` (or add a sibling under `tests/integration/`) with a two-user case: user B must not read or mutate user A's rows.
3. `npm test` — all green before merge.

Keep fixture UUIDs in `tests/helpers/seed-fixtures.ts` in sync with `supabase/seed.sql`.

### 6.6 Per-rollout-phase notes

**Phase 1 (Runner bootstrap + RLS floor):** Vitest harness, second seed user (`seed-b@paint-ledger.local`), and `tests/integration/rls-isolation.test.ts` — automated two-user RLS smoke on `entries`, `entry_paints`, `steps`, `step_paint_assignments` plus one negative `delete_step_and_renumber` RPC case. Risks #1 and #7.

**Phase 2 (Auth and route protection):** `tests/helpers/http-client.ts` and `tests/integration/auth-route-protection.test.ts` — HTTP tests against `npm run dev`: unauthenticated protected-prefix redirect, authenticated owner access, and user B cross-user redirect denial on representative entry API/page paths. Risks #3 and #6.

**Phase 3 (Entry workflow integration):** `tests/integration/entry-workflow-integration.test.ts` and `tests/helpers/test-image.ts` — Supabase-client integration only (`npx supabase start && npx supabase db reset`, then `npm test`; no `npm run dev`). Risks #2, #4, #5: assert `step_paint_assignments` rows (not UI checkboxes) for paint-list invariant; real `entry-photos` Storage upload + signed URL + `fetch` for recall (do not mock Storage); import `loadEntryForEdit`, `loadEntryPaints`, `loadEntrySteps`, `resolveEntryFinalPhotoUrl` for recipe completeness against `supabase/seed.sql` (no HTML snapshots). Anti-patterns: redirect-only upload proof, mirroring `filterValidPaintIds` in expected values.

**S-07 (Entry delete refresh):** `entry-workflow-integration.test.ts` delete cascade block proves owner delete removes `entries`, `entry_paints`, `steps`, and `step_paint_assignments` (Risk #8). `auth-route-protection.test.ts` covers unauthenticated and cross-user delete denial via HTTP (Risk #6). Owner success at integration layer uses direct `deleteEntryWithPhotos` call, not HTTP happy-path.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Marketing / landing pages** — low blast radius; not product logic. Re-evaluate if they gain auth or data mutations. (Source: Phase 2 interview Q5.)
- **Generated Supabase TypeScript types** — the generator is the contract; hand-testing types adds noise. (Source: Phase 2 interview Q5.)
- **shadcn-style UI primitives** — upstream library components, not Paint Ledger business rules. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-15 (S-07 entry delete refresh — Risk #8)
- Stack versions last verified: 2026-06-15
- AI-native tool references last verified: 2026-06-10

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
