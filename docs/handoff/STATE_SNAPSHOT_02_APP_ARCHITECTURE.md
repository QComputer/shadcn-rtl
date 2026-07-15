# Bazar Baz Handoff Snapshot 02 - Application Architecture

## Stack

| Area | Current State |
| --- | --- |
| Framework | Next.js `16.2.7` observed in build output; package constraint `^16.1.6` |
| React | `19.2.3` |
| TypeScript | `^5` |
| Prisma CLI | `6.19.3` observed in generate output; package constraint `^6.19.2` |
| Prisma Client | `6.19.3` generated locally; package constraint `^6.19.2` |
| Database | PostgreSQL via Prisma, configured by `DATABASE_URL` |
| Auth | NextAuth beta v5 with credentials/OAuth support in `lib/auth.ts`; Prisma adapter |
| Storage | Vercel Blob via `@vercel/blob`; upload route at `app/api/upload/route.ts`; media helpers in `lib/media-storage.ts` |
| Deployment | Vercel Next.js project `shadcn-rtl`; production alias `www.bazar-baz.ir` |
| UI | App Router, Tailwind CSS 4, shadcn/Radix UI, lucide icons |
| Localization | `fa`, `en`, `ar`; Persian-first default; localized route segment `app/[locale]` |
| RTL/LTR | Locale layout and dictionaries drive direction; Persian and Arabic are RTL, English is LTR |
| PWA/Web Push | Manifest, root service worker `public/web-push-sw.js`, PushSubscription/WebPushDelivery models, VAPID env split |
| SMS | SMS.ir provider behind server-only client and explicit real-send gates; dry-run default |
| Custom domains | `proxy.ts` host routing, `OrganizationDomain`, internal resolver API, dashboard onboarding, Vercel automation behind exact ACK gate |

## Major Modules

| Module | Main Files | Notes |
| --- | --- | --- |
| Public B2B surface | `app/[locale]/page.tsx`, `lib/content/b2b-homepage-content.ts`, `app/[locale]/features`, `demo`, `pricing`, `contact`, `trust`, `privacy`, `terms` | Persian-first business-owner messaging; not marketplace positioning |
| Tenant shop pages | `app/[locale]/shop/[slug]/**`, public organization/shop APIs | Direct tenant storefront and customer flows remain preserved |
| Tenant appointment pages | `app/[locale]/appointment/[slug]/**`, public service/staff APIs | Direct booking and service discovery for appointment orgs |
| Dashboard | `app/[locale]/dashboard/**`, `lib/dashboard/navigation-policy.ts`, `lib/access-control.ts` | Role-aware navigation and route gating |
| Auth/authorization | `lib/auth.ts`, `lib/api-guards.ts`, `lib/access-control.ts` | Session, roles, organization membership, resource access checks |
| Product/service/order core | `lib/services/product.service.ts`, `order.service.ts`, appointment/service/category APIs | Multi-tenant operational modules |
| Customer club | `app/[locale]/dashboard/customer-club/**`, `app/api/dashboard/customer-club/**`, membership/segment/campaign/coupon models | B2B engagement tools |
| Notifications | `lib/services/notification-*`, `app/api/dashboard/notification-operations/**` | In-app, Web Push, SMS, attempts, retry metadata |
| SMS.ir | `lib/sms/**`, dashboard SMS report APIs | Server-only client, dry-run default, reports/reconciliation |
| Web Push | `lib/services/web-push-foundation.service.ts`, `components/public/web-push-opt-in.tsx`, `public/web-push-sw.js` | VAPID split, opt-in/out, delivery history |
| Request demo | `app/[locale]/request-demo/**`, `app/api/request-demo/route.ts`, `app/[locale]/dashboard/request-demo-leads/**` | Public lead capture plus SUPER_ADMIN review |
| Custom domains | `proxy.ts`, `lib/domains/**`, `lib/vercel-domain-automation.ts`, `app/api/dashboard/organization-domains/**` | Source accepted; production activation still gated |
| Imports/exports | `app/[locale]/dashboard/imports`, `exports`, `lib/import-hub/**`, `ExportJob` | Operational data import/export foundations |
| Creative Studio | `app/[locale]/dashboard/creative-studio/**`, `CreativeStudio*` models | Present but not current priority |

