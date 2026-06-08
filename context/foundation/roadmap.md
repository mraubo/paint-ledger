---
project: "Paint Ledger"
version: 1
status: draft
created: 2026-05-27
updated: 2026-06-08
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Paint Ledger

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Hobbysta malujący modele nie ma jednego miejsca na proces malowania — kroki, farby, zdjęcia i pochodzenie modelu lądują w notatkach, Discordzie i folderach, więc po czasie trudno odtworzyć przepis. Paint Ledger ma być prostym paint logiem: jeden wpis łączy tutorial, przepis kolorystyczny i notatkę warsztatową w jednym miejscu.

## North star

**S-06: Entry list and detail recall** — user can browse saved entries and open a detail view that reconstructs the full painting recipe without external notes.

> **Gwiazda przewodnia** — najmniejszy sensowny przepływ end-to-end, którego udane dowiezienie potwierdza główną hipotezę produktu (tutaj: US-01 — kompletny wpis można dodać i później odtworzyć). Umieszczamy ją tak wcześnie, jak pozwalają zależności; w tej sekwencji domyka ją S-06 po slice'ach tworzących treść wpisu.

Powiązanie z celem **speed**: nie odkładamy listy i podglądu na koniec poza ścieżką must-have — S-06 jest ostatnim krokiem łańcucha, ale każdy wcześniejszy slice jest minimalny i pionowy, bez poziomego „warstwowania” UI/API/schematu osobno.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | paint-log-schema-rls | (foundation) paint log schema and owner-only RLS in Postgres | — | FR-002, NFR (privacy) | done |
| F-02 | photo-storage-buckets | (foundation) Supabase Storage buckets and policies for step and final photos | F-01 | FR-009, FR-010, NFR (privacy) | done |
| S-01 | account-auth-shell | sign up, log in, sign out, and reach protected app shell | — | FR-001, FR-002 | done |
| S-02 | entry-draft-and-origin | create a draft entry with basics and a custom model origin note | F-01, S-01 | FR-003, FR-004 | proposed |
| S-03 | entry-paint-palette | define an entry-level paint list with approximate color picker | S-02, F-01 | FR-005 | proposed |
| S-04 | steps-with-paint-cards | add ordered steps, assign paints from the entry list, and see paint cards on steps | S-03 | FR-006, FR-007, FR-008 | proposed |
| S-05 | entry-step-and-final-photos | attach one optional photo per step and at least one final model photo | S-04, F-02 | FR-009, FR-010 | proposed |
| S-06 | entry-list-and-detail | browse saved entries in a simple list and open full detail recall | S-05 | FR-011, FR-012, US-01 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Konto | `S-01` | Auth scaffold present; extend protected routes for future entry pages. Parallel with `F-01`. |
| B | Fundament danych i mediów | `F-01` → `F-02` | Unblocks all entry persistence and photo upload (`S-05`). |
| C | Przepis paint log | `S-02` → `S-03` → `S-04` → `S-05` → `S-06` | Joins Stream B after `F-01`; `S-05` joins Stream B at `F-02`. North star at `S-06`. |

## Baseline

What's already in place in the codebase as of `2026-05-27` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6, React 19, Tailwind 4, shadcn-style UI (`package.json`, `astro.config.mjs`)
- **Backend / API:** partial — Astro SSR and auth API routes (`src/pages/api/auth/*`); no entry/paint/step handlers
- **Data:** absent — `supabase/config.toml` only; no `supabase/migrations/` or paint-log schema/RLS
- **Auth:** partial — Supabase SSR client (`src/lib/supabase.ts`), middleware with `/dashboard` guard (`src/middleware.ts`), sign in/up/out flows
- **Deploy / infra:** partial — Cloudflare adapter and `wrangler.jsonc`; CI lint+build (`.github/workflows/ci.yml`); no deploy workflow yet
- **Observability:** absent — no error tracking or structured logging integration

## Foundations

### F-01: Paint log schema and RLS

- **Outcome:** (foundation) Postgres tables for entries, entry paints, and ordered steps exist with owner-only row-level security.
- **Change ID:** paint-log-schema-rls
- **PRD refs:** FR-002, Business Logic, NFR (private-by-default entries)
- **Unlocks:** S-02, S-03, S-04, S-05, S-06
- **Prerequisites:** —
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Without schema and RLS, no vertical slice can persist private entries — blocks the entire must-have path under a 3-week after-hours budget.
- **Status:** done

### F-02: Photo storage buckets

- **Outcome:** (foundation) Supabase Storage buckets and policies allow authenticated owners to upload step and final photos scoped to their entries.
- **Change ID:** photo-storage-buckets
- **PRD refs:** FR-009, FR-010, NFR (privacy)
- **Unlocks:** S-05
- **Prerequisites:** F-01
- **Parallel with:** S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Photo FRs are must-have for US-01; deferring storage setup compresses calendar risk into S-05 — sequenced after schema so policies can reference entry ownership.
- **Status:** done

## Slices

### S-01: Account auth shell

- **Outcome:** user can sign up, log in, sign out, and access a protected app shell that will host entry workflows.
- **Change ID:** account-auth-shell
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Auth scaffold exists but only `/dashboard` is protected — extend `PROTECTED_ROUTES` before entry routes ship to avoid a window where entry pages leak without auth.
- **Status:** done

### S-02: Entry draft and origin

- **Outcome:** user can create a draft entry with title, short description, model information, and a custom model origin note.
- **Change ID:** entry-draft-and-origin
- **PRD refs:** FR-003, FR-004
- **Prerequisites:** F-01, S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** First user-visible persistence slice — keep form minimal (no structured origin fields) to protect the 3-week after-hours budget.
- **Status:** proposed

### S-03: Entry paint palette

- **Outcome:** user can define an entry-level paint list with name, brand, color description, and approximate color from a picker.
- **Change ID:** entry-paint-palette
- **PRD refs:** FR-005
- **Prerequisites:** S-02, F-01
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Color picker UX can expand scope — ship plain input + picker per PRD Socrates resolution, not a paint catalog.
- **Status:** proposed

### S-04: Steps with paint cards

- **Outcome:** user can add ordered tutorial steps with descriptions, assign paints from the entry list (including inline add to the list), and see paint name and approximate color on each step.
- **Change ID:** steps-with-paint-cards
- **PRD refs:** FR-006, FR-007, FR-008
- **Prerequisites:** S-03
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Core product invariant (entry paint list is source of truth for step assignments) must be enforced in API and UI together — partial enforcement here breaks recall in S-06.
- **Status:** proposed

### S-05: Entry step and final photos

- **Outcome:** user can attach up to one optional photo per tutorial step and at least one final model photo in a separate result area.
- **Change ID:** entry-step-and-final-photos
- **PRD refs:** FR-009, FR-010
- **Prerequisites:** S-04, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Upload + resize + error handling is the main integration surface — keep one photo per step cap to avoid media scope creep.
- **Status:** proposed

### S-06: Entry list and detail recall

- **Outcome:** user can browse saved entries in a simple list and open a detail view showing model info, origin note, paint list, ordered steps with assigned paint cards, step photos, and final photo — completing US-01 end-to-end.
- **Change ID:** entry-list-and-detail
- **PRD refs:** FR-011, FR-012, US-01
- **Prerequisites:** S-05
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** North star / validation milestone — proves primary Success Criteria (add complete entry, reopen without external notes). List stays minimal (no search/filter per Non-Goals).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | GitHub | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|---|
| F-01 | paint-log-schema-rls | [#2](https://github.com/mraubo/paint-ledger/issues/2) | Paint log Postgres schema and owner RLS | no | Blocks all entry slices |
| F-02 | photo-storage-buckets | [#4](https://github.com/mraubo/paint-ledger/issues/4) | Supabase Storage for step and final photos | no | After F-01 |
| S-01 | account-auth-shell | [#3](https://github.com/mraubo/paint-ledger/issues/3) | Extend auth shell and protected routes for entries | yes | Scaffold present; harden before entry routes |
| S-02 | entry-draft-and-origin | [#5](https://github.com/mraubo/paint-ledger/issues/5) | Create draft entry with model origin note | no | After F-01 |
| S-03 | entry-paint-palette | [#6](https://github.com/mraubo/paint-ledger/issues/6) | Entry-level paint list with color picker | no | After S-02 |
| S-04 | steps-with-paint-cards | [#7](https://github.com/mraubo/paint-ledger/issues/7) | Ordered steps with paint assignment and cards | no | After S-03 |
| S-05 | entry-step-and-final-photos | [#8](https://github.com/mraubo/paint-ledger/issues/8) | Step and final photo upload | no | After F-02 and S-04 |
| S-06 | entry-list-and-detail | [#9](https://github.com/mraubo/paint-ledger/issues/9) | Entry list and full detail recall (US-01) | no | North star; after S-05 |

## Open Roadmap Questions

(No cross-cutting questions beyond PRD — PRD `## Open Questions` records none captured.)

## Parked

- **Advanced tagging, filtering, and full-text search** — Why parked: PRD §Non-Goals; pressure at 100x scale only.
- **Community features** — Why parked: PRD §Non-Goals.
- **Automatic paint recognition or intelligent step suggestions** — Why parked: PRD §Non-Goals.
- **Expanded manufacturer or paint catalog** — Why parked: PRD §Non-Goals.
- **Pro-level editor** — Why parked: PRD §Non-Goals.
- **Offline-first, native mobile, or cross-platform sync** — Why parked: PRD §Non-Goals.
- **Paint inventory, model wishlist, or collection management** — Why parked: PRD §Non-Goals.
- **Tutorial versioning, recipe comparison, paint scaling, or shopping checklist** — Why parked: PRD §Non-Goals.
- **Observability baseline (Sentry/OTel)** — Why parked: speed goal; add after US-01 validates unless production errors force earlier.
- **CSRF protection for cookie-session form POSTs** — Why parked: S-01/S-02 use native `method="POST"` + redirect (parity with auth); add token middleware or `SameSite=Strict` hardening before production exposure or when adding more state-changing forms.

## Done

- **F-02: (foundation) Supabase Storage buckets and policies allow authenticated owners to upload step and final photos scoped to their entries.** — Archived 2026-06-08 → `context/archive/2026-06-08-photo-storage-buckets/`. Lesson: —.
- **F-01: (foundation) Postgres tables for entries, entry paints, and ordered steps exist with owner-only row-level security.** — Archived 2026-06-08 → `context/archive/2026-06-08-paint-log-schema-rls/`. Lesson: —.
- **S-01: user can sign up, log in, sign out, and access a protected app shell that will host entry workflows.** — Archived 2026-06-02 → `context/archive/2026-06-01-account-auth-shell/`. Lesson: —.
