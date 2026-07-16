# AI Media Status Sync

Date: 2026-07-16

Status synchronization is server-side only.

## Current Product-Image Flow

- Local job is created in `QUEUED` before provider submission.
- Provider response updates the local job with provider job ID, provider status, outputs, correlation ID, and idempotency metadata.
- Status polling uses the canonical AI-media service client.
- Provider output URLs are validated by the client and then treated as temporary result references.
- Permanent asset URLs come only from the application storage gateway.

The browser must not call Render directly and must not supply arbitrary result URLs for ingestion.

## PRE-P07 Status Compatibility

The Bazar Baz app now accepts the PRE-P07 worker/queue status vocabulary from the AI-media service without changing the existing local Prisma job enum.

The app parses provider status values through `lib/ai-media/status.ts` and maps them into the legacy local states used by current tables and route contracts:

| Provider/canonical status | Local app status | User meaning |
| --- | --- | --- |
| `ACCEPTED` | `QUEUED` | Request accepted and waiting. |
| `QUEUED_WAITING_FOR_GPU` | `QUEUED` | Waiting for processing capacity. |
| `QUEUED_GPU_OFFLINE` | `QUEUED` | Worker is unavailable, but the request has not failed. |
| `QUEUED_GPU_BUSY` | `QUEUED` | Worker capacity is busy, but the request has not failed. |
| `CLAIMED_BY_WORKER` | `PROCESSING` | Worker has claimed the request. |
| `PROCESSING` | `PROCESSING` | Image generation or result preparation is running. |
| `RESULT_READY` | `COMPLETED` | Provider result exists; Bazar Baz still owns permanent import. |
| `IMPORTED_BY_BAZAR_BAZ` | `COMPLETED` | Bazar Baz validated and stored the result through application storage. |
| `FAILED_RETRYABLE` | `FAILED` | Temporary failure with retry semantics. |
| `FAILED_FINAL` | `FAILED` | Terminal provider failure. |
| `CANCELLED` / `CANCELED` | `CANCELED` | Request was canceled. |
| `EXPIRED` | `FAILED` | Request expired. |
| unknown or malformed | `QUEUED` | Fail-closed pending state; raw status is not shown to normal users. |

Queue rank, jobs-ahead, ETA, ETA confidence, and worker availability are parsed as optional metadata. ETA is displayed only when confidence is `low`, `medium`, or `high`; `none` and `unknown` remain hidden. Low-confidence ETA is shown as approximate. Persian is the primary display language, with English and Arabic fallbacks.

## UI Policy

- Product edit AI image suggestions display Persian-friendly status labels and safe detail lines.
- GPU offline and GPU busy states remain pending/queued states, not failures.
- Unknown provider statuses do not appear as raw technical strings to normal users.
- Creative Studio uses the same shared in-flight semantics for queued/worker states.
- Browser code still calls only Bazar Baz API routes; it does not call Render, GPU workers, or Blob storage directly.

## P07 Readiness Boundary

This compatibility phase does not authorize production generation or import.

P07 is still blocked until a separate explicit authorization allows one controlled production AI-media result import through the deployed Bazar Baz application storage gateway. That future flow must not expose Blob credentials to Codex, Render, the GPU worker, or the browser.
