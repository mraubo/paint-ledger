---
starter_id: 10x-astro-starter
package_manager: npm
project_name: paint-ledger
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

Paint Ledger is a solo, after-hours web MVP (3 weeks) with private accounts, per-user entries, and photo uploads. The recommended JavaScript default — 10x Astro Starter — bundles TypeScript, Supabase auth and PostgreSQL, Supabase Storage for step and final photos, and Cloudflare Workers deploy (`@astrojs/cloudflare` v13+) in one agent-friendly stack that passes all four quality gates. Auth and image storage match the PRD without extra integration work. GitHub Actions with auto-deploy on merge matches a shipping-first solo workflow; scaffolding confidence is first-class.
