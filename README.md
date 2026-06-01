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

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
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

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

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

No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only.

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

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/entries`            | Protected app home (redirects to `/auth/signin` if unauthenticated)     |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/) via `@astrojs/cloudflare` (server output + static assets). Production auto-deploy on push to `master` is handled by **Cloudflare Workers Builds** (GitHub app); manual deploy remains available for hotfixes.

### Secret surfaces

Supabase credentials must stay in sync across three independent places. Use the **anon (public) key** only — never the `service_role` key in any of these.

| Surface | Location | Purpose |
| ------- | -------- | ------- |
| Local | `.env` and `.dev.vars` | `npm run dev` / local SSR (`astro:env` + Wrangler workerd) |
| GitHub Actions | Repository secrets `SUPABASE_URL`, `SUPABASE_KEY` | CI `npm run build` only |
| Cloudflare Worker | `npx wrangler secret put` or dashboard → Variables and Secrets | **Runtime** on the deployed Worker |

**Rotation checklist** (after regenerating keys in Supabase → Settings → API):

1. Update `.env` and `.dev.vars` locally (same `SUPABASE_URL` + anon `SUPABASE_KEY`).
2. Update GitHub repository secrets (`SUPABASE_URL`, `SUPABASE_KEY`).
3. Update Cloudflare Worker secrets: `npx wrangler secret put SUPABASE_URL` and `SUPABASE_KEY`.
4. Redeploy: `npx wrangler deploy` or push to `master` (if Workers Builds is connected).

### Manual deploy

1. Authenticate: `npx wrangler login` (once per machine).
2. Build: `npm run build` (requires Supabase env vars locally).
3. Set runtime secrets (first deploy or after rotation):

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

4. Deploy:

```bash
npx wrangler deploy
```

5. Update Supabase **Authentication → URL configuration** (Site URL + Redirect URLs) to match the Worker hostname.

**Current production URL:** `https://paint-ledger.mateusz-raubo.workers.dev`

| Setting | Value |
| ------- | ----- |
| Site URL | `https://paint-ledger.mateusz-raubo.workers.dev` |
| Redirect URLs | `https://paint-ledger.mateusz-raubo.workers.dev/**`, `http://localhost:4321/**` |

### Rollback and operations

| Command | Use |
| ------- | --- |
| `npx wrangler tail` | Live Worker logs after deploy |
| `npx wrangler deployments list` | Version history |
| `npx wrangler rollback` | Revert to the previous Worker deployment |

**Worker rollback only reverts application code and static assets** on Cloudflare. It does **not** roll back Supabase data, Auth users, or schema changes. Treat database migrations as forward-only; use a staging Supabase project before risky schema work.

Missing Worker secrets at runtime disable auth silently (`createClient()` returns `null`). After deploy, confirm sign-in works and protected routes redirect correctly.

### Cloudflare Workers Builds (auto-deploy)

After connecting the [Cloudflare Workers & Pages GitHub app](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) and linking this repo to the `paint-ledger` Worker (**Settings → Builds**), use:

| Setting | Value |
| ------- | ----- |
| Production branch | `master` |
| Root directory | `/` |
| Node version | `22` (matches GitHub Actions CI) |
| Build command | `npm ci && npx astro sync && npm run build` |
| Deploy command | `npx wrangler deploy` |

**Environment variables** (two places — both required):

| Where | Variables | Why |
| ----- | --------- | --- |
| Builds → **Build variables** | `SUPABASE_URL`, `SUPABASE_KEY` | `astro:env` at **build** time |
| Worker → **Settings → Variables and Secrets** (encrypted) | `SUPABASE_URL`, `SUPABASE_KEY` | **Runtime** on the Worker (you may already have these from `wrangler secret put`) |

Use the same cloud Supabase **anon** key as GitHub Actions secrets. Do not add a deploy step to GitHub Actions — Builds owns production deploy; CI stays lint + build only.

**Verify:** push to `master` → build succeeds in Cloudflare dashboard → https://paint-ledger.mateusz-raubo.workers.dev still signs in.

## CI

GitHub Actions runs lint + build on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step.

## License

MIT
