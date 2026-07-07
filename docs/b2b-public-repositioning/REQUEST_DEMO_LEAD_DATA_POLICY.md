# Request Demo Lead Data Policy

## Data Collected

When a visitor submits the request-demo form, the following data is stored on the Bazar Baz platform:

| Field | Purpose | Retention |
|---|---|---|
| `fullName` | Contact identity | Until archive or manual cleanup |
| `businessName` | Business context | Until archive or manual cleanup |
| `businessType` | Segment and routing | Until archive or manual cleanup |
| `phone` | Follow-up contact | Until archive or manual cleanup |
| `city` | Geographic context | Until archive or manual cleanup |
| `preferredContactTime` | Scheduling optimization | Until archive or manual cleanup |
| `needSummary` | Qualification context | Until archive or manual cleanup |
| `consentAccepted` | Legal record of consent | Until archive or manual cleanup |
| `source` | Attribution (`request-demo`) | Retention tied to lead record |
| `locale` | Localization context (`fa`, `en`, `ar`) | Retention tied to lead record |

## Metadata Collected

| Field | Purpose |
|---|---|
| `ipHash` | Abuse prevention (hashed, not stored in plain text) |
| `userAgentHash` | Abuse prevention (hashed, not stored in plain text) |
| `createdAt` | Lead age and SLA tracking |
| `updatedAt` | Change tracking |

## What Is NOT Collected

- No passwords or authentication credentials.
- No payment card data.
- No SMS/VAPID/api keys.
- No third-party analytics identifiers.
- No browsing history.

## Who Can Access Lead Data

- **SUPER_ADMIN only** — authenticated platform administrators can view and update lead status via the dedicated dashboard page.
- Tenant admins (ADMIN/MANAGER within a specific organization) **cannot** access platform-wide leads.
- Lead data is **not** exposed via any public API.
- Full phone numbers are masked (`******5678`) in list views and only revealed in the SUPER_ADMIN detail view.

## Lead Status Lifecycle

| Status | Meaning |
|---|---|
| `NEW` | Just submitted, not yet reviewed by admin. |
| `REVIEWED` | Admin has reviewed the lead. |
| `CONTACTED` | Admin has reached out to the business. |
| `QUALIFIED` | Business is a good fit; moving toward onboarding. |
| `REJECTED` | Business is not a fit at this time. |
| `ARCHIVED` | Lead is closed and retained for audit. |

## No Automatic Actions

- No SMS is sent automatically upon submission.
- No email is sent automatically upon submission.
- No CRM or analytics integration is performed.
- No tenant organization is created automatically.
- No follow-up is scheduled automatically.

## Data Retention and Cleanup

Leads are retained until explicitly archived or deleted by a SUPER_ADMIN. There is no automatic TTL or batch purge in this phase.

## Compliance Notes

- Consent is required at the point of submission.
- The form does not pre-check the consent box.
- Data usage is limited to platform onboarding and qualification purposes.
- Legal review of the consent copy and privacy policy is still pending before official launch.
