# STATE-SNAPSHOT-11: Recommended Roadmap

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Current State Summary
- Core platform is production-ready with 67 database models
- Notifications/SMS/Web Push are fully implemented and validated (P120A-P120F)
- Creative Studio is implemented but deprioritized
- Public surface is currently marketplace-like; needs B2B repositioning
- Playwright deployed smokes blocked by geographic CDN restriction (needs manual run)
- Vercel env sync issues resolved; production environment is stable

## Recommended Next Phases (Non-Creative-Studio)

### Phase 1: Public Surface Cleanup and B2B Homepage Repositioning
- **Goal**: Transform public homepage into professional B2B service-introduction landing page
- **Scope**:
  - Redesign homepage with B2B value proposition
  - Add features section (business management, customer communication, commerce, booking, campaigns, notifications)
  - Add how-it-works flow
  - Add request-demo/contact CTA
  - Add dashboard screenshots/demo storytelling
  - Add demo business portfolio section
  - Restrict or remove public org listing/search
  - Reduce fanpage/review prominence from public discovery
- **Out of scope**:
  - New feature development
  - Creative Studio changes
  - Pricing/payment infrastructure
- **Validation gates**:
  - `quality:public-seo` passes
  - `quality:public-experience` passes
  - Manual review of B2B positioning
- **Risk level**: LOW (content/design changes only, no core logic changes)

### Phase 2: Demo Business Strategy and Demo Data
- **Goal**: Create curated demo businesses for portfolio/examples
- **Scope**:
  - Select 3-5 demo tenant businesses
  - Seed demo data (products, services, appointments, orders, campaigns)
  - Brand public shop pages as "demo" explicitly
  - Remove or archive non-demo tenant data from public access
- **Out of scope**:
  - Real tenant onboarding changes
  - New tenant acquisition flow
- **Validation gates**:
  - Demo data seeded successfully
  - Public routes only show demo tenants
  - `quality:tenant-identity` passes
- **Risk level**: LOW

### Phase 3: Business Onboarding/CTA Flow
- **Goal**: Add clear B2B onboarding path for new business users
- **Scope**:
  - `/request-demo` page with lead capture form
  - `/pricing` page with SaaS pricing tiers (even if placeholder)
  - `/for-businesses` landing variant
  - `/how-it-works` walkthrough
  - Integration with customer-club segmentation for lead tracking
- **Out of scope**:
  - Actual billing/payment integration
  - Automated trial provisioning
- **Validation gates**:
  - New pages render correctly
  - Lead capture form submits to dashboard
  - `quality:public-seo-qa` passes
- **Risk level**: LOW-MEDIUM

### Phase 4: Dashboard Showcase/Reporting Pages
- **Goal**: Add dashboard screenshots and reporting for marketing/SEO
- **Scope**:
  - `/dashboard-screenshots` or `/features` marketing pages
  - OG image optimization for B2B pages
  - Custom OG images for B2B landing sections
  - Social preview cards for B2B content
- **Out of scope**:
  - New dashboard features
  - New reporting logic
- **Validation gates**:
  - `quality:tenant-og-images` passes
  - `quality:deployed-social-preview` passes
  - OG images render correctly
- **Risk level**: LOW

### Phase 5: Tenant-Safe Public Demo Examples
- **Goal**: Ensure public demo pages are safe, branded, and conversion-oriented
- **Scope**:
  - Add "Demo" badges to demo shop pages
  - Add contact CTA on demo shop pages
  - Ensure no real tenant data leaks in public pages
  - Add "Powered by Bazar Baz" branding
- **Out of scope**:
  - New tenant self-service features
  - Marketplace features
- **Validation gates**:
  - No tenant data leakage in public responses
  - Demo branding consistent
  - `quality:public-experience` passes
- **Risk level**: LOW

### Phase 6: Remove/Restrict Marketplace-Like Public Pages
- **Goal**: Reduce marketplace/social browsing from public surface
- **Scope**:
  - Remove or restrict `/api/public/organizations` listing
  - Remove or restrict `/api/public/search`
  - Reduce public fanpage/review visibility
  - Keep order tracking (`/api/public/orders/[orderNumber]`) as it's customer-facing
  - Add redirects or 404s for removed pages
- **Out of scope**:
  - Internal dashboard marketplace features (if any)
  - Admin workflows
- **Validation gates**:
  - Removed routes return 404/redirect
  - No broken internal links
  - SEO redirects configured
- **Risk level**: MEDIUM (requires careful redirect/SEO handling)

### Phase 7: Add SaaS/B2B Pricing/Contact/Request-Demo Pages
- **Goal**: Complete B2B conversion funnel
- **Scope**:
  - `/pricing` with 3-tier plans
  - `/request-demo` lead capture
  - `/contact` sales contact form
  - `/terms` and `/privacy` legal pages
  - Integration with notification ops for lead notifications
- **Out of scope**:
  - Stripe/payment integration
  - Automated provisioning
- **Validation gates**:
  - Forms submit correctly
  - Leads appear in notification ops
  - `quality:notification-operations` passes
- **Risk level**: LOW-MEDIUM

## Non-Priority (Defer)
- Creative Studio new features
- Additional import/export formats
- Advanced AI media features
- New notification channels (email, Telegram bot, etc.)
- Marketplace expansion
- Social network features

## Top Blockers for B2B Transition
1. **Public homepage redesign** — highest priority for B2B positioning
2. **Public org listing exposure** — needs restriction/removal
3. **Demo data strategy** — needs definition and seeding
4. **Lead capture infrastructure** — request-demo forms and notification routing
5. **Playwright deployed smokes** — needs browser binary access for CI
