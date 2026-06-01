# Account Auth Shell Implementation Plan

## Overview

Harden the existing Supabase auth scaffold so future entry workflows (S-02–S-06) ship under a protected `/entries` prefix with a shared authenticated layout. Replace the starter `/dashboard` demo with `/entries` as the post-login home, and close the gap where only `/dashboard` was guarded in middleware.

## Current State Analysis

**Already in place:**

- Supabase SSR client (`src/lib/supabase.ts`) with cookie handling via `astro:env` secrets.
- Middleware sets `context.locals.user` and guards `PROTECTED_ROUTES` (currently only `["/dashboard"]`) — see `src/middleware.ts:4-22`.
- Sign in/up/out API routes and React forms under `src/pages/api/auth/*` and `src/components/auth/*`.
- `Topbar.astro` shows email + Dashboard link when authenticated (`src/components/Topbar.astro`).
- Starter protected page at `src/pages/dashboard.astro`.

**Gaps for S-01:**

- No `/entries` route prefix or `AppLayout` for authenticated app pages.
- Post-login redirect goes to `/` (`src/pages/api/auth/signin.ts:19`), not the app shell.
- Logged-in users can still open `/auth/signin` and `/auth/signup`.
- Roadmap risk: entry routes added later without updating `PROTECTED_ROUTES` would leak without auth.

**FR-002 note:** Owner-only data access is enforced at Postgres RLS in **F-01** (`paint-log-schema-rls`). This slice delivers route-level protection and navigation shell only.

### Key Discoveries

- `PROTECTED_ROUTES` uses `pathname.startsWith(route)` — prefix entries like `"/entries"` protect nested paths (`/entries/123`) without listing each route (`src/middleware.ts:18`).
- `createClient()` returns `null` when secrets are missing; middleware then treats everyone as unauthenticated — existing README warning applies.
- No test suite; AGENTS.md requires manual auth smoke per protected prefix after routing changes.

## Desired End State

- Unauthenticated `GET /entries` (and nested paths under `/entries`) → redirect to `/auth/signin`.
- Authenticated user after sign-in → lands on `/entries`.
- Logged-in user visiting `/auth/signin` or `/auth/signup` → redirect to `/entries`.
- `/dashboard` removed (no middleware redirect — app is local-only for now).
- `AppLayout.astro` provides shared shell (Topbar + slot) for S-02+ pages to adopt.
- Minimal `src/pages/entries/index.astro` exists only as the redirect/post-login target (not a feature placeholder).
- `PROTECTED_ROUTES` documents `/entries`; README auth table updated.

### Verification

For each prefix in `PROTECTED_ROUTES`: unauthenticated request redirects; authenticated session returns 200 on the protected page. Plus `npm run lint` and `npm run build`.

## What We're NOT Doing

- Postgres schema, migrations, or RLS (F-01).
- Entry CRUD UI, list, or detail (S-02–S-06).
- OAuth / social login, password reset, or email-confirm flow changes.
- New automated test suite (none exists in repo).
- Full navigation skeleton, empty states, or marketing home redesign.
- API routes under `/api/entries` (future slices).

## Implementation Approach

Two phases: (1) middleware and auth redirect behavior, (2) layout shell and route swap. Keep changes aligned with existing patterns (form POST auth, `Layout.astro` for public pages, new `AppLayout` for protected app pages).

## Critical Implementation Details

**Post-login target must exist.** User chose layout-only (no placeholder UX), but redirects to `/entries` require a routable page. Ship a minimal `entries/index.astro` (title + one line) inside `AppLayout` — not a product placeholder.

**Middleware ordering:** Resolve session → redirect authenticated users away from auth pages → enforce `PROTECTED_ROUTES` → `next()`.

## Phase 1: Protection and session routing

### Overview

Extend middleware, update auth API redirect, and redirect logged-in users away from sign-in/up.

### Changes Required

#### 1. Middleware

**File**: `src/middleware.ts`

**Intent**: Guard `/entries` instead of `/dashboard`; send authenticated users away from auth pages.

**Contract**:

- `PROTECTED_ROUTES` becomes `["/entries"]`.
- New constant e.g. `AUTH_ONLY_GUEST_ROUTES = ["/auth/signin", "/auth/signup"]` — if `context.locals.user` and pathname starts with one of these, `redirect("/entries")`.

#### 2. Sign-in success redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: After successful `signInWithPassword`, send user to the app shell home.

**Contract**: Change redirect target from `"/"` to `"/entries"` (line ~19).

#### 3. Remove dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Delete starter demo; `/entries` replaces it per plan decisions.

**Contract**: File removed from `src/pages/`.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run build` passes (with `SUPABASE_URL` and `SUPABASE_KEY` set per CI)

#### Manual Verification

- `GET /entries` without session → 302 to `/auth/signin`
- Sign in → browser lands on `/entries`
- While signed in, `GET /auth/signin` → redirect to `/entries`
**Implementation Note**: Pause for human confirmation after manual checks before Phase 2.

---

## Phase 2: App shell layout and route target

### Overview

Introduce `AppLayout` with `Topbar`, minimal `/entries` page, and update navigation references.

### Changes Required

#### 1. App layout

**File**: `src/layouts/AppLayout.astro` (new)

**Intent**: Shared authenticated shell: cosmic background, `Topbar`, centered content slot — pattern extracted from `dashboard.astro` without duplicating sign-out (Topbar already has sign out).

**Contract**: Props: `title?: string`. Renders `<Layout title={title}>` from `src/layouts/Layout.astro`, inner wrapper with `Topbar` + `<slot />`.

#### 2. Entries route target

**File**: `src/pages/entries/index.astro` (new)

**Intent**: Minimal protected home required for post-login and auth-guest redirects; S-02 will replace content.

**Contract**: Uses `AppLayout`; single heading (e.g. "Entries") and short line that entry workflows come in a later slice — no forms or data fetching.

#### 3. Topbar navigation

**File**: `src/components/Topbar.astro`

**Intent**: Link to app home at `/entries` instead of `/dashboard`.

**Contract**: Replace `href="/dashboard"` and label "Dashboard" with "Entries" (or "Paint log") pointing to `/entries`.

#### 4. Documentation

**Files**: `README.md` (auth routes table), optionally `context/changes/account-auth-shell/change.md` notes if status-only

**Intent**: Document `/entries` as protected app home; remove `/dashboard` from the table.

**Contract**: Auth routes table lists `/entries`; protection instructions reference `/entries` prefix.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification

- Signed-in `/entries` shows Topbar with email and Entries link; sign out works
- Public `/` (home) still accessible when signed in
- Topbar "Entries" navigates to `/entries`
- No broken links to `/dashboard` in UI (grep confirms)

**Implementation Note**: Pause for human confirmation after manual checks.

---

## Testing Strategy

### Unit Tests

None planned — repo has no test harness.

### Integration Tests

None planned.

### Manual Testing Steps

1. Clear cookies / use private window → visit `/entries` → expect redirect to sign-in.
2. Sign up or sign in → expect `/entries` with 200 and Topbar visible.
3. Visit `/auth/signin` while logged in → expect redirect to `/entries`.
4. Sign out from Topbar → `/entries` redirects to sign-in again.
5. Run `npm run lint` and `npm run build`.

## Performance Considerations

No meaningful impact — middleware adds two lightweight pathname checks. SSR auth call already runs per request.

## Migration Notes

No data migration. Deploy is code-only.

## References

- Roadmap S-01: `context/foundation/roadmap.md` (slice **S-01**, change-id `account-auth-shell`)
- PRD FR-001, FR-002: `context/foundation/prd.md`
- AGENTS.md protected-route verification convention
- Existing middleware: `src/middleware.ts`
- GitHub issue [#3](https://github.com/mraubo/paint-ledger/issues/3)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Protection and session routing

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npm run build` passes

#### Manual

- [x] 1.3 Unauthenticated `/entries` redirects; sign-in lands on `/entries`; auth pages redirect when logged in

### Phase 2: App shell layout and route target

#### Automated

- [ ] 2.1 `npm run lint` passes
- [ ] 2.2 `npm run build` passes

#### Manual

- [ ] 2.3 `/entries` shows AppLayout + Topbar; sign out works; no broken `/dashboard` links
