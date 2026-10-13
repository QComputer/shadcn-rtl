# Tenant-branded PWA configuration

Tenant PWA identity is resolved from the active organization mapped to the trusted request host. Platform hosts keep Bazarbaaz identity. Unknown or inactive custom domains receive no tenant icon and no Bazarbaaz fallback.

`GET /manifest.webmanifest` returns a host-scoped manifest. Regular 192/512, maskable 192/512, favicon, Apple Touch Icon and optional theme colors come from the matching `OrganizationBranding` row. A tenant with incomplete or invalid PWA icon configuration receives a browser-mode manifest and no install prompt. The tenant’s current organization name remains the app label; it is never replaced with the platform brand.

`GET /favicon.ico` is a dynamic no-store redirect to the active host’s configured favicon (or a same-tenant regular icon/logo). It returns 404 for an unknown host or for a tenant with no safe icon. HTML metadata advertises the current tenant favicon/Apple icon and manifest on localized pages, organization landing pages, shops and appointment pages.

Brand assets can be corrected through the organization-scoped admin endpoint `PATCH /api/organizations/{organizationId}/branding`. It requires an authenticated organization ADMIN (or platform SUPER_ADMIN), same-origin request, strict URL/color validation, and records the update and audit entry in one database transaction. The request body does not accept a tenant ID; the route’s organization path is the only write scope.

Example request body for an already-known organization (replace the path ID with the verified organization ID and submit as that organization’s administrator):

```json
{
  "faviconUrl": "/brand/tenants/aka-shoes/browser/favicon.ico",
  "appleTouchIconUrl": "/brand/tenants/aka-shoes/pwa/apple-touch-icon-180.png",
  "pwaIcon192Url": "/brand/tenants/aka-shoes/pwa/icon-192x192.png",
  "pwaIcon512Url": "/brand/tenants/aka-shoes/pwa/icon-512x512.png",
  "pwaMaskable192Url": "/brand/tenants/aka-shoes/pwa/maskable-192x192.png",
  "pwaMaskable512Url": "/brand/tenants/aka-shoes/pwa/maskable-512x512.png"
}
```

For Restaurant Italiano 13, use the existing files under `/brand/tenants/restaurant-13/brand/production-ready/`: `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, and `icon-maskable-512.png`. Runtime code contains no Aka Shoes or Restaurant 13 slug checks. The payloads above are operational configuration examples only; this change does not update any existing tenant record.

## Deployment and installed-app behavior

The committed migration `20260830000300_tenant_branding_extensions` already adds nullable maskable-icon URLs and optional manifest colors. This fix adds those existing database fields to the Prisma model; it needs no new migration and does not change existing rows. The feature remains safe until an administrator configures approved assets.

The manifest `id` stays equal to its existing `start_url` (`/fa`, or `/app/fa` in an `/app` build), preserving the prior identity while browser origin keeps different tenant installations separate. `scope` remains `/` or `/app/`. Manifest, favicon and tenant icon requests are not cached by the service worker. Its cache version is bumped so the old platform-icon cache is retired during its normal update; unrelated registrations and browser data are untouched.

After deployment, browsers update the manifest, service worker and launcher icon on their normal update cycle. Android does not guarantee immediate launcher icon refresh. First reopen the installed app online and allow the service worker/manifest update. Reinstall only if the launcher continues showing the old image after the browser confirms the new manifest. Reinstallation is not automatically triggered by this code.

No existing tenant’s database configuration was inspected or changed by the source work. Before applying either example, verify the organization ID and current values through the authenticated management flow; do not issue an unapproved Production update.
