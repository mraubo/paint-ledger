# Account Auth Shell — Plan Brief

> Full plan: `context/changes/account-auth-shell/plan.md`
> Change notes: `context/changes/account-auth-shell/change.md`

## What & Why

Paint Ledger needs a protected app shell before entry workflows ship. S-01 hardens auth routing: guard `/entries`, redirect signed-in users away from auth forms, and replace the starter `/dashboard` demo with `/entries` as the post-login home — so S-02+ pages never ship unprotected.

## Starting Point

Supabase auth works (sign up, sign in, sign out). Middleware only protects `/dashboard`. No `/entries` routes or shared app layout. Sign-in success redirects to `/`.

## Desired End State

Authenticated users land on `/entries` inside `AppLayout` with `Topbar`. `/entries/**` requires a session. Auth pages redirect when already logged in. `/dashboard` is removed (no middleware redirect). `PROTECTED_ROUTES` is ready for S-02 entry pages under the same prefix.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Protected prefix | `/entries` | Matches PRD entry wording; `startsWith` covers nested routes | Plan |
| Post-login destination | `/entries` | Lands in app shell, not marketing home | Plan |
| Shell deliverable | Layout + minimal route target | User wanted layout-only; redirects require a routable page | Plan |
| Logged-in on auth pages | Redirect to `/entries` | Avoid confusing duplicate sign-in | Plan |
| Dashboard | Delete; `/entries` replaces it | Single protected home | Plan |
| FR-002 enforcement | Route guard only here | RLS ships in F-01 | Plan |

## Scope

**In scope:**

- `PROTECTED_ROUTES` → `/entries`
- Middleware guest/auth redirects
- `AppLayout.astro`, minimal `/entries` page, Topbar link update
- Sign-in API redirect to `/entries`
- Remove `dashboard.astro`, README auth table update

**Out of scope:**

- Database schema / RLS (F-01)
- Entry CRUD, list, detail (S-02+)
- OAuth, password reset, email confirm changes
- Automated tests

## Architecture / Approach

```
Request → middleware (session → auth-page redirect → PROTECTED_ROUTES check) → page
Public pages: Layout.astro (/, /auth/*)
App pages: AppLayout.astro (Topbar + slot) under /entries/*
```

Auth remains form POST → API route → cookie session via `@supabase/ssr`. No new dependencies.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Protection and session routing | `/entries` guarded; auth redirects; dashboard removed | Missing secrets → silent no-auth (existing) |
| 2. App shell layout and route target | `AppLayout`, minimal `/entries`, Topbar, docs | Minimal page mistaken for S-02 scope creep |

**Prerequisites:** Supabase env configured locally (`.env`, `.dev.vars`) for manual auth smoke.

**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- FR-002 data isolation depends on F-01 RLS; this slice only blocks unauthenticated route access.
- Production auth requires Worker secrets; unchanged from current deployment docs.
- S-02 will adopt `AppLayout` for new pages under `/entries`.

## Success Criteria (Summary)

- Unauthenticated users cannot access `/entries`.
- Sign-in → `/entries`; signed-in users cannot stay on sign-in/up.
- `npm run lint` and `npm run build` pass.
