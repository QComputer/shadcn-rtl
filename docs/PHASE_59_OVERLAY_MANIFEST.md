# Phase 59 Overlay Manifest — Shop Custom Domains

## Added

- Shop custom-domain database model and migration.
- Custom-domain routing helpers.
- Internal resolver API protected by `CUSTOM_DOMAIN_RESOLVER_SECRET`.
- Organization domain management API foundation.
- Clean tenant-domain proxy rewrite and leaked platform-path redirect.
- Tenant-domain SEO context for shop homepage, product detail, category, and fanpage pages.
- Domain-not-configured fallback page.
- Source validator: `npm run quality:shop-custom-domains`.

## Operational follow-up

After deploying this overlay, run Prisma migration/generate and configure Vercel project domains/DNS before marking a domain `ACTIVE`.
