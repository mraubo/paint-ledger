# Repository Guidelines

Paint Ledger logs hobby paint workflows (models, recipes, steps, photos). Astro 6 server output on Cloudflare Workers, React 19 islands, Tailwind 4, Supabase auth/storage. See @context/foundation/prd.md and @context/foundation/tech-stack.md.

## Hard rules

- Keep `SUPABASE_URL` and `SUPABASE_KEY` server-only: they are declared in @astro.config.mjs via `astro:env` with `access: "secret"`. Do not import them into client components or expose them in the browser.
- Copy env from @.env.example to `.env` for Supabase and `.dev.vars` for Cloudflare local dev (see @README.md).
- Register new authenticated pages by adding their path prefix to `PROTECTED_ROUTES` in @src/middleware.ts.
- Do not delete or relocate the `context/` tree; it holds foundation docs and change logs for this project.
- Run `npm run lint` before pushing; CI also runs `npx astro sync`, `npm run build`, and `npm run test:integration` with local Supabase (@.github/workflows/ci.yml).
- Do not commit directly to `main`. All work goes on a dedicated feature branch; open a PR into `main` when ready. Before committing, confirm the current branch is not `main` (`git branch --show-current`). If you are on `main`, create and switch to a feature branch first.

## Project structure

- `src/pages/` — Astro routes; API handlers under `src/pages/api/`.
- `src/components/` — UI: `.astro` shells and `auth/` + `ui/` React components (PascalCase filenames).
- `src/lib/` — shared server/client utilities (e.g. @src/lib/supabase.ts).
- `src/layouts/` — page layouts.
- `public/` — static assets.
- `context/foundation/` — PRD, shape notes, tech stack. Before adding routes, auth, or storage features, read @context/foundation/prd.md and @context/foundation/tech-stack.md and cite the relevant sections in your plan.

Import via `@/*` alias (@tsconfig.json maps to `./src/*`).

## Build, test, and development

Scripts: @package.json (`dev`, `build`, `preview`, `lint`, `lint:fix`, `format`, `test`, `test:integration`, `test:watch`). Local setup and env: @README.md. Use Node per @.nvmrc. Husky pre-commit: lint-staged on `*.{ts,tsx,astro}`, Prettier on `*.{json,css,md}` (@package.json).

**Tests:** Run `npx supabase start && npx supabase db reset` before tests. Integration tests load `SUPABASE_URL` and `SUPABASE_KEY` from `.env` via `vitest.config.ts` (not `astro:env`). **CI** runs `npm run test:integration` only (Supabase-local subset; no dev server) — see @.github/workflows/ci.yml. **Local full suite:** `npm test` runs all integration files including HTTP auth/IDOR tests in @tests/integration/auth-route-protection.test.ts, which also require `npm run dev` on port 4321 in a second terminal. Supabase-only files: @tests/integration/rls-isolation.test.ts and @tests/integration/entry-workflow-integration.test.ts. Prerequisites per area: @context/foundation/test-plan.md §6.2 (Supabase only) vs §6.4 (Supabase + dev server). Helpers: @tests/helpers/supabase-client.ts, @tests/helpers/http-client.ts, @tests/helpers/seed-fixtures.ts, @tests/helpers/test-image.ts.

After auth or routing changes, for each prefix in `PROTECTED_ROUTES` (@src/middleware.ts): unauthenticated request must redirect; authenticated session must return 200 on the protected page. Otherwise validate with `npm run lint`, `npm run build`, and `npm run test:integration` when local Supabase is running; use `npm test` when also exercising HTTP tests with the dev server up.

When curl-testing form `POST` APIs locally, send `-H "Origin: http://localhost:4321"` (see @context/foundation/lessons.md).

### Authenticated `curl` (local)

For API or page requests that need a logged-in session, read the Supabase auth cookie from `.cookies` (gitignored; copy from @.cookies.example). The file stores `SB_COOKIE_KEY` (cookie name, e.g. `sb-127-auth-token` for local Supabase) and `SB_COOKIE_VALUE` (session payload from the browser). Do not commit `.cookies`. Example:

```bash
source .cookies
curl -b "${SB_COOKIE_KEY}=${SB_COOKIE_VALUE}" http://localhost:4321/...
```

## Coding style

Formatting and TypeScript strictness: @tsconfig.json + @.prettierrc.json (run `npm run format` / `npm run lint`). When manually fixing lint issues, run `npm run lint:fix` first to apply ESLint autofixes before hand-editing. React/Astro lint rules: @eslint.config.js (unused vars: `_` prefix). Do not use `set:html` for dynamic or user-supplied HTML; use Astro components. Use `set:html` only for trusted static markup already in the repo. shadcn-style UI: `src/components/ui/` (@components.json).

## Commits and pull requests

Recent history uses Conventional Commit prefixes (`feat:`, `chore:`). Target branch for CI is `main` (@.github/workflows/ci.yml); confirm your remote default before opening PRs.

**Tracking:** Scope work from @context/foundation/roadmap.md (slice IDs like `S-02`, change IDs like `entry-draft-and-origin`; plans live under `context/changes/<change-id>/`). Optional GitHub Issues on this repo for ad-hoc tasks. This project does not use Jira.

**Branches:** Never commit on `main`. If no feature branch exists yet, create one before the first commit. Name branches from the active roadmap slice or change folder (e.g. `s-02-entry-draft-and-origin`, `f-01-paint-log-schema-rls`). When work maps to a GitHub issue, you may prefix with the issue number (e.g. `42-s-02-entry-draft`). If the slice, change id, or issue is unclear, ask before choosing a branch name.

**Commits:** English; use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`). Reference the roadmap slice in the subject when helpful (e.g. `feat(S-02): add entry draft form`). Link GitHub issues in the body or with `(#42)` in the subject when applicable.

**After implementation:** When a plan, slice, phase, or other scoped unit of work is finished, propose a commit message that follows the conventions above (slice/change id in the subject when relevant). Do not commit unless the user explicitly asks.

PRs should pass GitHub Actions lint, build, and integration tests. Set `SUPABASE_URL` and `SUPABASE_KEY` as repo secrets for CI builds.

## Mutation testing

Repo uses Stryker for selective mutation testing on risk-critical modules.
Run it only for code covered by the current change or a risk from test-plan.md,
prefer narrowed scope with --mutate "path/to/file.ts:start-end", and do not chase
100% mutation score. Survived mutants should be reviewed one by one: add an
assertion only when the mutant represents a user-visible or business-relevant bug.
