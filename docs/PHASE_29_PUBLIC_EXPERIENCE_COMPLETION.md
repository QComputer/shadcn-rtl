# P29 — Public Experience Completion

## Goal

Make the visible public surfaces more resilient before adding the fanpage MVP. This phase is intentionally broader than a pure validator phase but avoids large business-flow rewrites.

## Implemented changes

### Public image resilience

Added:

```txt
components/public/public-image.tsx
```

The component:

- renders normal images when the source exists and loads successfully;
- falls back to a themed icon/gradient placeholder when the source is missing or broken;
- supports decorative and accessible fallback modes;
- is safe for client pages and server-rendered public routes because it is an isolated Client Component.

Updated image usage in:

```txt
app/[locale]/page.tsx
components/home/home-hero.tsx
app/[locale]/appointment/[slug]/page.tsx
app/[locale]/shop/[slug]/page.tsx
```

These public surfaces no longer use raw `<img>` tags directly.

### Public navigation polish

Updated:

```txt
app/[locale]/appointment/[slug]/layout.tsx
app/[locale]/shop/[slug]/layout.tsx
```

The appointment public layout now exposes profile/services/booking/my appointments navigation. The shop layout now exposes products/checkout navigation.

### Dictionary support

Updated FA/EN/AR dictionaries for missing keys needed by public layout navigation.

### Guardrail

Added:

```txt
scripts/quality/validate-public-experience.mjs
pnpm run quality:public-experience
```

The validator checks public image fallback usage, public layout navigation, dictionary keys, and P29 documentation. It is included in `quality:local`.

## Validation

Sandbox source validation passed:

```bash
node scripts/quality/validate-public-experience.mjs
node scripts/quality/validate-project.mjs
node scripts/quality/validate-release-artifact.mjs /mnt/data/bazar_baz_p29_overlay_stage
```

Required target validation:

```powershell
pnpm run quality:public-experience
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Remaining debt

- Full copy/i18n cleanup is still pending.
- Fanpage route/feed/posts are still pending.
- Missing `/uploads/*` files can still return 404, but public UI now has visible image fallbacks when those URLs are used in page images.
