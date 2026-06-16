# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Decide protection for every new route

- **Context**: Any new page or API route in the app (especially under `/entries/**` or future `/api/entries/**`).
- **Problem**: Routes not listed in `PROTECTED_ROUTES` (and without per-handler auth) are reachable without a session — entry workflows can ship unprotected by mistake.
- **Rule**: When adding a new route, explicitly decide whether it belongs in `PROTECTED_ROUTES` in `src/middleware.ts` or enforces auth in the handler.
- **Applies to**: plan

## Include Origin header in authenticated curl POSTs

- **Context**: Manual API verification with `curl` against the Astro dev server (`/api/**` POST handlers), including the AGENTS.md `.cookies` auth pattern.
- **Problem**: POST without a matching `Origin` header returns `403` with "Cross-site POST form submissions are forbidden" — easy to misread as an auth or handler bug when it is Astro CSRF protection.
- **Rule**: When curl-testing any form POST API locally, always send `-H "Origin: http://localhost:4321"` (match your dev server origin). Do not use `-I` with POST; use `-s -D -` to inspect redirect headers.
- **Applies to**: implement, plan, impl-review

## Exclude Vite dev paths from run_worker_first

- **Context**: Astro 6 + `@astrojs/cloudflare` local dev (`wrangler.jsonc` → `assets.run_worker_first`).
- **Problem**: A catch-all `/*` rule without Vite exclusions routes `/@vite/client`, `/@react-refresh`, `/@id/*`, `/src/*`, and public assets to the Worker. The browser gets HTML 404s instead of JS/CSS — console shows MIME type / NS_ERROR_CORRUPTED_CONTENT errors and React islands fail to hydrate.
- **Rule**: When using `run_worker_first: ["/*", …]`, always add negative rules for Vite dev paths (`!/@*`, `!/src/*`, `!/node_modules/*`, `!/_astro/*`, and common public static extensions). After changing `wrangler.jsonc`, restart `astro dev` and verify `/@vite/client` returns `200` with `text/javascript` before debugging hydration.
- **Applies to**: frame, plan

## Use React islands for client scripts on Cloudflare Astro dev

- **Context**: Astro pages with client-side `<script>` imports (e.g. Sentry verify button, third-party SDK calls) on `@astrojs/cloudflare` with `run_worker_first` in `wrangler.jsonc`.
- **Problem**: In dev, Astro serves page scripts via absolute filesystem URLs (`/Users/.../page.astro?astro&type=script`). The Worker catches them and returns HTML — console shows `NS_ERROR_CORRUPTED_CONTENT` / disallowed MIME type `text/html`.
- **Rule**: Do not use hoisted `<script>` blocks with ESM imports on Cloudflare Astro dev pages. Move client logic to a React island (`client:load`) or another path served under excluded Vite prefixes (`/@*`, `/_astro/*`). After changing `wrangler.jsonc`, restart `astro dev`.
- **Applies to**: plan, implement, impl-review

## Sync .env and .dev.vars for Cloudflare SSR guards

- **Context**: SSR route guards and server-side env checks on `@astrojs/cloudflare` local dev (`astro dev` on workerd).
- **Problem**: Values set only in `.env` are invisible to SSR/worker — workerd reads `.dev.vars`. Guards using `astro:env/client` or `.env`-only vars fail silently (route stays open or 404 unexpectedly).
- **Rule**: For SSR route guards and Worker runtime flags on Cloudflare local dev, read from `process.env` (`.dev.vars`) and keep `.env` and `.dev.vars` in sync for any variable both client and server need.
- **Applies to**: plan, implement, impl-review

## Disable @sentry/astro server init when using Cloudflare Worker entry

- **Context**: `@sentry/astro` on Astro 6 + `@astrojs/cloudflare` v13+ with `sentry.server.config.ts` as Wrangler `main`.
- **Problem**: Integration auto-discovers `sentry.server.config.ts` for SSR `Sentry.init` while Wrangler uses the same file as Worker `main` via `Sentry.withSentry` — breaks Worker `fetch` export and double-inits Sentry.
- **Rule**: When `sentry.server.config.ts` is the Cloudflare Worker entry wrapper, set `enabled: { server: false }` on the `@sentry/astro` integration. Do not add a separate `sentry.server.config.js` with `Sentry.init`.
- **Applies to**: plan, implement, impl-review

## Exclude root SDK config files from run_worker_first

- **Context**: Root-level client SDK config files (e.g. `sentry.client.config.js`) on Astro + Cloudflare with `run_worker_first: ["/*", ...]` in `wrangler.jsonc`.
- **Problem**: Browser requests to `/sentry.client.config.js` hit the Worker and return HTML — MIME type errors and client SDK never initializes.
- **Rule**: When adding root-level SDK config files loaded by URL, add explicit `run_worker_first` exclusions (e.g. `!/sentry.client.config.js`, `!/sentry.client.config.ts`) alongside existing Vite exclusions. Restart `astro dev` after changing `wrangler.jsonc`.
- **Applies to**: plan, implement, frame
