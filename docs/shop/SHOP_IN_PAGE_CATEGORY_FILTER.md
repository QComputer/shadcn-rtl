# Shop In-page Category Filter

Date: 2026-08-02

## Phase

`BAZAR-BAZ-SHOP-IN-PAGE-CATEGORY-FILTER-01`

## User Requirement

Shop category controls should behave like filter chips/tabs inside the menu, not links to separate category pages. A customer clicking a category must stay on the current shop page, keep the header/category bar/cart UI mounted, and immediately see only matching products. The all-products control restores the full visible product list.

## Previous Behavior

The custom-domain routing hotfix made direct category URLs safe and canonical, but the interactive shop menu still rendered category controls as `Link` elements. Normal clicks navigated to `/category/<categorySlugOrId>` on custom domains or `/<locale>/shop/<slug>/category/<categorySlugOrId>` on the platform.

## New Behavior

The main shop page remains the canonical interactive menu. Category controls in `app/[locale]/shop/[slug]/page.tsx` are now `<button type="button">` controls with `aria-pressed` state. They update `selectedCategoryId` client state and do not call `router.push`, change pathname, or perform a full reload.

Selecting the currently selected category keeps it selected. Selecting all products sets `selectedCategoryId` to `null`.

## Server/Client Boundary

The current shop page was already a Client Component that fetches safe public shop data from `/api/public/organizations/<slug>/shop`. This phase keeps sensitive resolution, custom-domain proxying, Prisma access, and tenant scoping outside the category click interaction.

Client-side state is limited to already-public menu data:

- `selectedCategoryId: string | null`
- `searchQuery: string`
- view mode and cart UI state

Filtering logic lives in `lib/shop-menu-filter.ts` so it can be tested without rendering the full page.

## Filter State Model

`null` means all products. A category id means products whose `categoryId` equals that id.

The filter uses stable category IDs, not display labels or parsed slugs. Visible products are derived from category/product relations already returned by the public shop API.

## Search Interaction

Search and category filters combine with AND semantics:

```txt
visibleProducts =
  products in selected category, when selected
  AND products matching search text
  AND products passing active/deleted/inventory visibility policy
```

Product ordering remains the existing descending `sortOrder` order.

## All Products

The all-products control is localized in Persian, Arabic, and English through `shop.allProducts`. It restores the complete visible product list without changing URL or remounting the page.

## Empty States

The product-list area shows localized empty states for:

- no products at all;
- selected category with no visible products;
- search with no matches;
- category plus search with no matches.

Normal in-page filtering never redirects or calls `notFound()`.

## Custom-domain Behavior

On custom domains such as `https://www.cafechakme.ir/`, normal category clicks keep the root path unchanged. Product detail links still use custom-domain product paths such as `/product/<productSlugOrId>`.

## Platform-domain Behavior

On the platform, normal category clicks keep `/<locale>/shop/<slug>` unchanged. Product detail links still use `/<locale>/shop/<slug>/product/<productSlugOrId>`.

## Direct Category-route Compatibility

Compatibility behavior is Option C: direct category URLs remain available as safe legacy/SEO pages. The fixed category route still:

- decodes percent-encoded Persian route segments;
- scopes lookup to the requested shop organization;
- redirects ID paths to canonical slug paths when appropriate;
- returns safe 404 for invalid or cross-tenant categories.

Normal in-menu category clicks no longer use these routes.

## Accessibility

Category controls are keyboard-accessible buttons with visible focus state and `aria-pressed`. The category strip scrolls horizontally on overflow for mobile and narrow layouts. There are no nested interactive elements in the category controls.

## Local Docker/browser E2E

`pnpm run e2e:shop:local-docker-in-page-category-filter` provisions disposable local PostgreSQL with Docker, runs normal `prisma migrate deploy`, seeds a synthetic SHOP organization, starts local Next.js, and verifies:

- platform root category clicks do not change pathname;
- custom-domain host category clicks do not navigate to `/category/...`;
- Persian, Arabic, and English category labels filter in place;
- all-products restores visible products;
- product links still point to product detail routes;
- direct encoded legacy category URLs remain safe.

The E2E refuses non-local database URLs and does not touch Production or hosted Preview data.

## Database and AI-media Safety

No Prisma schema change or migration is required. No Production DB dependency is added. The Product/Service AI-media attachment production migration remains pending separate authorization and is not completed by this phase.
