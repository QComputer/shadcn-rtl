# Tenant Provisioning State Model

P13 lifecycle:

| Status | Meaning | P13 Can Enter |
| --- | --- | --- |
| DRAFT | Editable proposal generated from a lead | yes |
| VALIDATING | Temporary dry-run validation state | yes |
| NEEDS_REVIEW | Blocking errors or warnings require admin decision | yes |
| READY | Dry-run validation has no blocking errors or unresolved warnings | yes |
| APPROVED | SUPER_ADMIN approved for a later execution phase | yes |
| EXECUTING | Reserved for future execution phase | no |
| COMPLETED | Reserved for future execution phase | no |
| FAILED | Reserved for future execution phase | no |
| CANCELLED | Plan intentionally cancelled | yes |

Allowed P13 transitions:

- `DRAFT -> VALIDATING`
- `VALIDATING -> READY`
- `VALIDATING -> NEEDS_REVIEW`
- `READY -> APPROVED`
- `READY -> NEEDS_REVIEW`
- `APPROVED -> NEEDS_REVIEW`
- `DRAFT/NEEDS_REVIEW/READY -> CANCELLED`

P13 rejects execution transitions.
