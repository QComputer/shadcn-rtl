# PR112 Post-release Database Backup Handoff

Date: 2026-11-21
Repository: `QComputer/shadcn-rtl`

## Source control rule

Database backup and dump files must not be tracked in Git. The existing root `.gitignore` protections `*.dump` and `*.backup` are retained. This cleanup removes the tracked root `bazar-baz-current.dump` from the current source tree without rewriting history.

## Recovery storage

Runflare provider-managed backups and restricted recovery storage are separate from source control. The PR112 release recovery archive remains preserved outside the repository at:

`/var/lib/postgresql/data/.pr112-release-backups/pr112_source_20261121.dump`

Verified archive SHA-256: `ba1bf5f338214ad4aaaae69b623a8d45dba99f7b48a8b23a4fd5b3a6caddbd914`.

This repository cleanup does not delete or alter that archive or the Runflare provider backup.

## Git history

Removing the file from the current Git HEAD does not erase historical Git objects. Earlier commits may continue to contain the dump blob; this change does not rewrite history or force-push.