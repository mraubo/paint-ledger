# Entry Draft and Origin Implementation Plan

## Overview

Deliver S-02: the first user-visible persistence slice. Authenticated users create draft paint log entries with title, description, model information, and a custom model origin note (FR-003, FR-004), browse a minimal entry list, and edit basics — all via native form POST + redirect, matching the established auth mutation pattern.

## Current State Analysis

**Already in place:**

- `entries` table with `title`, `description`, `model_info`, `model_origin_note`, `status` (`draft | ready`, default `draft`), and owner-only RLS (`supabase/migrations/20260608103251_paint_log_schema.sql`).
- Generated types in `src/lib/database.types.ts` (`entries` Insert/Row shapes).
- SSR Supabase client (`src/lib/supabase.ts`) with cookie session.
- Protected `/entries` prefix, `AppLayout.astro`, `Topbar`, post-login redirect to `/entries` (archived S-01).
- Auth form primitives: `FormField`, `SubmitButton`, `ServerError` (`src/components/auth/`).
- Auth API pattern: form POST → `APIRoute` → Supabase → redirect with `?error=` (`src/pages/api/auth/signin.ts`).

**Gaps for S-02:**

- `/entries/index.astro` is a placeholder with no data or navigation to create.
- No `/entries/new` or `/entries/[id]` routes.
- No `/api/entries` handlers.
- `/api/entries` not in `PROTECTED_ROUTES` (`src/middleware.ts:5`).
- No entry form components; `FormField` is input-only (no textarea).
- Zero `.from("entries")` queries in `src/`.

### Key Discoveries

- F-01 explicitly deferred entry CRUD to S-02+ (`context/archive/2026-06-08-paint-log-schema-rls/plan.md`).
- `lessons.md` requires explicit auth decision for every new route — add `/api/entries` to middleware.
- PRD FR-004: one freeform `model_origin_note` field, not structured origin sub-fields.
- PRD FR-003 mentions `published` status; F-01 enum is `draft | ready` only — status toggle out of scope.
- `title` is the only NOT NULL user-facing field; other text columns default to `''`.
- `user_id` must be set server-side on insert; RLS `WITH CHECK` rejects mismatched owner.

## Desired End State

After S-02:

- Signed-in user visits `/entries` and sees either an empty state with a "Create entry" CTA or a list of their entries (title link, read-only "Draft" badge, updated date).
- User creates an entry at `/entries/new` with four fields; only title is required.
- Successful create redirects to `/entries?created=<id>` with a green confirmation banner.
- User opens `/entries/[id]` to edit basics; successful save redirects to `/entries/[id]?saved=1` with a green banner.
- `POST /api/entries` and `POST /api/entries/[id]` handle browser form submissions; unauthenticated requests are blocked by middleware and handler.
- New rows default to `status = 'draft'` with no status control in forms.
- `npm run lint` and `npm run build` pass.

### Verification

- Manual: sign in → create entry → see list row with Draft badge → edit → see saved banner.
- Manual RLS: second user cannot read or update first user's entry (404 or empty via RLS).
- curl (optional): authenticated `POST` to `/api/entries` with form fields creates a row (per AGENTS.md `.cookies` pattern).

## What We're NOT Doing

- Status toggle (`draft` → `ready`) — badge is read-only.
- `published` enum or migration.
- Delete entry.
- Paints, steps, photos, full detail recall (S-03–S-06).
- JSON `fetch`-based SPA save flow (browser uses form POST; JSON response shapes optional for future agent/curl use).
- Search, filter, pagination on list.
- Automated test suite (none exists in repo).
- Remote branch reuse — fresh implementation from this plan.

## Implementation Approach

Three phases mirroring S-01: (1) API + route protection with curl-verifiable create, (2) shared React form component, (3) Astro pages with SSR reads and success banners. Writes always go through API routes; reads use Supabase in Astro frontmatter (RLS-scoped, no GET API surface).

## Critical Implementation Details

**HTML forms cannot PATCH.** Browser edit submissions use `POST` to `/api/entries/[id]`. The handler performs an `.update()` scoped to `id` + session user.

**`user_id` is never a form field.** Derive from `supabase.auth.getUser()` in the handler; pass to `.insert()`. RLS rejects client-supplied wrong owner.

**POST-redirect-GET for success.** After create or update, redirect with query flags (`?created=`, `?saved=1`) so refresh does not resubmit the form.

## Phase 1: API and route protection

### Overview

Establish mutation endpoints and shared server helpers. Gate with middleware and per-handler `getUser()`. Verify create via curl before building UI.

### Changes Required:

#### 1. Middleware protection

**File**: `src/middleware.ts`

**Intent**: Extend `PROTECTED_ROUTES` so `/api/entries` handlers are unreachable without a session, per `lessons.md`.

**Contract**: `PROTECTED_ROUTES` array includes `"/api/entries"` alongside `"/entries"`. Prefix matching covers `/api/entries` and `/api/entries/[id]`.

#### 2. Shared entry API helpers

**File**: `src/lib/entries-api.ts` (new)

**Intent**: Centralize form parsing, title validation, auth guard, and entry ID format check so both API routes stay consistent.

**Contract**:

- `EntryBasicsFields`: `{ title, description, model_info, model_origin_note }` — all strings; missing form keys coerce to `""`.
- `parseEntryBasicsFormData(formData: FormData)`: returns fields or throws/returns error if title trim is empty.
- `requireUser(supabase)`: returns `user` or `null`.
- `isValidEntryId(id: string)`: UUID format guard for `[id]` route param.
- `toEntrySummary(row)`: `{ id, title, status, updated_at }` for optional JSON responses.

#### 3. Create entry API

**File**: `src/pages/api/entries/index.ts` (new)

**Intent**: Accept form POST from create flow; insert draft entry owned by session user; redirect to list with success flag.

**Contract**:

- `POST` only.
- Parse `formData()` via `parseEntryBasicsFormData`.
- On missing user → redirect `/auth/signin`.
- On validation error → redirect `/entries/new?error=<encoded>`.
- On DB error → redirect `/entries/new?error=<encoded>`.
- On success → `.insert({ title, description, model_info, model_origin_note, user_id: user.id })` (omit `status` → DB default `draft`); redirect `/entries?created=<id>`.

#### 4. Update entry API

**File**: `src/pages/api/entries/[id].ts` (new)

**Intent**: Accept form POST from edit flow; update basics for owned entry; redirect with saved flag.

**Contract**:

- `POST` only (browser edit; not PATCH).
- Validate `id` param with `isValidEntryId`; invalid → redirect `/entries?error=...`.
- On missing user → redirect `/auth/signin`.
- On validation error → redirect `/entries/[id]?error=<encoded>`.
- `.update({ title, description, model_info, model_origin_note }).eq("id", id)` — RLS enforces ownership; zero rows → redirect with not-found error.
- On success → redirect `/entries/[id]?saved=1`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Type checking passes as part of build

#### Manual Verification:

- Unauthenticated `POST /api/entries` redirects to sign-in (middleware)
- Authenticated curl/form POST creates a row visible in Supabase Studio with `status = draft` and correct `user_id`
- Authenticated POST to `/api/entries/[id]` updates owned entry; wrong UUID or other user's id fails gracefully

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Entry basics form

### Overview

Build the shared React form for create and edit modes, reusing auth form primitives and adding a textarea field for longer text.

### Changes Required:

#### 1. Textarea field primitive

**File**: `src/components/auth/TextareaField.tsx` (new)

**Intent**: Multiline input matching `FormField` visual language (icon, error ring, `pl-10` padding pattern).

**Contract**: Props mirror `FormField` where applicable (`id`, `name`, `label`, `value`, `onChange`, `placeholder`, `error`, `icon`). Renders `<textarea>` with same border/focus classes as `FormField` input base.

#### 2. Entry basics form

**File**: `src/components/entries/EntryBasicsForm.tsx` (new)

**Intent**: Single form component for create and edit with client-side title validation and server error display.

**Contract**:

- Discriminated props: `{ mode: "create"; serverError? }` | `{ mode: "edit"; entryId: string; initialValues: EntryBasicsFields; serverError? }`.
- Fields: `title` (`FormField`), `description` (`TextareaField`), `model_info` (`FormField`), `model_origin_note` (`TextareaField` with hint text per PRD examples).
- Client validation: title trim required; block submit via `e.preventDefault()` when invalid.
- `method="POST"`; `action` = `/api/entries` (create) or `/api/entries/${entryId}` (edit).
- Reuse `ServerError`, `SubmitButton`; `noValidate` on form.
- Submit button label: "Create entry" / "Save changes".

#### 3. FormField name attribute (if needed)

**File**: `src/components/auth/FormField.tsx`

**Intent**: Ensure `name` attribute is emitted on inputs so native form POST includes field values (verify existing `name ?? id` behavior is sufficient).

**Contract**: No change required if `name` already defaults to `id`; otherwise add explicit `name` props on entry form fields.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Create mode: empty title shows inline error; valid title allows submit
- Edit mode: fields pre-populate from `initialValues`
- Server error from `?error=` query displays in `ServerError` banner

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Pages and entry list

### Overview

Wire Astro pages with SSR reads, navigation, empty state, success banners, and read-only Draft badges.

### Changes Required:

#### 1. Server-side read helpers

**File**: `src/lib/entries-page.ts` (new)

**Intent**: Load entry list and single entry for Astro frontmatter using the SSR Supabase client and RLS.

**Contract**:

- `loadEntryList(supabase)`: returns `EntryListRow[]` — `{ id, title, status, updated_at }` ordered by `updated_at desc`.
- `loadEntryForEdit(supabase, id)`: returns `EntryBasicsRow | null` — all four text fields plus `id`; `null` if not found or not owned.

#### 2. Entry list page

**File**: `src/pages/entries/index.astro`

**Intent**: Replace placeholder with functional list, empty state, create CTA, and post-create banner.

**Contract**:

- Frontmatter: `createClient`, `loadEntryList`; handle missing supabase config gracefully.
- Query params: `created` (uuid) → green success banner ("Entry created"); invalid uuid ignored.
- Header: title + link/button to `/entries/new`.
- Empty state: friendly copy + prominent "Create entry" link when list length is 0.
- List rows: title links to `/entries/[id]`; read-only "Draft" badge when `status === 'draft'`; formatted `updated_at`.
- Use `AppLayout` and existing card shell styling.

#### 3. New entry page

**File**: `src/pages/entries/new.astro` (new)

**Intent**: Host create form island.

**Contract**: `AppLayout`; read `error` from `Astro.url.searchParams`; render `<EntryBasicsForm mode="create" serverError={error} client:load />` inside card shell.

#### 4. Edit entry page

**File**: `src/pages/entries/[id].astro` (new)

**Intent**: Load entry via SSR; show edit form or redirect if not found.

**Contract**:

- `loadEntryForEdit`; if `null` → `Astro.redirect("/entries")` (or `/entries?error=Entry not found`).
- Query param `saved=1` → green "Changes saved" banner.
- Query param `error` → pass to form `serverError`.
- Render `<EntryBasicsForm mode="edit" entryId={...} initialValues={...} serverError={error} client:load />`.
- Show read-only Draft badge near page title when `status === 'draft'`.

#### 5. Topbar navigation (optional polish)

**File**: `src/components/Topbar.astro`

**Intent**: Ensure signed-in users can reach create flow from global nav if not already present.

**Contract**: `/entries` link exists; add "New entry" link to `/entries/new` if UX benefits from it (list page header CTA is minimum).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Full flow: sign in → empty list CTA → create → list banner → open entry → edit → saved banner
- List shows title, Draft badge, updated date for each entry
- Visiting another user's entry id shows redirect/error (RLS)
- Unauthenticated access to `/entries`, `/entries/new`, `/entries/[id]` redirects to sign-in

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests

- None in repo; not adding for S-02.

### Integration Tests

- None in repo; manual curl smoke for Phase 1 API per AGENTS.md `.cookies` pattern.

### Manual Testing Steps

1. Sign up or sign in locally; land on `/entries` empty state.
2. Click "Create entry"; submit with empty title → inline error.
3. Submit with title only → redirect to list with green banner; row appears with Draft badge.
4. Open entry; change description; save → `?saved=1` banner; reload shows persisted values.
5. Sign in as different user; attempt `/entries/<other-id>` → blocked.
6. Sign out; visit `/entries` → redirect to sign-in.
7. Run `npm run lint` and `npm run build`.

## Performance Considerations

- List query is a single `select` with no joins — acceptable at MVP scale (PRD: no pagination at low volume).
- No client-side data fetching for reads; SSR keeps first paint simple.

## Migration Notes

- No schema changes required; F-01 migration must be applied locally (`supabase db reset` or equivalent).
- `published` status deferred; if PRD requires it later, add enum migration in a separate change.

## References

- PRD: `context/foundation/prd.md` (FR-003, FR-004)
- Roadmap: `context/foundation/roadmap.md` (S-02)
- F-01 plan: `context/archive/2026-06-08-paint-log-schema-rls/plan.md`
- S-01 plan: `context/archive/2026-06-01-account-auth-shell/plan.md`
- Lessons: `context/foundation/lessons.md`
- Auth form pattern: `src/pages/api/auth/signin.ts`, `src/components/auth/SignInForm.tsx`
- Schema: `supabase/migrations/20260608103251_paint_log_schema.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: API and route protection

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — 49b794f
- [x] 1.2 Build passes: `npm run build` — 49b794f

#### Manual

- [x] 1.3 Unauthenticated POST to `/api/entries` redirects to sign-in — 49b794f
- [x] 1.4 Authenticated POST creates draft row with correct `user_id` — 49b794f
- [x] 1.5 Authenticated POST update succeeds for owned entry; fails for other user's id — 49b794f

### Phase 2: Entry basics form

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — 06f3b9f
- [x] 2.2 Build passes: `npm run build` — 06f3b9f

#### Manual

- [x] 2.3 Create mode blocks empty title; allows valid submit — 06f3b9f
- [x] 2.4 Edit mode pre-populates fields; server error displays — 06f3b9f

### Phase 3: Pages and entry list

#### Automated

- [x] 3.1 Linting passes: `npm run lint` — ce17cc1
- [x] 3.2 Build passes: `npm run build` — ce17cc1

#### Manual

- [x] 3.3 Full create → list banner → edit → saved banner flow works — ce17cc1
- [x] 3.4 List shows title, Draft badge, updated date; empty state shows CTA — ce17cc1
- [x] 3.5 Cross-user entry access blocked; unauthenticated routes redirect — ce17cc1
