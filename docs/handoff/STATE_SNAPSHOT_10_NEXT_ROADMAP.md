# Bazar Baz Handoff Snapshot 10 - Next Roadmap

## Recommended Next Phase

BB-B2B-P13 - Guided Tenant Provisioning Readiness

## Why This Is Next

The public B2B funnel now has:

- Persian-first B2B homepage and support pages.
- Request-demo lead capture and admin review.
- Business onboarding wizard source.
- Custom-domain onboarding source acceptance.
- Tenant direct shop/appointment flows preserved.

The next practical step is to turn onboarding intent into a safe, reviewable provisioning readiness workflow. This should prepare data, checks, and operator approvals before creating or activating production tenant resources.

## Prerequisites

- Keep P10 request-demo lead review stable.
- Keep P12 onboarding wizard stable.
- Decide the provisioning state model: draft, reviewed, approved, blocked, provisioned.
- Confirm which fields from onboarding can safely become organization settings.
- Confirm required admin review before tenant creation or public activation.
- Confirm no real SMS, payment, custom-domain mutation, or provider action runs automatically.

## Expected Implementation Scope

- Add/readiness model or fields for onboarding submissions and provisioning decisions.
- SUPER_ADMIN review screen or extension to existing lead/onboarding review.
- Validation checks for required business identity, type, locale, owner contact, slug, and desired modules.
- Dry-run tenant preview showing what would be created.
- Audit logs for review/provisioning decisions.
- Explicit manual action to create or connect tenant data.
- Safe failure states and Persian operator copy.
- Source validators for no real SMS/payment/domain mutation.

## Risks

- Accidentally creating tenants from incomplete public submissions.
- Exposing lead phone/email values too broadly.
- Reintroducing marketplace wording while building provisioning.
- Triggering real SMS or provider actions during readiness checks.
- Activating custom domains without migration/provider authorization.

## P11 Reminder

P11 production custom-domain activation still requires:

- production migration confirmation,
- provider configuration,
- exact real-mutation acknowledgement,
- authorized real-domain test fixture,
- explicit operator approval.

Do not automatically activate, attach, verify, or remove Vercel domains.

