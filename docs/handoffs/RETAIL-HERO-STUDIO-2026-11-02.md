# Retail hero management

Scope: connect Website Studio to the modern Retail storefront hero, with campaign
and selected-product modes, separate approved desktop/mobile assets, copy, CTA,
image fit/focal controls, optional calm autoplay, saved preview, publish and rollback.

## Persistence and publication

- Existing immutable `TenantWebsiteRevision.content.hero` stores configuration.
  Legacy revisions without `hero` remain readable. No schema migration is required.
- Reserved `OrganizationSettings.settings.retailHeroPublication` points to the
  published revision and its predecessor. Draft saves never change that pointer.
- Publication locks the organization, checks the expected published revision,
  revalidates current tenant media/products and writes an audit entry. First
  publication can roll back to the previous automatic storefront hero.
- Generic settings writes cannot supply/erase the reserved publication pointer;
  default-capability updates preserve neighboring JSON settings atomically.
- Public lookup follows only the tenant-qualified published revision and current
  public media. Selected products resolve through the canonical public catalog.
- Preview and public rendering share `RetailManagedHero`; private preview disables
  navigation. The older five-section website draft is retained separately; this
  release publishes only the hero, not those legacy sections.

## Verification before hosted release

- Node 24 TypeScript passed; scoped ESLint: no errors (one inherited `any` warning).
- Focused unit/route suite: 91 passed, including tenant isolation, byte limits,
  stale publication conflict, rollback and reserved-settings-key protection.
- Real PostgreSQL 17 integration: save/reopen, draft isolation, publish/rollback,
  adjacent settings preservation, tenant rejection and media revocation passed.
  A new disposable loopback-only database was used and removed after verified
  fixture cleanup; production data was not used for these tests.
- Browser fixture renders the actual shared campaign component with existing Aka
  brand assets; hosted manager save/preview/publish still requires post-build checks.
- A separate broader `bb3a-public-namespace` test has an existing failure: the
  `app/[locale]/product` directory exists in HEAD but `product` is not recognized
  as reserved. This release changes neither that route nor slug policy. This is
  not a full-suite pass claim.

Hosted release and runtime evidence are reported separately after deployment.
