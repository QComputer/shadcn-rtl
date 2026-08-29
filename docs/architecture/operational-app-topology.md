# ADR: Operational application deployment topology

## Context

Bazarbaaz separates the public experience from its operational application. An organization's `APP` endpoint may own a full origin such as `https://app.example.ir`, or a build mounted beneath `https://example.ir/app`. BB-3E exercised both as real Next.js production builds and runtimes; it did not deploy either topology.

## Options and evidence

### A. APP subdomain

The root build owns its origin, so Next.js routes, `/_next` assets, `/api`, Auth.js, the manifest, service worker, cookies and caches all retain their normal root-relative behavior. The public website does not share the operational origin, session cookie, service-worker scope or caches. Each APP hostname must be routed to the operational deployment and represented by the resolved `OrganizationEndpoint.APP`; it must not be classified as a PUBLIC tenant root.

### B. `/app` path mount

The same repository builds with `APP_BASE_PATH=/app`. Next.js `basePath` is compile-time: the proxy must forward `/app/...` unchanged to that build. Generated chunks use `/app/_next/...`; operational APIs and Auth.js use `/app/api/...`; the manifest starts and scopes at `/app/`; service-worker assets, caches and notification targets are prefix-aware; application cookies use `Path=/app/`. A root-built artifact cannot be mounted safely by stripping or adding paths at runtime.

## Decision

The default is **APP_SUBDOMAIN**. It provides stronger cookie, PWA, service-worker, cache and deployment isolation, requires fewer base-path-aware call sites, and does not couple operational availability to the external website's reverse proxy.

The supported secondary topology is **APP_PATH** using a separately built artifact with `APP_BASE_PATH=/app`. It is appropriate when one-origin ownership is required and the public site's proxy can preserve the prefix exactly.

## Constraints

- APP endpoints are explicit; there is no PUBLIC fallback.
- Public Catalog remains on the stable platform/API origin.
- Operational client fetches, static resources, redirects, Auth.js and push targets must use the application base-path contract.
- A path deployment must register its service worker with `/app/` scope and must not control public-site routes.
- Session sharing with the public website is neither required nor permitted by default. Subdomain cookies remain host-only; path-mode application cookies use `/app/` where controlled by Bazarbaaz.
- Provider callbacks use the independent `CALLBACK` endpoint role. APP `basePath` must not silently rewrite existing callback URLs.
- No tenant-specific domain, DNS, Vercel or reverse-proxy configuration is stored in this ADR.

## Rollout guidance

For a subdomain, build with an empty `APP_BASE_PATH`, attach the APP hostname to the operational deployment, configure `OrganizationEndpoint.APP`, and ensure host routing treats it as operational rather than PUBLIC.

For a path mount, build a separate artifact with `APP_BASE_PATH=/app`; forward `/app`, `/app/_next`, `/app/api`, `/app/manifest.webmanifest`, `/app/web-push-sw.js` and all descendants without stripping `/app`. Redirect `/app` to `/app/` at the owning edge while preserving query parameters. Do not forward root `/api`, `/_next` or the public site's unrelated paths to this artifact.
