import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";

function normalizeSubPath(subPath: string) {
  if (!subPath || subPath === "/") return "/";
  return subPath.startsWith("/") ? subPath : `/${subPath}`;
}

export function decodePublicRouteSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function buildShopPublicPath(input: {
  locale: string;
  shopSlug: string;
  subPath?: string;
  isCustomDomain?: boolean;
}) {
  return buildOrganizationPublicPath({
    locale: input.locale,
    organizationSlug: input.shopSlug,
    surface: "shop",
    subPath: normalizeSubPath(input.subPath || "/"),
    isCustomDomain: input.isCustomDomain,
  });
}

export function buildShopProductsPath(input: {
  locale: string;
  shopSlug: string;
  isCustomDomain?: boolean;
  useCustomDomainRoot?: boolean;
}) {
  return buildShopPublicPath({
    locale: input.locale,
    shopSlug: input.shopSlug,
    isCustomDomain: input.isCustomDomain,
  });
}

export function buildShopCheckoutPath(input: {
  locale: string;
  shopSlug: string;
  isCustomDomain?: boolean;
}) {
  return buildShopPublicPath({
    locale: input.locale,
    shopSlug: input.shopSlug,
    subPath: "/checkout",
    isCustomDomain: input.isCustomDomain,
  });
}

export function buildShopOrderPath(input: {
  locale: string;
  shopSlug: string;
  orderNumber: string;
  isCustomDomain?: boolean;
}) {
  return buildShopPublicPath({
    locale: input.locale,
    shopSlug: input.shopSlug,
    subPath: `/order/${input.orderNumber}`,
    isCustomDomain: input.isCustomDomain,
  });
}

export function isShopCustomDomainPathname(input: {
  pathname: string;
  locale: string;
  shopSlug: string;
}) {
  const platformRoot = buildOrganizationPublicPath({
    locale: input.locale,
    organizationSlug: input.shopSlug,
    surface: "shop",
  });
  return !(input.pathname === platformRoot || input.pathname.startsWith(`${platformRoot}/`));
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
