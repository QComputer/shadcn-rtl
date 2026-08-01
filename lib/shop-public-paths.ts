const DEFAULT_LOCALE = "fa";
const SUPPORTED_LOCALES = new Set(["fa", "en", "ar"]);

function normalizeLocale(locale: string) {
  return SUPPORTED_LOCALES.has(locale) ? locale : DEFAULT_LOCALE;
}

function normalizeSubPath(subPath: string) {
  if (!subPath || subPath === "/") return "/";
  return subPath.startsWith("/") ? subPath : `/${subPath}`;
}

export function buildShopPublicPath(input: {
  locale: string;
  shopSlug: string;
  subPath?: string;
  isCustomDomain?: boolean;
}) {
  const locale = normalizeLocale(input.locale);
  const subPath = normalizeSubPath(input.subPath || "/");

  if (input.isCustomDomain) {
    return locale === DEFAULT_LOCALE ? subPath : `/${locale}${subPath === "/" ? "" : subPath}`;
  }

  return `/${locale}/shop/${input.shopSlug}${subPath === "/" ? "" : subPath}`;
}

export function buildShopCategoryPath(input: {
  locale: string;
  shopSlug: string;
  categorySegment: string;
  isCustomDomain?: boolean;
  page?: number;
}) {
  const basePath = buildShopPublicPath({
    locale: input.locale,
    shopSlug: input.shopSlug,
    subPath: `/category/${input.categorySegment}`,
    isCustomDomain: input.isCustomDomain,
  });

  return input.page && input.page > 1 ? `${basePath}?page=${input.page}` : basePath;
}

export function buildShopProductPath(input: {
  locale: string;
  shopSlug: string;
  productSegment: string;
  isCustomDomain?: boolean;
}) {
  return buildShopPublicPath({
    locale: input.locale,
    shopSlug: input.shopSlug,
    subPath: `/product/${input.productSegment}`,
    isCustomDomain: input.isCustomDomain,
  });
}
