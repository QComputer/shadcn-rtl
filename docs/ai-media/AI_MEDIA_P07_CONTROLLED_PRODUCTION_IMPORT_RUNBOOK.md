# AI Media P07 Controlled Production Import Runbook

Status: prepared only. Do not execute without a separate explicit authorization.

## Boundary

P07 is the first controlled Production application-managed asset import. It must use the deployed Bazar Baz application server as the only actor that can turn a provider result into a permanent asset.

Codex, local tests, Render, the GPU worker, browsers, and ad hoc scripts must not receive Production Blob credentials and must not directly list, upload, delete, or otherwise manage Production Blob objects.

## Required Authorization Wording

The operator must provide this exact authorization before P07 can begin:

```text
I explicitly authorize one controlled Production AI-media result import through
the deployed Bazar Baz application storage gateway.

This authorization does not grant direct Blob access or reveal Blob
credentials.
```

## Authorized Flow After Separate Approval

1. Confirm Production source is deployed and READY.
2. Confirm no Production migration is required.
3. Confirm real generation/import controls are explicitly enabled only for the single approved tenant/job.
4. Create or select exactly one tenant-scoped AI-media job through authenticated Bazar Baz server routes.
5. Let the deployed Bazar Baz server resolve the tenant-owned local job.
6. Let the deployed Bazar Baz server retrieve and validate the provider result.
7. Let the deployed Bazar Baz server call the application storage gateway.
8. Let the Production adapter use only Vercel runtime credentials internally.
9. Create exactly one tenant-scoped Creative Studio asset.
10. Verify the asset and public display through Bazar Baz routes.
11. Exercise rollback or cleanup through Bazar Baz application controls if required.

## Not Authorized By This Runbook

- Direct Production Blob access by Codex.
- Blob token retrieval or printing.
- Blob object listing.
- Direct Blob upload or deletion.
- Passing Blob credentials to Render or the GPU worker.
- Running a Production database migration.
- Running seed or tenant provisioning.
- Creating more than one Production AI-media import.
- Real Render/GPU generation without explicit P07 authorization.

## Acceptance Evidence

Record only safe evidence:

- Production deployment URL and commit.
- Tenant and job identifiers.
- Storage provider name, storage key hash/checksum, and byte size.
- Creative Studio asset identifier.
- Public route status.
- Rollback or cleanup result.

Never record secret values, signed URLs, Blob tokens, database URLs, provider keys, or raw customer prompts.
