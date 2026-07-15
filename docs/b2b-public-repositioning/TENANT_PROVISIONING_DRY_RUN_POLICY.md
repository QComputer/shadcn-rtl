# Tenant Provisioning Dry-Run Policy

P13 dry run validates readiness only.

Checks include:

- Source lead exists and is eligible.
- Organization name and type are valid.
- Slug syntax, reserved-route, existing organization, and active-plan conflicts.
- Owner phone/email presence and conflict classification.
- Package intent and module compatibility.
- Supported locale and timezone.
- Custom-domain intent is informational only.

Dry run may write:

- Plan `status`.
- Plan `validationResult`.
- Plan `validationErrors`.
- Plan `validatedAt`, `readyAt`, and validation version.
- Audit log entries.

Dry run must not create or mutate:

- Organization.
- User.
- Organization membership.
- Subscription/package billing record.
- Invitation.
- SMS/email/Web Push/in-app notification.
- Custom-domain provider/domain record.
- Payment record.
