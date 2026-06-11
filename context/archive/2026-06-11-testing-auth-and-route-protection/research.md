---
date: 2026-06-11T18:27:33+00:00
researcher: Cursor Agent
git_commit: 4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c
branch: main
repository: paint-ledger
topic: "Rollout Phase 2 — Auth and route protection (risks #3, #6)"
tags: [research, testing, auth, middleware, idor, http, vitest]
status: complete
last_updated: 2026-06-11
last_updated_by: Cursor Agent
---

# Research: Rollout Phase 2 — Auth and route protection

**Date**: 2026-06-11
**Researcher**: Cursor Agent
**Git Commit**: [`4aaf71fb`](https://github.com/mraubo/paint-ledger/commit/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c)
**Branch**: `main`
**Repository**: [mraubo/paint-ledger](https://github.com/mraubo/paint-ledger)

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md`: prove protected prefixes, session shape, and IDOR rejection on entry APIs (risks **#3**, **#6**). Verify or correct risk response guidance; locate existing tests; identify the cheapest useful test layer; flag speculative risks or misleading hot-spot evidence.

## Summary

**Risk #3 is confirmed** at the middleware layer: `PROTECTED_ROUTES` covers both `/entries` pages and `/api/entries` handlers. Unauthenticated requests receive a **302 redirect to `/auth/signin`**, not HTTP 401. Authenticated sessions reach protected pages when a valid Supabase SSR cookie is present.

**Risk #6 is confirmed in behavior but the test-plan oracle needs correction**: entry APIs do **not** return HTTP 403/404 JSON bodies. They use **Astro redirect responses** — either `/auth/signin` (no session) or a same-app URL with `error=` query params (cross-user or not-found). Cross-user mutations are blocked by **RLS** plus, in some handlers, explicit `.eq("user_id", user.id)` filters. User B acting on User A's `entry_id` must be asserted as **no success redirect and no persisted mutation** (RLS floor already proves DB isolation; HTTP tests prove the app layer does not leak success UX).

**Cheapest layer**: Vitest **HTTP integration** against `http://localhost:4321` with `fetch`, signing in via `POST /api/auth/signin` (captures `Set-Cookie`) or reusing `.cookies` pattern from AGENTS.md. Requires **both** local Supabase (`npx supabase start && db reset`) **and** `npm run dev` running — unlike Phase 1 RLS-only tests.

**Existing gap**: `tests/integration/rls-isolation.test.ts` covers DB isolation only. No HTTP tests exist. No `requireDevServer()` helper yet.

**Hot-spot evidence validated**: `src/middleware/`, `src/pages/api/entries/`, and `src/pages/api/auth/` are the right areas; ownership logic also lives in `src/lib/entries-api.ts` and `src/lib/entry-paints-page.ts` (`loadEntryExists`).

## Detailed Findings

### Middleware and protected routes (Risk #3)

[`src/middleware.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/middleware.ts) is the single gate for page and API prefixes:

| Constant | Values | Behavior |
|----------|--------|----------|
| `PROTECTED_ROUTES` | `"/entries"`, `"/api/entries"` | If `context.locals.user` is null → `context.redirect("/auth/signin")` |
| `AUTH_ONLY_GUEST_ROUTES` | `"/auth/signin"`, `"/auth/signup"` | If user is logged in → redirect to `"/entries"` |

Session resolution: `createClient` + `supabase.auth.getUser()` on every request (lines 10–19). User is attached to `context.locals.user`.

**Protected page routes** (all under `src/pages/entries/`):

- `/entries` — list
- `/entries/new` — create form
- `/entries/[id]` — detail
- `/entries/[id]/edit` — edit basics
- `/entries/[id]/paints` — paint palette
- `/entries/[id]/steps` — steps editor

**Protected API routes** (14 handlers under `src/pages/api/entries/`): all `POST` form handlers for create/update/delete/mutations. Prefix `/api/entries` is covered by middleware.

**Public routes** (not in `PROTECTED_ROUTES`):

- `/api/auth/signin`, `/api/auth/signup`, `/api/auth/signout` — must stay public
- Marketing/landing pages (aligned with test-plan §7 negative space)

**AGENTS.md contract** (lines 31–39): after auth/routing changes, unauthenticated request to each `PROTECTED_ROUTES` prefix must redirect; authenticated session must return **200** on the protected page. This is the authoritative acceptance criteria for Risk #3 tests.

**Must challenge — confirmed valid**: testing `/api/auth/signin` alone is insufficient. Middleware runs before handlers; unauthenticated `GET /entries` and `POST /api/entries/...` must be exercised.

### Entry API auth and IDOR (Risk #6)

All entry API handlers follow the same skeleton:

1. Validate UUID params (`isValidEntryId`, etc.)
2. `createClient` + `requireUser` → redirect `/auth/signin` if no session
3. Ownership / existence check (varies)
4. Mutation via Supabase anon client (RLS applies)
5. **Always** `context.redirect(...)` on success or failure — never `new Response(..., { status: 403 })`

#### Handler inventory

| Route | File | Ownership check before mutate |
|-------|------|------------------------------|
| `POST /api/entries` | [`index.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/index.ts) | N/A (insert with `user_id: user.id`) |
| `POST /api/entries/[id]` | [`[id].ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id].ts) | `.eq("user_id", user.id)` on update |
| `POST /api/entries/[id]/status-change` | [`status-change.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id]/status-change.ts) | `changeEntryStatus(..., user.id)` |
| `POST /api/entries/[id]/final-photo` | [`final-photo.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id]/final-photo.ts) | `.eq("user_id", user.id)` before upload |
| `POST /api/entries/[id]/paints` | [`paints/index.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id]/paints/index.ts) | `loadEntryExists` only (RLS) |
| `POST /api/entries/[id]/paints/[paintId]` | [`paints/[paintId].ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id]/paints/[paintId].ts) | RLS on update |
| `POST .../paints/[paintId]/delete` | [`paints/[paintId]/delete.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id]/paints/[paintId]/delete.ts) | RLS on delete; `!data` → "Paint not found" |
| `POST /api/entries/[id]/steps` | [`steps/index.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id]/steps/index.ts) | `loadEntryExists` only (RLS) |
| `POST .../steps/[stepId]` | [`steps/[stepId].ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id]/steps/[stepId].ts) | RLS + RPCs |
| `POST .../steps/[stepId]/delete` | [`steps/[stepId]/delete.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id]/steps/[stepId]/delete.ts) | RLS + RPC |
| `POST .../steps/[stepId]/move` | [`steps/[stepId]/move.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id]/steps/[stepId]/move.ts) | RLS + RPC |

#### Cross-user behavior (User B → User A's `ENTRY_A`)

[`loadEntryExists`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/lib/entry-paints-page.ts#L25-L29) queries `entries` by `id` only — **no explicit `user_id` filter**. Under RLS, User B sees no row → returns `false` → handlers redirect to `/entries?error=Entry%20not%20found`.

[`loadEntryForEdit`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/lib/entries-page.ts#L87-L98) (detail page) behaves the same: null → page redirects to entry-not-found URL ([`[id].astro`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/entries/[id].astro#L29-L31)).

[`[id].ts` update](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/entries/[id].ts#L36-L46): explicit `.eq("user_id", user.id)` → `!data` → redirect with `error=Entry not found` (not a generic 403).

**IDOR test oracle (corrected)**: assert redirect `Location` is **not** a success path (`?saved=1`, `?added=1`, `?deleted=1`, `?status_changed=`) and is one of:

- `/auth/signin` (unauthenticated)
- `/entries?error=...` or `/entries/{id}/edit?error=...` with "Entry not found" / "Paint not found" (authenticated wrong user)

Do **not** assert HTTP status 403 or 404 unless the product contract changes.

### Auth cookie shape and sign-in path

[`src/pages/api/auth/signin.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/pages/api/auth/signin.ts): `signInWithPassword` then redirect `/entries`. Cookies are set via `createServerClient` `setAll` in [`src/lib/supabase.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/src/lib/supabase.ts).

For automated tests, **POST sign-in is preferred** over hand-copying `.cookies`:

```http
POST /api/auth/signin
Content-Type: application/x-www-form-urlencoded
Origin: http://localhost:4321

email=seed@paint-ledger.local&password=seed-password-123
```

[`context/foundation/lessons.md`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/context/foundation/lessons.md): **`Origin` header required** on POST or Astro returns 403 CSRF — not an auth failure.

Seed users: [`tests/helpers/seed-fixtures.ts`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/tests/helpers/seed-fixtures.ts) — `USER_A`, `USER_B`, `ENTRY_A` (Phase 1).

### Existing test infrastructure

| Artifact | Phase 2 relevance |
|----------|-------------------|
| `tests/integration/rls-isolation.test.ts` | Proves Risk #1/#7 at DB layer; **does not** hit HTTP/middleware |
| `tests/helpers/supabase-client.ts` | `signInAs` for Supabase JS client only — not HTTP cookies |
| `vitest.config.ts` | Node env; loads `.env` for Supabase; no `APP_URL` |
| No `tests/integration/*http*` files | Gap to fill |
| CI | Still lint + build only (Phase 4 wires `npm test`) |

### Recommended Phase 2 test design (cheapest layer)

**File**: `tests/integration/auth-route-protection.test.ts` (or split auth vs idor siblings).

**Prerequisites helper** `tests/helpers/http-client.ts` (proposed):

- `requireDevServer(baseUrl = process.env.APP_URL ?? "http://localhost:4321")` — `fetch` root or `/entries` without auth; fail fast with "run npm run dev"
- `signInViaHttp(email, password)` — POST `/api/auth/signin` with `Origin`, `redirect: "manual"`, return `Cookie` header string
- `APP_ORIGIN` constant matching dev server

**Risk #3 cases** (minimum):

| Case | Request | Expected |
|------|---------|----------|
| Unauth page | `GET /entries` | 302 → `/auth/signin` |
| Unauth detail | `GET /entries/{ENTRY_A.id}` | 302 → `/auth/signin` |
| Unauth API | `POST /api/entries/{id}` (minimal form + Origin) | 302 → `/auth/signin` |
| Auth page | `GET /entries` with User A cookie | 200 |
| Auth detail | `GET /entries/{ENTRY_A.id}` with User A cookie | 200 |

**Risk #6 cases** (minimum — representative routes, not all 14):

| Case | Actor | Request | Expected |
|------|-------|---------|----------|
| Cross-user update | User B | `POST /api/entries/{ENTRY_A.id}` with title change | Redirect **not** `?saved=1`; Location contains `error=` or entry-not-found |
| Cross-user paint add | User B | `POST /api/entries/{ENTRY_A.id}/paints` | Redirect to `/entries?error=Entry not found` (or paints URL with error) |
| Cross-user page | User B | `GET /entries/{ENTRY_A.id}` | 302 to `/entries?error=Entry not found` (page redirect, not 200 with A's data) |

Optional DB assertion after HTTP IDOR POST: User A's row unchanged (reuse `readEntryAs` from RLS suite) — adds signal beyond redirect alone.

**Anti-patterns to avoid** (from test-plan):

- Testing sign-in form HTML only
- Asserting 403/404 status codes (wrong contract)
- Only unauthenticated IDOR cases (authenticated User B is the real IDOR scenario)
- Mocking Supabase in HTTP tests

### Risk response guidance — verification

| Risk | Guidance verdict | Correction |
|------|------------------|------------|
| #3 | **Confirmed** | Middleware + `PROTECTED_ROUTES`; redirect not 401; need dev server |
| #6 | **Confirmed behavior, revise oracle** | Replace "403/404" with redirect-denial contract; RLS is backstop |
| Cheapest layer | **Confirmed** | HTTP Vitest + cookie via sign-in POST; not e2e Playwright |
| Challenge: auth API ≠ route coverage | **Valid** | Must test `/entries` and `/api/entries` unauthenticated |
| Challenge: RLS alone | **Valid for HTTP** | Redirect shape is app contract; DB already tested in Phase 1 |

## Code References

- `src/middleware.ts:5` — `PROTECTED_ROUTES` definition
- `src/middleware.ts:27-30` — unauthenticated redirect to sign-in
- `src/lib/entries-api.ts:63-68` — `requireUser` (session only)
- `src/lib/entry-paints-page.ts:25-29` — `loadEntryExists` (RLS-scoped)
- `src/pages/api/entries/[id].ts:36-46` — explicit `user_id` on update
- `src/pages/api/entries/[id]/paints/index.ts:26-29` — cross-user → entry not found
- `tests/integration/rls-isolation.test.ts` — Phase 1 floor (no HTTP)
- `tests/helpers/seed-fixtures.ts` — `USER_A`, `USER_B`, `ENTRY_A`
- `context/foundation/lessons.md` — Origin header for POST; PROTECTED_ROUTES rule

## Architecture Insights

1. **Two-layer auth**: middleware checks session presence; RLS checks row ownership. Handlers rarely emit HTTP error codes — UX is redirect-with-query-param.
2. **Consistency gap**: some handlers use explicit `user_id` filters (`[id].ts`, `final-photo.ts`, `changeEntryStatus`); others rely on `loadEntryExists` + RLS only. Both are safe today because RLS is the real boundary; HTTP tests should pick one of each style.
3. **Phase 2 depends on runtime stack**: unlike Phase 1, HTTP tests need Astro dev server with `.env` secrets — same as manual AGENTS.md curl workflow.

## Historical Context (from prior changes)

- [`context/archive/2026-06-11-testing-runner-bootstrap-rls-floor/research.md`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/context/archive/2026-06-11-testing-runner-bootstrap-rls-floor/research.md) — explicitly deferred HTTP (#3, #6) to Phase 2; confirmed Vitest + local Supabase pattern.
- [`context/archive/2026-06-10-entry-list-and-detail/plan.md`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/context/archive/2026-06-10-entry-list-and-detail/plan.md) — status-change CSRF / Origin lesson for form POST APIs.
- [`context/foundation/lessons.md`](https://github.com/mraubo/paint-ledger/blob/4aaf71fb4b1ccb99bd4e52f00b840c38f2b5647c/context/foundation/lessons.md) — register every new route in `PROTECTED_ROUTES`.

## Related Research

- `context/archive/2026-06-11-testing-runner-bootstrap-rls-floor/research.md` — RLS floor, seed users, Vitest harness
- `context/foundation/test-plan.md` §2 risks #3, #6 and §3 Phase 2

## Open Questions

1. **CI for Phase 2**: HTTP tests need `astro dev` in CI or are local-only until Phase 4? Recommend **local-only guard** (`requireDevServer`) with skip message; wire CI in Phase 4 with documented dev-server strategy.
2. **Coverage breadth**: test all 14 POST routes vs representative matrix? Recommend **3–4 representative routes** (update basics, paint create, step create, status change) plus 2 page GETs — enough signal without 14 near-duplicate redirect assertions.
3. **Backport to test-plan §2**: Risk #6 "403/404" wording should be updated to redirect-denial contract — defer to user confirmation per `/10x-test-plan` post-research backport check.

## Test-plan backport candidates

Research suggests these §2 corrections (evidence-only, no file anchors):

| Item | Suggested change |
|------|------------------|
| Risk #6 wording | "API rejects cross-user `entry_id` with **redirect denial** (sign-in or not-found error URL), never success redirect with data" |
| Risk #6 response guidance | Replace "403/404" in "What would prove protection" with redirect `Location` assertions |
| Risk #3 response guidance | Note unauthenticated API also gets **302 to sign-in**, not 401 |
