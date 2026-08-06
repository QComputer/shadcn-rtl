# Context-Aware Public Footer

Phase: `BAZAR-BAZ-CONTEXT-AWARE-PUBLIC-FOOTER-01`

## Original problem

The locale layout rendered the Bazar Baz platform footer after every localized page. That made tenant storefronts and custom-domain shops look like platform marketing pages, and appointment pages could render more than one footer.

## Footer contexts

- `platform`: Bazar Baz marketing and public platform pages.
- `shop`: public shop shell, product pages, checkout/order pages, category compatibility routes, and custom-domain shop rewrites.
- `service`: public appointment/service organization shell and custom-domain service rewrites.
- `none`: dashboard and auth/application shells where a public footer is not appropriate.

The context is assigned server-side in `proxy.ts` and read by `app/[locale]/layout.tsx` through the `x-bazar-public-footer-context` request header. The browser does not hide footers with pathname checks or CSS.

## Layout architecture

`app/[locale]/layout.tsx` owns only the platform footer. It renders `components/public/platform-footer.tsx` when the request context is `platform`.

`app/[locale]/shop/[slug]/layout.tsx` owns the shop footer. It already resolves the active shop and now renders `components/public/tenant-footer.tsx` with `kind: "shop"`.

`app/[locale]/appointment/[slug]/layout.tsx` owns the service organization footer. It renders the same tenant footer with `kind: "service"` and service-specific links.

Dashboard and auth routes are marked `none`, so they do not receive a public tenant footer or the platform footer.

## Tenant public data projection

Tenant footers receive a narrow public projection only:

- name
- slug
- type
- description
- address
- phone
- email
- logo
- optional location values where already used by the shell

Private member, owner, credential, payment, wallet, ledger, and internal settings data are not passed to the footer.

## Optional fields

Missing phone, email, address, logo, or description are omitted. The footer does not render placeholder values. Phone and email links are normalized before rendering.

## Link policy

Platform footer links stay platform-local under the active locale.

Shop footer links reuse `lib/shop-public-paths.ts`:

- custom-domain default-locale menu: `/`
- custom-domain checkout: `/checkout`
- non-default custom-domain locale: `/{locale}/...`
- platform shop URL: `/{locale}/shop/{slug}/...`

Service footers use tenant-root paths on custom domains and `/{locale}/appointment/{slug}/...` on platform URLs.

Intentional platform attribution uses an absolute `https://www.bazar-baz.ir` URL and is visually secondary.

## Accessibility and localization

Each public page should expose one semantic `<footer>` landmark. Footer links have text labels, decorative icons are hidden from assistive technology, and the surrounding locale layout keeps Persian/Arabic RTL and English LTR direction.

## Custom domains

Custom-domain rewrites set the footer context as `shop` or `service`. The tenant footer therefore renders from the internally rewritten tenant layout while preserving root-relative tenant links on the custom domain.

## Docker E2E

`pnpm run e2e:public-footer:local-docker` creates a disposable PostgreSQL container, applies migrations, seeds two shops with distinct public footer data, starts a local Next server, checks platform and tenant footers in desktop/mobile viewports, verifies one footer landmark, and cleans up owned resources.

## Schema and rollout

This phase adds no Prisma schema migration. Production rollout is source-only and should not run `prisma migrate deploy`, `prisma db push`, or `prisma migrate resolve` against Production.
