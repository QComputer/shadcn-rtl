import { splitLocalePrefix } from "@/lib/custom-domain-routing";

export type PublicFooterContext = "platform" | "shop" | "service" | "none";

export function getPublicFooterContextForPathname(pathname: string): PublicFooterContext {
  const { pathnameWithoutLocale } = splitLocalePrefix(pathname);
  const firstSegment = pathnameWithoutLocale.split("/").filter(Boolean)[0] || "";

  if (firstSegment === "shop") return "shop";
  if (firstSegment === "appointment") return "service";
  if (
    firstSegment === "dashboard" ||
    firstSegment === "login" ||
    firstSegment === "register" ||
    firstSegment === "auth"
  ) {
    return "none";
  }

  return "platform";
}
