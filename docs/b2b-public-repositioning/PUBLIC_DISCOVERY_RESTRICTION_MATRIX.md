# Public Discovery Restriction Matrix

This matrix classifies every public discovery surface for the B2B repositioning.

## Classification

| Surface | Type | Action | Status |
|---|---|---|---|
| `app/[locale]/page.tsx` | B2B landing | Keep, B2B-only links | Done in P03 |
| `app/[locale]/demo/page.tsx` | Demo portfolio | Keep as official example surface | Done in P04 |
| `app/api/public/organizations` | Broad listing API | Restrict from nav/promotion; keep for tenant-scoped compatibility | P05 documented |
| `app/api/public/search` | Broad search API | Restrict from nav/promotion; keep for tenant-scoped compatibility | P05 documented |
| `components/home/home-hero.tsx` | Legacy search hero | Not imported; not linked; keep as dead code for now | P05 noted |
| `app/robots.ts` | SEO robots | Already disallows `/api/` | Kept |
| `app/sitemap.ts` | SEO sitemap | Includes tenant direct pages; excludes custom-domain duplication | Kept |

## Rules

- No public navigation or homepage link may point to `/api/public/organizations` or `/api/public/search` as a discovery feature.
- Tenant direct pages must continue to use tenant-scoped public APIs by slug.
- Demo page must remain the only promoted public example surface.
- Broad real-tenant discovery must not be advertised as a B2B feature.
