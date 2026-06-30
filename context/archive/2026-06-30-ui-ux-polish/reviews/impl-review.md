<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UI/UX Polish

- **Plan**: context/changes/ui-ux-polish/plan.md
- **Scope**: All 5 phases (complete)
- **Date**: 2026-06-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Automated Verification (re-run 2026-06-30)

| Command | Result |
|---------|--------|
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:integration` | PASS (36 tests) |
| `npm run test:e2e` | PASS (3 tests) |

## Findings

### F1 — Web manifest product name typo

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: public/site.webmanifest:2-3
- **Detail**: `name` and `short_name` are `"PaintLegder"` (typo). PWA install prompts and home-screen labels will show the misspelling.
- **Fix**: Restore `"Paint Ledger"` for both fields.
- **Decision**: FIXED

### F2 — Material Symbols loaded from Google CDN

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/index.astro:41-45
- **Detail**: Landing page loads Material Symbols via `fonts.googleapis.com`. Third-party request with no SRI; visitor IP/referrer sent to Google. Rest of app self-hosts fonts via `@fontsource` in `global.css`. Icons fail to ligature if CDN is blocked.
- **Fix A ⭐ Recommended**: Self-host Material Symbols (e.g. `@fontsource/material-symbols-outlined`) and load from `global.css` like other fonts.
  - Strength: Matches existing font strategy; removes external dependency and privacy leak.
  - Tradeoff: Slightly larger CSS bundle; one-time setup.
  - Confidence: HIGH — project already uses `@fontsource` pattern.
  - Blind spot: None significant.
- **Fix B**: Keep CDN; add `preconnect` + document dependency in plan/README.
  - Strength: Zero code change beyond head tags.
  - Tradeoff: Privacy/perf/CDN failure risk remains.
  - Confidence: MEDIUM — acceptable for marketing-only page.
  - Blind spot: CSP headers in production not verified.
- **Decision**: FIXED via Fix A

### F3 — Unplanned SiteFooter in AppLayout

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/layouts/AppLayout.astro:21
- **Detail**: Plan Phase 3 said AppLayout needs "verify only; no structural change expected." Implementation adds `SiteFooter` to every authenticated page via `AppLayout`, plus new `SiteHeader`/`SiteFooter` abstractions not in the plan.
- **Fix A ⭐ Recommended**: Document in plan addendum as discovered scope — footer improves app shell consistency with landing.
  - Strength: Preserves shipped work; updates source of truth.
  - Tradeoff: Plan becomes slightly moving target.
  - Confidence: HIGH — additive UX improvement, low risk.
  - Blind spot: None significant.
- **Fix B**: Remove `SiteFooter` from `AppLayout`; keep footer landing-only.
  - Strength: Strict scope discipline per original plan.
  - Tradeoff: App pages lose footer; inconsistent with landing.
  - Confidence: MEDIUM — depends on product preference.
  - Blind spot: User expectation for app-wide footer not surveyed.
- **Decision**: FIXED via Fix A (plan addendum)

### F4 — Favicon/PWA bundle outside plan scope

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: public/favicon.*, public/site.webmanifest, src/layouts/Layout.astro
- **Detail**: Full favicon set, `site.webmanifest`, and `wrangler.jsonc` image exclusions shipped alongside UI polish. Not in plan but supports branding and Cloudflare static asset serving.
- **Fix**: No action required unless strict scope discipline desired; otherwise note in plan addendum.
- **Decision**: SKIPPED (documented in addendum)

### F5 — Button token split on entry pages

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/entries/index.astro:37, src/pages/entries/[id]/edit.astro:120
- **Detail**: Landing and Topbar CTAs use `bg-primary-container hover:bg-primary`; entry list and edit status toggle still use legacy `bg-primary`.
- **Fix**: Align entry-page primary buttons to `primary-container` tokens in a follow-up polish pass.
- **Decision**: FIXED

### F6 — BrandLogo default href differs from plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/BrandLogo.astro:9
- **Detail**: Plan specified default `href="/entries"` for app context. Component defaults to `href="/"`. Callers (`AppLayout`, `LandingHeader`) pass correct hrefs — no user-visible bug.
- **Fix**: Change default to `href="/entries"` or require `href` prop (no default).
- **Decision**: FIXED (default `/entries`; `LandingFooter` passes `logoHref="/"`)
