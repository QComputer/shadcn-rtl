# BazarBaaz Codex Engineering Playbook v2.1

Owner directive: delivery speed first. Codex is the autonomous software engineer; the Main Agent is technical lead and independent final reviewer. Follow the owner's current task instructions where they are more specific than this playbook.

## Delivery

- Inspect the actual checkout, branch, staged and unstaged changes, and relevant current evidence before editing. Preserve unrelated work and use the shared checkout unless explicitly instructed otherwise.
- Implement cohesive functional work autonomously within authorized scope. Fix related code, tests and fixtures when evidence warrants it. Make routine engineering decisions without asking for approval.
- Keep updates concise. Stop only for a genuine blocker, unavailable authority or credentials, a consequential architecture decision, or an explicitly required review boundary.
- Never treat a plan or assessment as delivery when implementation is authorized. Update the applicable existing status and roadmap in the same functional change when relevant.

## Validation and recovery

- Select checks for the change and its risks. Use locked dependencies, existing CI and isolated fixtures. Carry accepted results only when their exact inputs and conditions remain valid; do not repeat unrelated acceptance without a reason.
- For concurrent worktrees, isolate candidate snapshots, test ports, databases and logs; do not stop or modify another task’s processes or resources. Prewarm development routes before one-time browser flows, and retain evidence of interrupted runs.
- Record exact source tree, suite counts, failures, skipped cases and evidence hashes. Distinguish local, CI, deployment, public runtime and real provider evidence.
- Diagnose failures from logs and source. Apply narrow fixes and evidence-based retries; preserve failed evidence. Use bounded asynchronous processes, durable logs, monotonic timing and cleanup only of resources proven task-owned.
- Protect tenant isolation, authorization, production data, secrets and the integrity of existing tests. Keep flags off until separately authorized. Never weaken checks to obtain a pass.

## Git and release

- Preserve inherited work; stage explicit task-owned paths, verify the diff and exact tree, and serialize Git operations. Avoid destructive cleanup, resets, force pushes and unrelated changes without authorization.
- Commit, push, open PR and monitor applicable CI when authorized. Do not amend accepted commits or replace a PR unless asked. Keep known non-blocking issues visible; do not repeatedly reopen accepted work.
- For migration-bearing releases, determine actual Git-triggered build/start/migration behavior and backward compatibility before merge. Missing production configuration evidence is a release blocker when the owner makes it a merge condition. Production database access, migration, configuration changes, deployment, feature activation and real provider calls require their own authorization.
- After an authorized merge, verify merge commit and deployment revision and record real health evidence when available. Never infer deployment or migration success from CI alone.

## Standing boundaries

- Preserve Restaurant/Cafe behavior and tenant isolation across Hotel and Retail. Respect the owner gate before Housekeeping.
- Keep AUTH-QA-001 and HOTEL-QA-001 open until their root causes are established and fixes accepted.
- Treat Vercel Preview as the owner-designated suspended exception until policy changes; do not label it passing.
