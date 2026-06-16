---
project: paint-ledger
researched_at: 2026-05-26
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 (server output)
  runtime: Cloudflare Workers (workerd) via @astrojs/cloudflare ^13.5
---

## Recommendation

**Deploy on Cloudflare Workers.**

Paint Ledger already ships with `@astrojs/cloudflare`, `output: "server"`, and `wrangler.jsonc` (`nodejs_compat`, Workers Static Assets). That matches a stateless Astro SSR app with external Supabase for auth, Postgres, and photo storage—no platform migration required. Interview answers (stateless, external Supabase, Cloudflare familiarity, single region, cost/DX neutral) align with Workers: strong `wrangler` CLI, agent-readable docs (`llms.txt`, Markdown via `Accept: text/markdown`), GA MCP servers, and a free tier that likely covers MVP traffic (100k requests/day). Vercel is the runner-up if organizational constraints block Cloudflare, but switching would mean a new adapter and duplicated secrets.

## Platform Comparison

Scoring lens: five agent-friendly criteria from `references/agent-friendly-criteria.md` (Pass / Partial / Fail). Interview weights: Cloudflare familiarity favors Cloudflare on ties; external Supabase neutralizes co-location; single region slightly reduces edge-only premium; no WebSocket requirement (no hard drops).

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 5.0 |
| Netlify | Pass | Pass | Pass | Pass | Pass | 5.0 |
| Vercel | Pass | Pass | Pass | Pass | Partial | 4.5 |
| Railway | Pass | Pass | Partial | Pass | Pass | 4.5 |
| Render | Pass | Pass | Partial | Partial | Pass | 4.0 |
| Fly.io | Pass | Partial | Partial | Pass | Partial | 3.5 |

**Cloudflare Workers** — `wrangler deploy`, `wrangler rollback`, `wrangler tail` are GA. Docs publish `/llms.txt`, per-product `/workers/llms.txt`, and Markdown for agents. MCP at `docs.mcp.cloudflare.com` and `mcp.cloudflare.com` (GA). Astro 6 requires `@astrojs/cloudflare` v13+, which deploys to Workers + Static Assets (not legacy Pages SSR). Free tier: 100k requests/day, 10 ms CPU/invocation; static asset requests unlimited. Co-located D1/R2/Queues are GA but optional with Supabase.

**Netlify** — Strong Astro 6 via `@astrojs/netlify` v7 and official `@netlify/mcp`. Credit-based pricing is less predictable than Cloudflare request buckets for SSR compute. Would require adapter and config migration from the current stack.

**Vercel** — Excellent `@astrojs/vercel` v10 + Astro 6 SSR, `llms.txt`, and Hobby free tier (1M invocations/month). Vercel MCP is **public beta** (Aug 2025). No co-located Postgres (Supabase via marketplace). Migration cost from existing Cloudflare adapter.

**Railway** — Node/Railpack container deploy, remote MCP (`mcp.railway.com`), good for `@astrojs/node` standalone. Hobby ~$5/mo with metered overage; no permanent free tier. Requires adapter swap and ongoing container billing.

**Render** — Web Service + `@astrojs/node` documented; official MCP and agent skills. Free tier spins down after 15 min idle (cold starts hurt auth SSR). Rollbacks on free tier limited to two prior deploys.

**Fly.io** — Full VMs, WebSockets, `fly deploy`; no permanent free tier (trial only). Supabase-on-Fly deprecated. More operational surface than Workers for a solo MVP.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Best fit for this repo as-is: pinned `@astrojs/cloudflare` ^13.5, `wrangler` ^4.90, and `wrangler.jsonc` already configured. Stateless SSR + external Supabase matches Workers’ fetch-based model with `nodejs_compat`. Highest agent ops score (CLI + docs + MCP) and lowest migration risk for a 3-week MVP.

#### 2. Vercel

Credible alternative if Cloudflare is blocked: first-class Astro 6 SSR, strong agent docs, simple Hobby pricing. Gap vs. recommendation: adapter change, Vercel MCP still beta, and no advantage over current scaffolding.

#### 3. Netlify

Tied Cloudflare on criteria score; official Netlify MCP (GA) and Astro 6 support. Gap vs. recommendation: credit-based billing complexity for SSR, full adapter migration, and no existing project wiring.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **CPU time per invocation** — SSR routes that run auth + multiple Supabase queries can approach Workers CPU limits (10 ms on free tier) before traffic looks “high.”
2. **`nodejs_compat` ≠ full Node** — Supabase and other libraries can fail on Workers with Node API gaps (e.g. stream-related issues); upgrades need production smoke tests.
3. **Pages vs Workers naming drift** — `tech-stack.md` still references `cloudflare-pages`; adapter v13+ deploys to Workers + Static Assets, which confuses rollback and docs during incidents.
4. **Split control plane** — Supabase migrations, RLS, and storage policies are independent of `wrangler rollback`; reverting code does not revert database state.
5. **Edge compute, regional Supabase** — Single-region users still pay cross-network latency to Supabase; edge does not co-locate with the database unless you add Hyperdrive later.

### Pre-Mortem — How This Could Fail

The team shipped Paint Ledger on Workers with Supabase and felt fast for three weeks. By month six, every dashboard load triggered SSR auth plus multiple Supabase queries under RLS, blowing CPU limits on the free tier. They had prerendered marketing pages but not entry lists. A minor `@astrojs/cloudflare` upgrade removed `Astro.locals.runtime`; middleware still read it, so sessions broke in production while CI build passed. Preview URLs were never configured; bugs reached `master` because GitHub Actions only linted and built—deploy was manual `wrangler deploy` with secrets out of sync between dashboard and CLI. Supabase connection churn from many isolates caused intermittent auth failures blamed on “Cloudflare being flaky.” When they rolled back a Worker version, a Supabase migration had already added a NOT NULL column; rollback restored code but not data shape. The team concluded Workers was wrong, when the real failures were missing prerender strategy, no preview deploy gate, and unversioned infra runbooks.

### Unknown Unknowns

- **`astro dev` runs on workerd** with `@astrojs/cloudflare` v13—closer to production than Node, but bindings and secrets can still differ from deployed Workers.
- **Free tier is 100k requests per day**, not per month—still ample for MVP, easy to misread in capacity planning.
- **Secrets** live in Cloudflare (`wrangler secret put` / dashboard), separate from `astro:env` schema and GitHub Actions build secrets (`SUPABASE_*` for CI only).
- **Preview deployments** for fork PRs may need extra setup (e.g. Cloudflare Access) if added later.
- **CI does not deploy** — `.github/workflows/ci.yml` validates build only; production deploy remains an explicit `wrangler` step until wired in GitHub Actions.

## Operational Story

- **Preview deploys**: Not configured in repo today. Typical pattern: `wrangler deploy` per branch or GitHub Action with `wrangler versions upload` / environment aliases; protect preview URLs with Cloudflare Access if exposing fork PR builds. Confirm fork PR secret access in GitHub before enabling auto-preview.
- **Secrets**: Production/runtime: Cloudflare Worker secrets via `npx wrangler secret put SUPABASE_URL`, `SUPABASE_KEY`, and `SENTRY_DSN` (or dashboard → Workers → Settings → Variables). Build-time: GitHub repository secrets `SUPABASE_URL`, `SUPABASE_KEY`, and `SENTRY_AUTH_TOKEN` for `npm run build` in CI; Cloudflare Builds build variables for `SENTRY_AUTH_TOKEN` and `SENTRY_DSN` (client bundle + source maps). `SUPABASE_*` are server-only via `astro:env` (`access: "secret"` in `astro.config.mjs`) — never expose in client bundles. `SENTRY_DSN` is semi-public in the client bundle but loaded from env; `SENTRY_AUTH_TOKEN` is build-only. Local dev: keep `.env` and `.dev.vars` in sync for `SENTRY_DSN` and `SENTRY_DEBUG`; set `SENTRY_DEBUG=1` to send events locally. Playwright CI intentionally omits Sentry vars. Rotation: update Supabase keys, then `wrangler secret put`, then GitHub/Builds secrets; redeploy Worker.
- **Rollback**: `npx wrangler rollback` (optional `[VERSION_ID]`; list versions in dashboard or `wrangler deployments list`). GA feature; reverts Worker + assets, not Supabase schema or Storage objects. Typical revert is minutes; plan DB forward-only migrations separately.
- **Approval**: Human should approve production deploy, primary secret rotation, and any Supabase destructive migration. Agent may run `npm run build`, `wrangler tail`, read-only dashboard/MCP queries, and deploy to non-production aliases if credentials are scoped.
- **Logs**: Runtime: `npx wrangler tail` (live logs). Observability enabled in `wrangler.jsonc`. **Sentry** ([`@sentry/astro`](https://docs.sentry.io/platforms/javascript/guides/astro/) + Cloudflare Worker entry `sentry.server.config.ts`) complements `wrangler tail` with error grouping, stack traces (source maps via `SENTRY_AUTH_TOKEN` at build), performance traces (10% sample in production), and structured logs. Production captures when `SENTRY_DSN` is set; local dev requires `SENTRY_DEBUG=1`. Verify via `/dev/sentry-test` in dev. Agents: Cloudflare MCP (`docs.mcp.cloudflare.com/mcp`, `mcp.cloudflare.com/mcp`) per [Cursor setup](https://developers.cloudflare.com/agent-setup/cursor/). CI: GitHub Actions logs for lint/build on `master` PRs.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| SSR routes exceed Workers CPU limits | Devil's advocate | M | H | Prerender public/static pages; cache where safe; monitor CPU in dashboard; set `prerender` on read-heavy list routes when stable |
| `nodejs_compat` breaks after dependency upgrade | Devil's advocate / Unknown unknowns | M | M | Keep `compatibility_flags: ["nodejs_compat"]` in `wrangler.jsonc`; smoke-test auth + Supabase after upgrades; use `npm run dev` (workerd) before deploy |
| Secrets drift (Cloudflare vs GitHub vs local) | Pre-mortem | M | H | Document single source of truth; rotate with checklist; verify `wrangler secret list` matches GitHub secrets used in CI |
| Sentry observability secret drift (`SENTRY_AUTH_TOKEN`, `SENTRY_DSN`) | Operational Story | M | M | Keep GitHub, Cloudflare Builds, Worker secrets, and local `.env`/`.dev.vars` in sync; confirm source maps in Sentry Releases after deploy; Playwright CI omits Sentry to avoid test noise |
| Worker rollback leaves DB incompatible | Devil's advocate | L | H | Treat Supabase migrations as forward-only; test migrations on staging project; never assume `wrangler rollback` fixes data |
| No preview gate before production | Pre-mortem / Unknown unknowns | M | M | Add branch preview deploy in GitHub Actions before auto-promote; or require manual `wrangler deploy` checklist until CI deploy exists |
| Pages vs Workers doc confusion | Devil's advocate | M | L | Treat deployment target as **Workers**; update `tech-stack.md` hint when convenient; follow [Astro Cloudflare guide](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) v13+ only |

## Getting Started

Stack versions in repo: `astro` ^6.3.1, `@astrojs/cloudflare` ^13.5.0, `wrangler` ^4.90.0. Local dev uses the Astro dev server on workerd (no separate `wrangler dev` required for day-to-day feature work).

1. **Local env** — Copy `.env.example` to `.env` and `.dev.vars` per `README.md` with Supabase URL and service/anon keys for local SSR.
2. **Run locally** — `npm run dev` (Astro + Cloudflare adapter emulates Workers runtime).
3. **Build** — `npm run build` (outputs to `dist/` for Static Assets + server entry).
4. **First deploy** — `npx wrangler login` then `npx wrangler secret put SUPABASE_URL`, `SUPABASE_KEY`, and `SENTRY_DSN`, then `npx wrangler deploy`.
5. **Verify** — Hit the deployed URL; exercise `/auth/signin` and a `PROTECTED_ROUTES` path; tail logs with `npx wrangler tail` if errors occur. Confirm Sentry events in project `paint-ledger` after deploy.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (production deploy wiring to GitHub Actions)
- Production-scale architecture (multi-region HA, DR, dedicated support tiers)
