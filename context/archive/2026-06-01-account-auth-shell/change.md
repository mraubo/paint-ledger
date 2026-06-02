---
change_id: account-auth-shell
title: Extend auth shell and protected routes for entries
status: archived
created: 2026-06-01
updated: 2026-06-02
archived_at: 2026-06-02T13:04:21Z
---

## Notes

Roadmap slice **S-01** (`context/foundation/roadmap.md`) — change-id `account-auth-shell`, status **ready**.

**Outcome:** User can sign up, log in, sign out, and access a protected app shell that will host entry workflows.

**PRD refs:** FR-001, FR-002

**Risk (from roadmap):** Auth scaffold exists but only `/dashboard` is protected — extend `PROTECTED_ROUTES` before entry routes ship.

**GitHub:** [#3](https://github.com/mraubo/paint-ledger/issues/3) — Extend auth shell and protected routes for entries. Ready for `/10x-plan`.

**Parallel with:** F-01 (`paint-log-schema-rls`).
