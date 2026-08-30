import { splitLocalePrefix } from "@/lib/custom-domain-routing";

export type PublicFooterContext = "platform" | "shop" | "service" | "none";

const PLATFORM_ROUTE_SEGMENTS = new Set([
  "brand", "contact", "dashboard-showcase", "demo", "domain-not-configured",
  "external-root", "features", "onboarding", "organization", "pricing",
  "privacy", "request-demo", "terms", "trust", "visitor-choice",
]);

export function getPublicFooterContextForPathname(pathname: string): PublicFooterContext {
  const { pathnameWithoutLocale } = splitLocalePrefix(pathname);
  const [firstSegment = "", secondSegment = ""] = pathnameWithoutLocale.split("/").filter(Boolean);

  if (firstSegment === "shop" || secondSegment === "shop") return "shop";
  if (firstSegment === "appointment" || secondSegment === "appointment") return "service";
  if (
    firstSegment === "dashboard" ||
    firstSegment === "login" ||
    firstSegment === "register" ||
    firstSegment === "auth"
  ) {
    return "none";
  }

  // A single non-reserved segment below a locale is an Organization root.
  // Its capability or brand renderer owns the tenant footer.
  if (firstSegment && !secondSegment && !PLATFORM_ROUTE_SEGMENTS.has(firstSegment)) return "none";

  return "platform";
}
