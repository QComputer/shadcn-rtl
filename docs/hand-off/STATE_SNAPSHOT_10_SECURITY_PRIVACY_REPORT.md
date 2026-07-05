# STATE-SNAPSHOT-10: Security and Privacy Report

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Secret Files Present but Excluded
- `.env` — gitignored, excluded from snapshot
- `.env.local` — not present
- `.env.production` — removed from working tree after Vercel pull issues
- `vercel.env` / `.env.vercel` — not present
- `scripts/ops/push-vercel-env.ps1` — present in repo (operational script); no secrets inside
- `scripts/ops/apply-notification-delivery-attempt-migration.mjs` — present; no secrets inside

## Committed Secret Scan Summary
- **SMS_IR_API_KEY**: NOT found in committed source
- **VAPID_PRIVATE_KEY**: NOT found in committed source
- **DATABASE_URL**: NOT found in committed source
- **NEXTAUTH_SECRET**: NOT found in committed source
- **GOOGLE_CLIENT_SECRET**: NOT found in committed source
- **BLOB_READ_WRITE_TOKEN**: NOT found in committed source
- **Full phone numbers**: Not hardcoded in source

## SMS_IR_API_KEY Exposure Check
- **Server-only**: Yes (`lib/sms/sms-ir-client.server.ts`)
- **Client-exposed**: No
- **API response exposure**: No
- **Dashboard DTO masking**: Phone numbers masked via `lib/sms/sms-ir-report-validation.ts`

## VAPID Private Key Exposure Check
- **Server-only**: Yes (`WEB_PUSH_VAPID_PRIVATE_KEY` used only in server-side `web-push` library)
- **Client-exposed**: No
- **Public key exposure**: Expected (NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY is client-accessible by design)
- **Status endpoint**: Returns booleans only, not key values

## DATABASE_URL Exposure Check
- **Server-only**: Yes (`prisma/schema.prisma` uses `env("DATABASE_URL")`)
- **Client-exposed**: No
- **Next.js config**: No DB URLs in client bundle

## NEXT_PUBLIC_* Risk Check
- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`: Low risk (public key by design)
- `NEXT_PUBLIC_DEPLOYED_APP_URL`: Low risk
- `NEXT_PUBLIC_APP_URL`: Not present
- **Risk**: Any future `NEXT_PUBLIC_*` secret must be reviewed for public exposure

## Full Phone Number Exposure Risk
- **Risk level**: LOW
- **Mitigation**: Masking utilities in `lib/sms/sms-ir-report-validation.ts`
- **Dashboard DTOs**: Masked before rendering
- **API responses**: Masked

## Tenant Isolation Concerns
- **Organization-based multi-tenancy**: Implemented
- **Access control**: `lib/access-control.ts` enforces per-route role/org checks
- **Dashboard route guard**: `app/[locale]/dashboard/layout.tsx` requires auth + org membership
- **API guards**: `requireCurrentOrganizationId`, `requireOrgAccess` used extensively
- **Known gap**: `/dashboard/notification-operations` was missing from route config (fixed in `b6c7e50`)

## Dashboard API Auth Concerns
- **Auth**: NextAuth session required for all dashboard APIs
- **Role checks**: Enforced per route in `dashboardRouteConfig`
- **Org membership**: Required for most dashboard routes
- **Super-admin routes**: Organizations, users, shop-domains restricted to SUPER_ADMIN
- **Customer APIs**: Separate namespace `/api/customer/*` with customer role enforcement

## Public Route Exposure Concerns
- **Public org listing**: `/api/public/organizations` — exposes tenant data publicly
- **Public search**: `/api/public/search` — exposes tenant data publicly
- **Public order tracking**: `/api/public/orders/[orderNumber]` — low risk, customer-facing
- **Public shop pages**: Functional but may need B2B repositioning
- **Recommendation**: Restrict public org listing/search to demo tenants only

## Socket/Realtime Security
- **localhost:4001 leak**: Fixed
- **Production Socket.IO**: Disabled by default; gated behind `NEXT_PUBLIC_SIGNALING_SERVER_URL`
- **URL validation**: `isSafePublicRealtimeUrl` rejects localhost/private IPs in production
- **Fallback**: Polling and Web Push used as fallbacks

## Input Validation
- **Zod schemas**: Used for API request validation
- **Prisma**: Type-safe queries
- **No SQL injection vectors**: ORM-only data access

## Rate Limiting
- **Implementation**: `lib/rate-limit.ts` present
- **Usage**: Not verified in all routes

## Security Headers
- **Implementation**: `next.config.ts` sets security headers
- **Headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP

## CORS/CSRF
- **NextAuth**: Built-in CSRF protection
- **CORS**: Not explicitly configured (same-origin assumed)

## Recommendations
1. Restrict `/api/public/organizations` and `/api/public/search` to demo tenants
2. Audit all `NEXT_PUBLIC_*` vars for accidental secret exposure
3. Verify rate limiting is applied to public auth endpoints
4. Add explicit CORS headers if cross-origin access is needed
5. Consider adding HSTS header for production
