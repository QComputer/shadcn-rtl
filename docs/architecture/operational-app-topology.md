# ADR: Operational application deployment topology

## Context

Bazarbaaz is a headless business operating system with an optional public experience. Capability, public presentation, endpoint role, SEO policy, and deployment topology remain independent. An organization can keep an external public website while Bazarbaaz serves its operational application either at `https://app.example.ir` or beneath `https://example.ir/app`.

BB-3E evaluates both shapes as independent Next.js production builds and runtimes. It does not provision DNS, change a proxy, deploy production, migrate production data, or activate payment.

## Current architecture

`OrganizationEndpoint` settings give `PUBLIC`, `APP`, `API`, and `CALLBACK` distinct semantic roles. There is no fallback from one role to another. `OrganizationDomain` is the authority for a verified hostname that Bazarbaaz receives; an endpoint references that domain to assign a role. Thus a routed APP hostname uses the existing ownership record plus `OrganizationEndpoint.APP`, rather than introducing a second host registry.

Public Catalog remains an anonymous platform/API read surface. PurchaseIntent contains the stable `Product.id`, preserves allowed source/campaign context, and resolves through the explicit APP endpoint. Its GET resolver revalidates organization, SHOP capability, and product state without creating a cart, order, payment request, or inventory reservation.

## Options and evidence

### A. APP_SUBDOMAIN

A root build (`APP_BASE_PATH` unset) owns the entire APP origin. Routes, `/_next` assets, `/api`, Auth.js, manifest, service worker, cookies, and caches retain root deployment behavior. Browser origin boundaries isolate the external public website from the operational session, service worker, push subscription, and caches.

If Bazarbaaz receives `app.example.ir`, the hostname must be an active, provider-verified, DNS-configured, TLS-ready `OrganizationDomain` belonging to that organization, and `OrganizationEndpoint.APP` must reference it. The endpoint role—not the existence of the domain alone—gives it APP meaning. Routing must not treat an APP endpoint as the organization's PUBLIC root.

Operational cookies remain host-only; no `Domain=.example.ir` sharing is required. A tenant-aware manifest is returned only when the request host and build prefix exactly match the resolved APP endpoint. Resolver failure, an absent APP endpoint, a PUBLIC-only host, or a prefix mismatch fails closed to the Bazarbaaz manifest.

### B. APP_PATH

The repository can produce a separate artifact with `APP_BASE_PATH=/app`. Next.js `basePath` is compile-time. Generated chunks live at `/app/_next/...`; application API and Auth.js requests live at `/app/api/...`; controlled operational cookies use `Path=/app/`; the manifest starts at `/app/fa` with scope `/app/`; and the service worker registers at `/app/web-push-sw.js` with `/app/` scope.

The reverse proxy must forward `/app` and `/app/...` unchanged. It must not strip the prefix. A root-built artifact cannot safely be mounted by adding or stripping paths at runtime. The owning edge may normalize `/app` to `/app/` while preserving the query string, but must not send root `/api`, `/_next`, or unrelated public paths to the APP deployment.

Equivalent nginx semantics are a prefix location whose upstream URI is omitted, for example conceptually `location /app/ { proxy_pass http://operational_upstream; }`. A `proxy_pass` URI ending in `/` would replace the matched prefix and is therefore incompatible with this build contract.

## Auth and cookie boundary

The public website ordinarily needs no Bazarbaaz customer session. The operational APP owns authentication. Auth.js uses application-prefixed browser endpoints and controlled cookies use `/` in the subdomain build or `/app/` in the path build. Cookies remain host-only and retain existing Secure/SameSite policy. Cross-subdomain authentication sharing is neither required nor enabled.

Invalid or expired sessions continue through normal Auth.js/protected-route behavior. Login, session, post-login destination, and logout must remain inside the compiled APP prefix exactly once.

## PWA, service worker, and web push

In subdomain mode, origin isolation prevents the APP service worker from controlling the public website. In path mode, registration URL, scope, navigation fallback, cache keys, static matches, notification assets, and click targets are base-path-aware. Scope is `/app/`, never `/`, so the external site's root remains outside APP control.

The dynamic manifest uses organization name, short name, and safe HTTPS or same-origin PWA icon overrides when the request resolves to the exact APP endpoint. Platform and fail-closed fallback remains Bazarbaaz. Existing branding has no maskable, theme, or background override fields, so canonical Bazarbaaz maskable icons and colors remain until such fields are deliberately modeled and validated.

Push subscription belongs to the APP origin. Notification targets retain the compiled prefix once. BB-3E performs no real push send.

## Assets, API, navigation, and redirects

Framework navigation uses the native build prefix. Explicit fetches, resources, cookies, Auth.js URLs, push URLs, and service-worker paths use the narrow application base-path helpers. Valid compile-time values are only empty and `/app`; relative values, trailing slashes, double slashes, dot segments, backslashes, URLs, queries, and fragments are rejected.

Locale stays `/fa/...` in a root/subdomain build and `/app/fa/...` in a path build. `/fa/app`, `/app/app`, prefix loss, and public-origin escape are invalid. PurchaseIntent query parameters remain intact through the APP endpoint join and resolver redirect.

## Callback and payment readiness

PUBLIC, APP, and CALLBACK remain separate. A machine-to-machine payment callback should use an explicit, stable, platform-controlled CALLBACK endpoint (the current platform origin or a future dedicated API origin), not a tenant public website and not an APP URL whose subdomain or `/app` mount may change. This permits public-site replacement and APP rollback without changing provider callbacks, and gives callback logging and incident response one stable boundary.

BB-P1 must reconcile the current iNoti routes with `OrganizationEndpoint.CALLBACK`, verify signature/correlation and production schema readiness, and choose the stable platform-controlled callback origin before activation. BB-3E does not change iNoti, payment state, callback routes, or provider configuration.

## Deployment and Vercel readiness

The same repository produces both artifacts from one compile-time input. A standard root Bazarbaaz deployment can accept verified APP custom domains after domain ownership and endpoint-role configuration. Path mode requires a separately built deployment with `APP_BASE_PATH=/app` plus an external-site reverse proxy that preserves the prefix. The two artifacts are not interchangeable.

## Operational comparison

| Concern | APP_SUBDOMAIN | APP_PATH |
| --- | --- | --- |
| Routing/assets | Native root behavior | Compile-time prefix everywhere |
| Auth/cookies | Host and origin isolated | Host shared; cookie path scoped where controlled |
| PWA/SW/cache | Origin isolated | Safe only with `/app/` scope and prefix-aware caches |
| Deployment | Independent of public site | Depends on public-site proxy availability/configuration |
| Debugging | Clear APP origin | Requires edge/upstream path correlation |
| Onboarding | DNS, TLS, verification | Proxy ownership and a distinct path build |
| Payment UI | Stable APP origin | Stable while proxy and prefix contract remain unchanged |
| Provider callback | Independent CALLBACK endpoint in both modes | Independent CALLBACK endpoint in both modes |

## Failure modes

APP_SUBDOMAIN failures are principally DNS/TLS provisioning, incomplete domain verification, assigning the wrong endpoint role, or accidentally broadening cookie Domain. APP_PATH failures are a build/proxy prefix mismatch, stripped prefixes, escaped assets/API calls, `/app/app` redirects, cookie Path mistakes, overly broad service-worker scope, and coupling outages to the external site. Both modes fail tenant branding to the platform manifest when host ownership or APP semantics cannot be proven.

## Decision

The default is **APP_SUBDOMAIN**. It has the stronger browser-enforced cookie, PWA, service-worker, cache, and deployment isolation; requires fewer prefix-aware call sites; and minimizes coupling between operational availability and the external website.

The supported secondary topology is **APP_PATH**, using a separately built artifact with `APP_BASE_PATH=/app` and a prefix-preserving reverse proxy. Support depends on the acceptance matrix continuing to show no application-owned network requests escaping `/app` and no service-worker control outside `/app/`.

## Rollout guidance

For a subdomain, build with an empty `APP_BASE_PATH`, verify and route the APP hostname, reference that `OrganizationDomain` from `OrganizationEndpoint.APP`, and confirm it is not assigned PUBLIC semantics.

For a path mount, build with `APP_BASE_PATH=/app`, configure `OrganizationEndpoint.APP` with the same origin and `/app` prefix, forward the complete prefix unchanged, and smoke `/app/`, locale, product/purchase, cart, checkout, auth/session/logout, operational API, manifest, service worker, and static chunks before exposure.

Roll out one tenant at a time with rollback to the previous APP endpoint/build. Keep provider callbacks on the independent CALLBACK boundary. Payment activation begins only in BB-P1 and later milestones.
