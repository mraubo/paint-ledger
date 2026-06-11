# Auth and Route Protection Implementation Plan

## Overview

Deliver test rollout Phase 2 (`context/foundation/test-plan.md`): add **HTTP integration tests** that prove middleware protects `/entries` and `/api/entries` (risk **#3**) and that an authenticated second user cannot mutate another user's entry via representative API/page paths (risk **#6**). Builds on Phase 1's RLS floor; does not duplicate DB-layer isolation.

## Current State Analysis

**Already in place:**

- `PROTECTED_ROUTES` in `src/middleware.ts` — `["/entries", "/api/entries"]`; unauthenticated → `302` `/auth/signin`.
- 14 entry `POST` handlers under `src/pages/api/entries/` — all use `requireUser` then `context.redirect(...)` (never HTTP 403/404 JSON).
- Phase 1: Vitest, `tests/helpers/supabase-client.ts`, `seed-fixtures.ts`, `tests/integration/rls-isolation.test.ts`.
- Seed users A and B; `ENTRY_A` owned by A.
- `context/foundation/lessons.md` — `Origin` header required on POST; register new routes in `PROTECTED_ROUTES`.
- Test-plan §2 Risk #6 backported to **redirect-denial contract** (not 403/404).

**Gaps:**

- No HTTP/fetch tests against Astro dev server.
- No `tests/helpers/http-client.ts` or `requireDevServer()`.
- `vitest.config.ts` has no `APP_URL`.
- test-plan §6.4 still TBD; AGENTS.md/README document RLS only, not HTTP prerequisites.

### Key Discoveries:

- Middleware and handlers use **redirects**, not 401/403 status codes (`research.md`).
- `loadEntryExists` is RLS-scoped — User B on A's `entry_id` → "Entry not found" redirect (`src/lib/entry-paints-page.ts:25-29`).
- `[id].ts` update uses explicit `.eq("user_id", user.id)` — same user-visible denial shape.
- HTTP tests need **both** `npx supabase start && db reset` **and** `npm run dev` on `localhost:4321`.
- Representative route matrix (4 API + 2 page cases) is sufficient signal; all 14 POST handlers share the same redirect pattern.

## Desired End State

After this change:

- `tests/helpers/http-client.ts` provides `requireDevServer()`, `signInViaHttp()`, and fetch helpers with `Origin` on POSTs.
- `tests/integration/auth-route-protection.test.ts` covers Risk #3 (unauth redirect + auth 200) and Risk #6 (User B cross-user denial on representative routes).
- `npm test` passes when local Supabase **and** Astro dev server are running.
- `AGENTS.md`, `README.md`, and `context/foundation/test-plan.md` §6.4 / §6.6 document the HTTP integration pattern.
- `npm run lint` and `npm run build` still pass.
- CI unchanged (Phase 4 wires `npm test`).

### Verification

- Unauthenticated `GET /entries` → `302` `Location` contains `/auth/signin`.
- User A cookie → `GET /entries` and `GET /entries/{ENTRY_A.id}` → `200`.
- User B `POST /api/entries/{ENTRY_A.id}` (title change) → redirect **without** `saved=1`; A's title unchanged (optional DB check).
- User B `GET /entries/{ENTRY_A.id}` → redirect to entry-not-found, not `200` with A's title in body.

## What We're NOT Doing

- CI job with `astro dev` (rollout Phase 4).
- E2E / Playwright.
- Asserting HTTP 403/404 on entry APIs (wrong contract).
- Testing all 14 POST routes individually (representative matrix only).
- Re-testing RLS table isolation (Phase 1).
- Storage, paint-invariant, or detail-recall tests (rollout Phase 3).
- Changing middleware or handler auth logic (tests only).

## Implementation Approach

Three phases: (1) HTTP helpers + dev-server guard, (2) Risk #3 route-protection suite, (3) Risk #6 IDOR suite + docs + test-plan cookbook. Single integration file keeps related auth concerns together. Sign-in via `POST /api/auth/signin` exercises the real SSR cookie path.

## Critical Implementation Details

**Dev server prerequisite:** `beforeAll` in the HTTP suite calls `requireDevServer()` which probes `APP_URL` (default `http://localhost:4321`). On failure, throw with: run `npm run dev` in a separate terminal. This intentionally makes `npm test` depend on dev server for the HTTP file — RLS tests in the same run still execute first if ordered alphabetically; document that full green requires both stacks.

**POST requests:** Always send `Origin: http://localhost:4321` (or `APP_URL`) and `redirect: "manual"` on `fetch` to inspect `Location` without following redirects. CSRF 403 without Origin is a test bug, not an auth failure (`lessons.md`).

**IDOR oracle:** Assert `Location` does **not** match success patterns (`saved=1`, `added=1`, `deleted=1`, `status_changed=`). For cross-user authenticated cases, expect `/auth/signin` **or** URL with `error=` (decoded contains "not found" or similar). Do not assert specific HTTP status beyond 302/303 for redirects and 200 for allowed GETs.

## Phase 1: HTTP test helpers

### Overview

Add shared HTTP utilities for Vitest integration tests against the Astro dev server.

### Changes Required:

#### 1. HTTP client helper

**File**: `tests/helpers/http-client.ts` (new)

**Intent**: Centralize dev-server probe, sign-in cookie acquisition, and form POST with required `Origin`.

**Contract**:

- Export `APP_BASE_URL` from `process.env.APP_URL ?? "http://localhost:4321"`.
- Export `APP_ORIGIN` matching base URL origin.
- Export `requireDevServer()` — `fetch(APP_BASE_URL + "/entries", { redirect: "manual" })`; accept any response that proves server is up (including 302 to sign-in); throw actionable error if connection refused.
- Export `signInViaHttp(email, password)` — `POST /api/auth/signin` with `application/x-www-form-urlencoded` body, `Origin`, `redirect: "manual"`; parse `Set-Cookie` into a single `Cookie` header string for subsequent requests.
- Export `httpGet(path, cookie?)` and `httpPostForm(path, fields, cookie?)` — set `redirect: "manual"`; POST includes `Origin`.

#### 2. Vitest env (optional)

**File**: `vitest.config.ts`

**Intent**: Allow overriding dev server URL in CI/local scripts later.

**Contract**: Add `APP_URL: env.APP_URL ?? "http://localhost:4321"` to `test.env` block.

### Success Criteria:

#### Automated Verification:

- `npm test` passes (RLS suite; HTTP file may be empty or placeholder `it.skip` until Phase 2)
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- With `npm run dev` running, a one-off script or temporary test can call `signInViaHttp(USER_A.email, USER_A.password)` and `GET /entries` returns 200

**Implementation Note**: Pause for human confirmation after Phase 1 automated checks pass.

---

## Phase 2: Route protection tests (Risk #3)

### Overview

Prove `PROTECTED_ROUTES` behavior for pages and APIs — unauthenticated redirect, authenticated 200.

### Changes Required:

#### 1. Auth route protection integration tests

**File**: `tests/integration/auth-route-protection.test.ts` (new)

**Intent**: Automate AGENTS.md contract for Risk #3.

**Contract** — `beforeAll`: `requireLocalSupabase()` (from existing helper) + `requireDevServer()`:

| # | Request | Cookie | Assert |
|---|---------|--------|--------|
| 1 | `GET /entries` | none | Status 302/303; `Location` pathname is `/auth/signin` |
| 2 | `GET /entries/{ENTRY_A.id}` | none | Same redirect to sign-in |
| 3 | `POST /api/entries/{ENTRY_A.id}` | none | Minimal form (`title`, `description`, `model_info`, `model_origin_note`); `Origin` set; redirect to sign-in |
| 4 | `GET /entries` | User A | Status 200 |
| 5 | `GET /entries/{ENTRY_A.id}` | User A | Status 200; body contains seed entry title (e.g. "Imperial Fist Intercessor") |

Use `USER_A`, `ENTRY_A` from `tests/helpers/seed-fixtures.ts`. Do not assert sign-in page HTML.

**Regression caught:** Removing a prefix from `PROTECTED_ROUTES` or breaking session cookie propagation.

**Anti-pattern avoided:** Testing `/api/auth/signin` response alone without hitting protected routes.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` succeeds
- `npm run dev` running → `npm test` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Stop dev server → HTTP tests fail with clear `requireDevServer` message

**Implementation Note**: Pause for human confirmation after manual dev-server-off check.

---

## Phase 3: IDOR HTTP tests and cookbook (Risk #6)

### Overview

Prove authenticated User B cannot succeed on User A's `entry_id` via representative API and page paths; document patterns in test-plan §6.

### Changes Required:

#### 1. IDOR cases in auth-route-protection suite

**File**: `tests/integration/auth-route-protection.test.ts`

**Intent**: Automate Risk #6 redirect-denial contract for two handler styles (explicit `user_id` filter vs `loadEntryExists` + RLS).

**Contract** — sign in User B via `signInViaHttp`; use `ENTRY_A`:

| # | Request | Assert |
|---|---------|--------|
| 6 | `GET /entries/{ENTRY_A.id}` as B | Redirect (not 200); `Location` contains `error=` with entry-not-found semantics **or** does not return 200 with A's title in body |
| 7 | `POST /api/entries/{ENTRY_A.id}` as B | Change `title`; redirect **without** `saved=1`; `Location` contains `error=` or edit URL with error |
| 8 | `POST /api/entries/{ENTRY_A.id}/paints` as B | Minimal paint form (`name` required); redirect **without** `added=1`; not success paints URL with `added=` |
| 9 | (optional) `POST /api/entries/{ENTRY_A.id}/status-change` as B | `status=draft`; redirect **without** `status_changed=` |

After case 7, optional DB assertion via `createTestClient` + `signInAs` user A: entry title unchanged (reuses Phase 1 helper — adds signal beyond redirect alone).

**Regression caught:** Handler returns success redirect for cross-user `entry_id`.

**Anti-pattern avoided:** Only testing unauthenticated POST; asserting 403/404 status codes.

#### 2. AGENTS.md HTTP test note

**File**: `AGENTS.md`

**Intent**: Agents know HTTP integration tests need dev server.

**Contract**: Extend **Tests** subsection: `auth-route-protection.test.ts` requires `npm run dev` on port 4321 in addition to local Supabase; POST curl/API tests need `Origin: http://localhost:4321`.

#### 3. README HTTP testing subsection

**File**: `README.md`

**Intent**: Humans can run the full suite including HTTP tests.

**Contract**: Under "Integration tests (local)": add prerequisite `npm run dev` for HTTP tests; describe two-terminal workflow (Supabase + dev server); link to `tests/integration/auth-route-protection.test.ts`.

#### 4. Test-plan cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Phase 2 rollout deliverable — §6.4 pattern for new API endpoints.

**Contract**:

- §6.4: location `tests/integration/auth-route-protection.test.ts`; helpers `http-client.ts` + `seed-fixtures.ts`; sign in via `signInViaHttp`; assert redirect denial for cross-user `entry_id`; `Origin` on POST; prerequisites Supabase + `npm run dev`.
- §6.6: add Phase 2 note (HTTP auth + IDOR matrix).
- §3 Phase 2 status → `implementing` during work, `complete` when archived (orchestrator updates).

### Success Criteria:

#### Automated Verification:

- `npm test` passes with Supabase + dev server running
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- User B cross-user POST in browser still blocked; test failure if middleware `PROTECTED_ROUTES` regresses

---

## Testing Strategy

### Unit Tests

None — HTTP integration targets middleware + handler redirect contract.

### Integration Tests

- `tests/integration/auth-route-protection.test.ts` — Risk #3 (5 cases) + Risk #6 (3–4 cases).
- Existing `rls-isolation.test.ts` unchanged; runs in same `npm test` invocation.

### Manual Testing Steps

1. Terminal A: `npx supabase start && npx supabase db reset`
2. Terminal B: `npm run dev`
3. `npm test` — all green.
4. Stop dev server → HTTP tests fail with clear message.
5. Optional: curl unauthenticated `GET /entries` — 302 to sign-in (matches AGENTS.md).

## Performance Considerations

HTTP suite is small (~10 fetch calls); no load testing. Dev server dependency is local-only until Phase 4.

## Migration Notes

No schema changes. Developers running `npm test` after this change need dev server for full green; RLS-only failures vs HTTP failures are distinguishable by file name in Vitest output.

## References

- Research: `context/changes/testing-auth-and-route-protection/research.md`
- Test plan: `context/foundation/test-plan.md` §2–§3 Phase 2
- Phase 1 plan: `context/archive/2026-06-11-testing-runner-bootstrap-rls-floor/plan.md`
- Middleware: `src/middleware.ts:5-30`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: HTTP test helpers

#### Automated

- [x] 1.1 `npm test` passes
- [x] 1.2 `npm run lint` passes
- [x] 1.3 `npm run build` passes

#### Manual

- [x] 1.4 `signInViaHttp` + authenticated `GET /entries` returns 200 with dev server running

### Phase 2: Route protection tests (Risk #3)

#### Automated

- [ ] 2.1 `npx supabase db reset` succeeds
- [ ] 2.2 `npm test` passes with Supabase and `npm run dev` running
- [ ] 2.3 `npm run lint` passes
- [ ] 2.4 `npm run build` passes

#### Manual

- [ ] 2.5 Stopped dev server produces clear `requireDevServer` failure

### Phase 3: IDOR HTTP tests and cookbook (Risk #6)

#### Automated

- [ ] 3.1 `npm test` passes with Supabase and dev server running
- [ ] 3.2 `npm run lint` passes
- [ ] 3.3 `npm run build` passes

#### Manual

- [ ] 3.4 test-plan §6.4 documents HTTP pattern without repo search
