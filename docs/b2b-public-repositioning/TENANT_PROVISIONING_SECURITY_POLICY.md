# Tenant Provisioning Security Policy

Provisioning readiness is a platform-level workflow.

Access:

- SUPER_ADMIN: allowed.
- Tenant owner/admin/manager/staff: denied.
- Customer/guest: denied.

Security boundaries:

- Server-side APIs enforce `requireAuthSession()` and `requireRole(session, ["SUPER_ADMIN"])`.
- Client navigation visibility is not trusted.
- Source lead linkage is immutable through PATCH.
- PATCH only accepts editable proposal fields and cannot set arbitrary status.
- No plaintext passwords, password hashes, invitation tokens, provider secrets, or payment data are stored in the plan.
- Validation output is structured and safe; raw Prisma/provider errors are not returned.
- Phone values are masked in DTOs and UI.
- Audit logs use safe identifiers and summaries.
