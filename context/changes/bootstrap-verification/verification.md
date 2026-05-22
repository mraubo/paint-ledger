---
bootstrapped_at: 2026-05-22T13:46:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: paint-ledger
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: paint-ledger
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

## Why this stack

Paint Ledger is a solo, after-hours web MVP (3 weeks) with private accounts, per-user entries, and photo uploads. The recommended JavaScript default — 10x Astro Starter — bundles TypeScript, Supabase auth and PostgreSQL, Supabase Storage for step and final photos, and Cloudflare Pages deploy in one agent-friendly stack that passes all four quality gates. Auth and image storage match the PRD without extra integration work. GitHub Actions with auto-deploy on merge matches a shipping-first solo workflow; scaffolding confidence is first-class.

## Pre-scaffold verification

| Signal      | Value                                              | Severity | Notes                    |
| ----------- | -------------------------------------------------- | -------- | ------------------------ |
| npm package | not run                                            | —        | git-clone starter; skipped |
| GitHub repo | przeprogramowani/10x-astro-starter pushed 2026-05-17 | fresh    | from card.docs_url       |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: 83 (excluding node_modules; node_modules moved as tree)

**Conflicts (.scaffold siblings)**: none

**.gitignore handling**: moved silently

**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: npm audit --json

**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW

**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0 (2 direct moderate: @astrojs/check, wrangler; 1 transitive high: devalue)

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** (transitive) — Svelte devalue: DoS via sparse array deserialization ([GHSA-77vg-94rm-hx3p](https://github.com/advisories/GHSA-77vg-94rm-hx3p)). Range: 5.6.3–5.8.0. Fix available.

#### MODERATE findings

- **@astrojs/check** (direct) — via @astrojs/language-server → volar-service-yaml → yaml-language-server → yaml stack overflow advisory.
- **wrangler** (direct) — via miniflare → ws uninitialized memory disclosure.
- **@astrojs/language-server**, **@cloudflare/vite-plugin**, **miniflare**, **volar-service-yaml**, **ws**, **yaml**, **yaml-language-server** (transitive) — chained from the above; see `npm audit` output for full via chains.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                       | Value                    |
| -------------------------- | ------------------------ |
| bootstrapper_confidence    | first-class              |
| quality_override           | false                    |
| path_taken                 | standard                 |
| self_check_answers         | null                     |
| team_size                  | solo                     |
| deployment_target          | cloudflare-pages         |
| ci_provider                | github-actions           |
| ci_default_flow            | auto-deploy-on-merge     |
| has_auth                   | true                     |
| has_payments               | false                    |
| has_realtime               | false                    |
| has_ai                     | false                    |
| has_background_jobs        | false                    |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
