# Paint Ledger

![](./public/template.png)

**Paint Ledger** is a streamlined paint logging application designed for miniature painters and hobbyists who want to track, replicate, and perfect their painting workflows without the clutter.

### The Problem

Every hobbyist knows the frustration of trying to recreate a perfect color scheme months later. Currently, painting workflows are messy and fragmented—scattered across phone notes, loose reference photos, Discord messages, and random local folders. When information is this disorganized, it becomes incredibly difficult to recreate a proven recipe, repeat a cohesive army color scheme, or quickly recall where a specific model was sourced.

### The Solution

**Paint Ledger** solves this by introducing a clean, structured **paint log** that unifies your tutorial, color recipe, and workshop notes into a single, cohesive entry.

The core philosophy behind our MVP is that a true painting recipe is more than just a list of paints or a sequence of steps. It is the holistic combination of:

* **The Model:** What it is and where it came from.
* **The Palette:** The exact paints, washes, and mediums used.
* **The Process:** The sequential steps and techniques applied.
* **The Result:** The final visual outcome, documented in one place.

With Paint Ledger, you can finally close your scattered tabs and focus on what matters: bringing your miniatures to life.

## Documentation

Astro 6 + React islands, Supabase, and Cloudflare Workers — stack details in [context/foundation/tech-stack.md](context/foundation/tech-stack.md).

- Product: [context/foundation/prd.md](context/foundation/prd.md)
- Roadmap: [context/foundation/roadmap.md](context/foundation/roadmap.md)
- Deployment / ops: [context/foundation/infrastructure.md](context/foundation/infrastructure.md)
- Agent / contributor rules: [AGENTS.md](AGENTS.md)

## Prerequisites

- Node.js v26.1.0 (run `nvm use` — version is in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/mraubo/paint-ledger.git
cd paint-ledger
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

Scripts (`dev`, `build`, `preview`, `lint`, `lint:fix`, `format`, `test`, `test:watch`) are defined in [package.json](package.json).

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

### Database schema and seed (local)

Paint Ledger stores paint logs in Postgres (`entries`, `entry_paints`, `steps`, `step_paint_assignments`) with owner-only row-level security. Migrations live in `supabase/migrations/`.

After starting the local stack, apply migrations and seed data:

```bash
npx supabase db reset
```

This recreates the local database from migrations and runs `supabase/seed.sql`. The seed file is **local development only** — never run its `auth.users` inserts against production.

**Seed users** (for Studio inspection, local sign-in, and RLS tests):

| User   | Email                       | Password            | Fixture data        |
| ------ | --------------------------- | ------------------- | ------------------- |
| A      | `seed@paint-ledger.local`   | `seed-password-123` | One sample entry    |
| B      | `seed-b@paint-ledger.local` | `seed-password-123` | None (empty account) |

After schema changes, regenerate TypeScript types:

```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```

**Remote / production:** apply migrations separately (`npx supabase db push` or the Supabase dashboard). Do not apply `seed.sql` to cloud projects.

For repeatable RLS and Storage policy checks, see the archived implementation plans in [context/archive/2026-06-08-paint-log-schema-rls/plan.md](context/archive/2026-06-08-paint-log-schema-rls/plan.md) and [context/archive/2026-06-08-photo-storage-buckets/plan.md](context/archive/2026-06-08-photo-storage-buckets/plan.md).

### Integration tests (local)

The Vitest suite includes:

- **RLS isolation** — owner-only access on all four paint-log tables ([tests/integration/rls-isolation.test.ts](tests/integration/rls-isolation.test.ts))
- **HTTP auth + IDOR** — middleware redirects and cross-user API denial ([tests/integration/auth-route-protection.test.ts](tests/integration/auth-route-protection.test.ts))

**Prerequisites:**

1. Local Supabase with migrations and seed (`npx supabase start && npx supabase db reset`). `SUPABASE_URL` and `SUPABASE_KEY` in `.env` must match the local stack.
2. Astro dev server for HTTP tests: `npm run dev` (default `http://localhost:4321`) in a second terminal.

```bash
npm test
```

Watch mode: `npm run test:watch`.

After migration or RLS changes, extend `rls-isolation.test.ts` and re-run `db reset` + `npm test`. After auth or route-handler changes, extend `auth-route-protection.test.ts` (dev server must be running). Cookbook patterns: [context/foundation/test-plan.md](context/foundation/test-plan.md) §6.

CI runs lint and build only today; `npm test` in GitHub Actions is planned for test-plan rollout Phase 4.

### Entry photo storage (local)

Step and final entry photos use a **private** Supabase Storage bucket named `entry-photos`. Upload via the app on **entry edit** (final result photo) and **steps** (optional per-step photos).

| Kind  | Object key (relative to bucket)        | DB column                  |
| ----- | -------------------------------------- | -------------------------- |
| Step  | `{user_id}/{entry_id}/steps/{step_id}` | `steps.storage_path`       |
| Final | `{user_id}/{entry_id}/final`           | `entries.final_photo_path` |

**Constraints:** JPEG, PNG, and WebP only; **4 MiB** per object.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                         |
| `/auth/signup`        | Email/password sign-up form                                         |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                 |
| `/entries`            | Protected app home (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication. Signed-in users who visit `/auth/signin` or `/auth/signup` are redirected to `/entries`.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/) via `@astrojs/cloudflare` (server output + static assets). Production auto-deploy on push to `main` is handled by **Cloudflare Workers Builds** (GitHub app); manual deploy remains available for hotfixes. Full ops story: [context/foundation/infrastructure.md](context/foundation/infrastructure.md). Workers Builds setup: [context/archive/2026-05-26-deployment/deployment-plan.md](context/archive/2026-05-26-deployment/deployment-plan.md) (Phase 5).

**Production URL:** `https://paint-ledger.mateusz-raubo.workers.dev`

### Secret surfaces

Supabase credentials must stay in sync across three independent places. Use the **anon (public) key** only — never the `service_role` key in any of these.

| Surface           | Location                                                      | Purpose                                                   |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Local             | `.env` and `.dev.vars`                                        | `npm run dev` / local SSR (`astro:env` + Wrangler workerd) |
| GitHub Actions    | Repository secrets `SUPABASE_URL`, `SUPABASE_KEY`             | CI `npm run build` only                                   |
| Cloudflare Worker | `npx wrangler secret put` or dashboard → Variables and Secrets | **Runtime** on the deployed Worker                        |

After rotating keys in Supabase → Settings → API, update all three surfaces and redeploy. See [context/foundation/infrastructure.md](context/foundation/infrastructure.md) (Operational Story) for the full rotation checklist.

### Sentry observability

Paint Ledger uses [@sentry/astro](https://docs.sentry.io/platforms/javascript/guides/astro/) with a Cloudflare Worker entry (`sentry.server.config.ts`) for server-side capture. Production sends errors, 10% performance traces, and structured logs when `SENTRY_DSN` is set. Local dev sends events **only** when `SENTRY_DEBUG=1`.

| Variable            | When needed | Surfaces                                                                 |
| ------------------- | ----------- | ------------------------------------------------------------------------ |
| `SENTRY_AUTH_TOKEN` | Build-time  | Local `.env`; GitHub secret; Cloudflare Builds build variable            |
| `SENTRY_DSN`        | Runtime + client bundle | Local `.env` and `.dev.vars`; Worker encrypted secret; Cloudflare Builds build variable (client SDK at build) |
| `SENTRY_DEBUG`      | Local only  | `.env` and `.dev.vars` — set to `1` to send events from `npm run dev`    |

**Local setup:** copy placeholders from `.env.example` into both `.env` and `.dev.vars`. Keep `SENTRY_DSN` and `SENTRY_DEBUG` in sync across both files — SSR guards and the Worker read `.dev.vars`, while the client SDK reads `.env` via `astro:env`.

**Troubleshooting local Sentry:** if `/dev/sentry-test` returns 404 but the client still sends events, `SENTRY_DEBUG=1` is likely set only in `.env` — add it to `.dev.vars` and restart `npm run dev`. If the page loads but the button says the client is not initialized, the reverse applies (set `SENTRY_DEBUG=1` in `.env` too).

**Production setup:**

1. GitHub repository secret `SENTRY_AUTH_TOKEN` (CI source-map upload — see [.github/workflows/ci.yml](.github/workflows/ci.yml)). The token must be scoped to Sentry org `mraubo`; a token for a different org logs a warning and skips source-map upload locally while the build still succeeds.
2. Cloudflare Builds build variables: `SENTRY_AUTH_TOKEN` and `SENTRY_DSN`.
3. Worker encrypted secret: `npx wrangler secret put SENTRY_DSN`.

**Verify locally:** with `SENTRY_DEBUG=1` and `SENTRY_DSN` set, open `http://localhost:4321/dev/sentry-test` and click the test button. Events should appear in the Sentry project `paint-ledger` (org `mraubo`) within a few minutes.

**Playwright CI** ([.github/workflows/playwright.yml](.github/workflows/playwright.yml)) intentionally omits Sentry env vars so e2e runs do not flood the production Sentry project.

**Sentry tunnel:** the client SDK uses `tunnel: "/api/sentry-tunnel"` to proxy browser events through the Worker (bypasses CORS and ad-blockers). The tunnel validates DSN host and project ID before forwarding to Sentry ingest; it is a public POST endpoint by design.

### Manual deploy

1. Authenticate: `npx wrangler login` (once per machine).
2. Build: `npm run build` (requires Supabase env vars locally; set `SENTRY_AUTH_TOKEN` for source-map upload).
3. Set runtime secrets (first deploy or after rotation):

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
npx wrangler secret put SENTRY_DSN
```

4. Deploy:

```bash
npx wrangler deploy
```

5. Update Supabase **Authentication → URL configuration** (Site URL + Redirect URLs) to match the Worker hostname.

| Setting       | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Site URL      | `https://paint-ledger.mateusz-raubo.workers.dev`                                       |
| Redirect URLs | `https://paint-ledger.mateusz-raubo.workers.dev/**`, `http://localhost:4321/**`        |

**Worker rollback** (`npx wrangler rollback`) reverts application code and static assets only — not Supabase data or schema. Tail live logs with `npx wrangler tail`. Missing Worker secrets at runtime disable auth silently; after deploy, confirm sign-in and protected routes work.

### Cloudflare Workers Builds (auto-deploy)

Connect the [Cloudflare Workers & Pages GitHub app](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/), link this repo to the `paint-ledger` Worker, and set production branch to `main`. Build: `npm ci && npx astro sync && npm run build`; deploy: `npx wrangler deploy`. Set `SUPABASE_URL` and `SUPABASE_KEY` in both Builds build variables and Worker encrypted secrets. Also set `SENTRY_AUTH_TOKEN` and `SENTRY_DSN` in Builds build variables and `SENTRY_DSN` as a Worker encrypted secret. CI does not deploy — Builds owns production deploy.

## CI

GitHub Actions runs lint + build on every push and PR to `main`. Configure `SUPABASE_URL`, `SUPABASE_KEY`, and `SENTRY_AUTH_TOKEN` as repository secrets in GitHub for the build step. Playwright e2e CI omits Sentry vars on purpose.

## License

MIT
