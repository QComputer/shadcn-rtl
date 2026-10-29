<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared main checkout

The owner chose one active checkout for this repository:
`C:/Users/disso/Project/shadcn-rtl`, normally on `main`.
Do not create additional worktrees by default. Coordinate subagents by explicit
non-overlapping file ownership in this checkout, and serialize Git operations.
Inspect current Git state before editing; preserve inherited work.

Read `docs/handoffs/SINGLE-MAIN-2026-10-29.md` for the consolidation record,
private recovery archive, deferred source and Hotel/Retail continuation points.
Historical branch documents and acceptance results describe their own SHA and
environment; verify the current baseline before relying on them.

Use the repository's locked dependencies. Keep local development and tests on
isolated configuration; archived `.env`, database dumps, `.neon` and provider
configuration are preservation material, not default development inputs.

Changes to Hotel and Retail share authentication, tenancy, commerce and media
contracts. Preserve Restaurant/Cafe behavior and tenant isolation. Keep local
test evidence, public runtime evidence and real payment/booking acceptance
separate. The dedicated Damoon frontend is in `sites/damoon`.
