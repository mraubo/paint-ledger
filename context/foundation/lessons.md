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
