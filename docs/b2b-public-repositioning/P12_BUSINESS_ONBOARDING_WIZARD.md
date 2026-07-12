# BB-B2B-P12 — Business Onboarding Wizard

## Goal

Create a Persian-first guided onboarding wizard for business owners before implementation or tenant provisioning.

## Implemented

- Added public route `/{locale}/onboarding`.
- Added `BusinessOnboardingWizard` with four steps:
  - business type
  - launch priorities
  - content/data readiness
  - contact and consent
- Added recommendation logic for SHOP, APPOINTMENT, and hybrid launch paths.
- Connected wizard submission to the existing safe `POST /api/request-demo` lead API.
- The wizard does not create organizations, users, tenants, SMS sends, or provider mutations.
- Added navigation links from homepage, request-demo, contact, and footer.
- Added deterministic source validator:

```powershell
pnpm run quality:b2b-business-onboarding-wizard
```

## Safety

- No production tenant mutation.
- No real SMS.
- No payment or billing flow.
- No public marketplace discovery.
- Consent is required before submitting a lead.

## Next Recommended Phase

BB-B2B-P13 — Guided Tenant Provisioning Readiness.

This should define how SUPER_ADMIN can convert a qualified lead into a controlled tenant setup plan, still gated by explicit review and migration/deployment readiness.
