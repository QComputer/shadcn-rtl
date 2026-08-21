# Organization.type audit

Final status: `OrganizationCapability` is the runtime source of truth for routing, feature availability, search, sitemap generation, imports, domain revalidation, and dashboard route composition. `Organization.type` remains for compatibility metadata, data initialization, and presentation only.

| File | Usage | Classification | Action |
|---|---|---|---|
| `lib/organization-capabilities.ts` | `legacyType` fallback when `capabilitiesInitializedAt` is null | COMPATIBILITY | Retain until all legacy tenants are initialized and the compatibility column can be removed |
| `lib/organization-capabilities.server.ts` | Reads `organization.type` only as fallback input to capability assertion | COMPATIBILITY | Retain |
| `lib/domains/domain-resolver.server.ts` | Returns legacy organization type metadata and computes resolved capabilities | COMPATIBILITY | Retain metadata; routing uses `capabilities` |
| `proxy.ts` | Forwards legacy organization type header | COMPATIBILITY | Retain header for old consumers; route composition uses capabilities |
| `app/[locale]/shop/[slug]/layout.tsx` | Fallback input to `hasOrganizationCapability()` | COMPATIBILITY | Retain |
| `app/[locale]/appointment/[slug]/layout.tsx` | Fallback input to `hasOrganizationCapability()` | COMPATIBILITY | Retain |
| `app/[locale]/organization/[slug]/page.tsx` | Shell entry reads resolved capabilities | COMPATIBILITY | Retain capability authority |
| `app/[locale]/dashboard/organizations/page.tsx` | `publicOrganizationHref()` fallback plus legacy badges/icons | COMPATIBILITY / PRESENTATION | Runtime destination uses effective capabilities; type remains display fallback |
| `app/[locale]/dashboard/settings/organization/page.tsx` | Uses `organization.type` only when capability rows are not initialized | COMPATIBILITY | Retain fallback |
| `app/[locale]/shop/[slug]/profile/page.tsx` | Badge label | PRESENTATION | Retain |
| `app/api/dashboard/route.ts` | Returns `organizationType` metadata; dashboard data uses filtered effective capabilities | COMPATIBILITY | Retain metadata |
| `app/api/dashboard/organization-domains/**` | Fallback input to public route capability filter | COMPATIBILITY | Retain |
| `app/api/dashboard/shop-domains/[domainId]/vercel/route.ts` | Fallback input to `hasOrganizationCapability()` | COMPATIBILITY | Retain |
| `app/api/public/search/route.ts` | Fallback input to `hasOrganizationCapability()` | COMPATIBILITY | Retain |
| `app/api/public/custom-domain/sitemap/route.ts` | Fallback input to `hasOrganizationCapability()` | COMPATIBILITY | Retain |
| `app/api/public/organizations/[slug]/shop/route.ts` | Fallback input to `hasOrganizationCapability()` | COMPATIBILITY | Retain |
| `app/api/public/organizations/[slug]/services/route.ts` | Fallback input to `hasOrganizationCapability()` | COMPATIBILITY | Retain |
| `app/sitemap.ts` | Fallback input to `hasOrganizationCapability()` | COMPATIBILITY | Retain |
| `app/api/users/me/membership/route.ts` | Response metadata and fallback capability list | COMPATIBILITY | Retain until API consumers migrate |
| `lib/services/import-hub.service.ts` | Fallback input to `hasOrganizationCapability()` | COMPATIBILITY | Retain |
| `lib/services/creative-studio.service.ts` | Provider payload brand metadata | PRESENTATION | Retain |
| `prisma/seed.ts` | Seeds legacy type and derives initial capability rows | DATA INITIALIZATION | Retain |
| `scripts/e2e/deployed-media-upload-display.mjs` | Fixture assertion for deployed smoke users | PRESENTATION | Retain until deployed smoke fixtures are capability-based |
| docs/plans/quality scripts | Historical wording or source-text checks | PRESENTATION | Update when those documents/scripts are next revised |

SOURCE_OF_TRUTH remaining: 0.
