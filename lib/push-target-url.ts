import {
  buildTenantPublicPath,
  buildOrganizationPublicPath,
  getShopSubPathFromPlatformPath,
  isPlatformHost,
} from "@/lib/custom-domain-routing";

/** Returns a same-origin deep link suitable for a service-worker notification. */
export function normalizePushTargetUrl(value?: string | null) {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) {
    throw new Error("Push target URL must be same-origin");
  }
  return value;
}

export function adaptPushTargetUrlForOrigin(input: {
  targetUrl?: string | null;
  subscriptionOrigin: string;
  organizationSlug: string;
}) {
  const targetUrl = normalizePushTargetUrl(input.targetUrl);
  if (isPlatformHost(new URL(input.subscriptionOrigin).hostname)) return targetUrl;

  const platformPath = getShopSubPathFromPlatformPath(targetUrl, input.organizationSlug);
  return platformPath
    ? buildTenantPublicPath(platformPath.locale, platformPath.subPath)
    : targetUrl;
}

export function buildOrderPushTargetUrl(input: {
  organizationSlug: string;
  orderNumber: string;
  locale?: string;
  audience: "CUSTOMER" | "DRIVER";
}) {
  const locale = input.locale || "fa";
  if (input.audience === "DRIVER") return `/${locale}/dashboard/driver-orders`;

  return buildOrganizationPublicPath({
    locale,
    organizationSlug: input.organizationSlug,
    surface: "shop",
    subPath: `/order/${encodeURIComponent(input.orderNumber)}`,
  });
}
