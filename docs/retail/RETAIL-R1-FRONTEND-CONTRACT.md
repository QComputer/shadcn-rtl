# Retail R1 frontend contract

## Renderer inputs

The renderer is vertical-neutral. It consumes a `RetailStorefrontView` assembled server-side from trusted tenant context or, for the explicit local preview routes only, from synthetic in-memory fixtures.

```ts
type RetailStorefrontView = {
  locale: "fa" | string;
  direction: "rtl" | "ltr";
  theme: "FASHION" | "ELECTRONICS" | "GENERAL";
  preview: boolean;
  brand: { name: string; logoUrl?: string; accent?: string; surface?: string };
  categories: Array<{ id: string; label: string; href?: string }>;
  products: RetailProduct[];
};
type RetailProduct = {
  id: string; slug: string; title: string; description?: string;
  categoryIds: string[]; media: Array<{ src: string; alt: string; order: number }>;
  attributes: Array<{ key: string; label: string; value: string; filterable: boolean }>;
  variants: Array<{ id: string; label: string; sku?: string; price: number | null; availability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN"; purchasable: boolean }>;
};
```

## UI behavior

- Homepage: brand header, category navigation, editorial hero, collections and featured products, with search entry.
- Catalog: category, text, structured-attribute, and supported price filters; deterministic sorting; responsive cards; explicit loading, error and empty states.
- Detail: image gallery with useful alt text, title/description, product attributes/specification table, explicit variant selection and variant-specific price/availability.
- A purchase CTA is rendered as actionable only when server-provided `purchasable` is true and a validated retail-compatible cart/order flow is connected. Preview actions are disabled and the preview limitation is explained in Persian.
- Theme affects presentation only. Components may not branch on a tenant slug or assume footwear/electronics attributes exist. Unknown attributes render as labeled data, without hardcoded schema fields.
- Device serial/IMEI values are never part of public catalog data.

## Preview data rules

Both current sample stores set `preview: true`, show an always-visible Persian preview notice, use PREVIEW-coded sample SKUs, and do not call commerce APIs. Sample price/stock is fabricated solely to exercise visual states and must not be mistaken for real inventory. Production tenant pages must never load these fixtures as a fallback.

## Accessibility and responsive behavior

Persian-first RTL; use semantic headings/landmarks, keyboard-operable filter controls, visible focus, associated labels, sufficient touch targets and meaningful image alt text. Test widths 360, 390, 768, 1024 and 1440. Keep imagery responsive and avoid unnecessary client state; production search/filter may use URL state and server filtering where data volume requires it.

## Current implementation notes

The R1 route is `/fa/retail-preview/{fashion|electronics}`. It is a deterministic runnable UI fixture, not a live organization shop, and all purchase buttons stay disabled. The existing organization `/shop` flow and restaurant routes remain independently owned.
