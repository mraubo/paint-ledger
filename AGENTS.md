# Repository Guidelines

Paint Ledger logs hobby paint workflows (models, recipes, steps, photos). Astro 6 server output on Cloudflare Workers, React 19 islands, Tailwind 4, Supabase auth/storage. See @context/foundation/prd.md and @context/foundation/tech-stack.md.

## Hard rules

- Keep `SUPABASE_URL` and `SUPABASE_KEY` server-only: they are declared in @astro.config.mjs via `astro:env` with `access: "secret"`. Do not import them into client components or expose them in the browser.
- Copy env from @.env.example to `.env` for Supabase and `.dev.vars` for Cloudflare local dev (see @README.md).
- Register new authenticated pages by adding their path prefix to `PROTECTED_ROUTES` in @src/middleware.ts.
- Do not delete or relocate the `context/` tree; it holds foundation docs and change logs for this project.
- Run `npm run lint` before pushing; CI also runs `npx astro sync` then `npm run build` with Supabase secrets set (@.github/workflows/ci.yml).

## Project structure

- `src/pages/` — Astro routes; API handlers under `src/pages/api/`.
- `src/components/` — UI: `.astro` shells and `auth/` + `ui/` React components (PascalCase filenames).
- `src/lib/` — shared server/client utilities (e.g. @src/lib/supabase.ts).
- `src/layouts/` — page layouts.
- `public/` — static assets.
- `context/foundation/` — PRD, shape notes, tech stack. Before adding routes, auth, or storage features, read @context/foundation/prd.md and @context/foundation/tech-stack.md and cite the relevant sections in your plan.

Import via `@/*` alias (@tsconfig.json maps to `./src/*`).

## Build, test, and development

Scripts: @package.json (`dev`, `build`, `preview`, `lint`, `lint:fix`, `format`). Local setup and env: @README.md. Use Node per @.nvmrc. Husky pre-commit: lint-staged on `*.{ts,tsx,astro}`, Prettier on `*.{json,css,md}` (@package.json).

No test suite yet. After auth or routing changes, for each prefix in `PROTECTED_ROUTES` (@src/middleware.ts): unauthenticated request must redirect; authenticated session must return 200 on the protected page. Otherwise validate with `npm run lint` and `npm run build`.

### Authenticated `curl` (local)

For API or page requests that need a logged-in session, read the Supabase auth cookie from `.cookies` (gitignored; copy from @.cookies.example). The file stores `SB_COOKIE_KEY` (cookie name, e.g. `sb-127-auth-token` for local Supabase) and `SB_COOKIE_VALUE` (session payload from the browser). Do not commit `.cookies`. Example:

```bash
source .cookies
curl -b "${SB_COOKIE_KEY}=${SB_COOKIE_VALUE}" http://localhost:4321/...
```

## Coding style

Formatting and TypeScript strictness: @tsconfig.json + @.prettierrc.json (run `npm run format` / `npm run lint`). React/Astro lint rules: @eslint.config.js (unused vars: `_` prefix). Do not use `set:html` for dynamic or user-supplied HTML; use Astro components. Use `set:html` only for trusted static markup already in the repo. shadcn-style UI: `src/components/ui/` (@components.json).

## Commits and pull requests

Recent history uses Conventional Commit prefixes (`feat:`, `chore:`). Target branch for CI is `master` (@.github/workflows/ci.yml); confirm your remote default before opening PRs.

PRs should pass GitHub Actions lint and build. Set `SUPABASE_URL` and `SUPABASE_KEY` as repo secrets for CI builds.
