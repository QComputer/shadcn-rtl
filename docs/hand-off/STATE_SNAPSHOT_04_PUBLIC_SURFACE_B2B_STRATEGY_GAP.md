# STATE-SNAPSHOT-04: Public Surface and B2B Strategy Gap

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## New Desired Strategy
- B2B service platform for Iranian businesses
- Businesses are the primary buyer/user
- Platform capabilities: business management, customer communication, commerce, booking, customer club, campaigns, notifications, mini social/media presence
- Public marketplace-like browsing removed or heavily reduced
- Only selected demo businesses remain as portfolio/examples
- Homepage: professional B2B service-introduction landing page for Bazar Baz itself

## Current Public Surface Analysis

### Homepage (`app/[locale]/page.tsx`)
- Current behavior: Generic public landing page with organization listings/search
- Contains marketplace-like browsing elements
- Does not position Bazar Baz as a B2B SaaS platform
- Missing: B2B value proposition, business onboarding CTA, demo business showcase, dashboard screenshots, feature breakdown for businesses

### Public Shop/Search/Listing Behavior
- `app/[locale]/shop/[slug]/` — Shop storefronts exist and are functional
- `app/api/public/organizations` — Public org listing/search API exists
- `app/api/public/search` — Public search API exists
- `app/api/public/organizations/[slug]` — Public org detail exists
- `app/api/public/organizations/[slug]/services` — Public services listing exists
- `app/api/public/organizations/[slug]/shop` — Public shop data exists
- Current behavior: Marketplacesque browsing of businesses/services/products
- Risk: Exposes full tenant data publicly without B2B framing

### Public Marketplace/Social Behavior
- Fanpage posts (`/fanpage`, `/api/public/organizations/[slug]/fanpage/posts`) — social-like content exists
- Reviews (`/reviews`, `/api/reviews`) — public review system exists
- Public order tracking (`/api/public/orders/[orderNumber]`) — customer-facing order tracking
- These features are functional but not aligned with B2B platform positioning

## B2B Strategy Gap Report

### Pages That Should Remain
1. `/:locale/login` and `/:locale/register` — Auth flows are fine
2. `/:locale/register/organization` — Business onboarding is fine
3. `/:locale/shop/[slug]` — Individual demo/examplar shop pages are acceptable as portfolio
4. `/:locale/shop/[slug]/checkout` — Functional checkout for demo transactions
5. `/:locale/appointment/[slug]/booking` — Booking flow demonstrates capability

### Pages That Should Be Removed or Restricted
1. **Public homepage** (`/`) — Needs complete B2B repositioning
2. **Public organization listing/search** (`/api/public/organizations`, `/api/public/search`) — Should be removed or replaced with curated demo list
3. **Public fanpage browsing** — Reduce visibility; make fanpage a demo feature, not a public discovery mechanism
4. **Public reviews** — May not fit B2B platform positioning; consider removing or gating

### Pages That Should Be Converted to Demo/Examples
1. `/:locale/shop/[slug]` — Convert to explicit demo business portfolio
2. `/:locale/appointment/[slug]` — Convert to demo appointment booking example
3. Public checkout flow — Keep as functional demo, but brand as "see it in action"

### Missing Homepage Sections (B2B)
1. **Hero section** — Clear B2B value proposition for Iranian businesses
2. **Features section** — Business management, customer communication, commerce, booking, campaigns, notifications
3. **How it works** — Step-by-step business onboarding flow
4. **Dashboard showcase** — Screenshots/demo of admin dashboard
5. **Demo businesses** — Curated list of example tenant businesses
6. **Pricing/plans** — SaaS pricing tiers (even if not yet implemented)
7. **Request demo / Contact CTA** — Lead generation for B2B sales
8. **Trust signals** — Iranian business compliance, security, reliability
9. **Integration highlights** — SMS.ir, Web Push, Vercel Blob, AI media
10. **Statistics/social proof** — Business count, transaction volume, uptime

### Missing Business Onboarding/CTA Pages
1. `/request-demo` — Lead capture form
2. `/pricing` — Pricing plans
3. `/for-businesses` — B2B landing variant
4. `/how-it-works` — Platform walkthrough
5. `/demo` — Interactive demo or video
6. `/contact` — Sales contact

### Missing Dashboard Screenshots/Demo Storytelling
- No dedicated marketing pages with dashboard screenshots
- No video walkthrough
- No interactive demo
- No case studies / success stories
- No Iranian business testimonials

### Recommended Public Surface Reduction
1. Remove public `/api/public/organizations` listing or replace with hardcoded demo tenants
2. Remove `/api/public/search` or restrict to demo tenants only
3. Reduce public fanpage/review prominence
4. Keep order tracking (`/api/public/orders/[orderNumber]`) as it's customer-facing and useful
5. Keep public shop pages but brand them as "demo businesses"

## Risk Summary
- Current public surface leaks tenant data and positions the product as a marketplace, not a B2B platform
- SEO may be indexing marketplace-like pages
- No clear conversion path for business signups on the homepage
- Demo businesses are indistinguishable from production tenants
