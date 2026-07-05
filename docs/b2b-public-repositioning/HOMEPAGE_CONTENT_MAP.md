# Homepage Content Map

This document maps every section of the B2B homepage to its content source.

## Section Map

| Section | Content Key | Source |
|---|---|---|
| Hero title/description/CTA | `hero` | `lib/content/b2b-homepage-content.ts` |
| Problem statement | `problem` | `lib/content/b2b-homepage-content.ts` |
| Solution statement | `solution` | `lib/content/b2b-homepage-content.ts` |
| Capabilities (9 groups) | `capabilities` | `lib/content/b2b-homepage-content.ts` |
| Dashboard explanation | embedded in `capabilities[5]` | `lib/content/b2b-homepage-content.ts` |
| Industry use cases (9) | `industries` | `lib/content/b2b-homepage-content.ts` |
| Demo businesses (5) | `demoBusinesses` | `lib/content/b2b-homepage-content.ts` |
| Customer communication | `notifications` | `lib/content/b2b-homepage-content.ts` |
| Trust/data ownership | `trust` | `lib/content/b2b-homepage-content.ts` |
| How it works (5 steps) | `howItWorks` | `lib/content/b2b-homepage-content.ts` |
| FAQ (5 questions) | `faq` | `lib/content/b2b-homepage-content.ts` |
| Footer/navigation | `footer` | `lib/content/b2b-homepage-content.ts` |
| SEO title/description | `seo` | `lib/content/b2b-homepage-content.ts` |

## Locale Support

- `fa` — full content
- `en` — hero + SEO placeholders
- `ar` — hero + SEO placeholders

P03 must expand `en` and `ar` placeholders before launch.

## Implementation Notes for P03

- Hero must clearly state B2B positioning
- No marketplace/discovery language
- Demo businesses must be explicitly labeled
- CTAs must lead to request-demo or demo portfolio
- Navigation must align with `docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md`
