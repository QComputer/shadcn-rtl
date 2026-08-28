import { splitLocalePrefix } from "@/lib/custom-domain-routing";

export type PublicFooterContext = "platform" | "shop" | "service" | "none";

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

  return "platform";
}
