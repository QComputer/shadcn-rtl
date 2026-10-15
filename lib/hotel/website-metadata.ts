import type { Metadata } from "next";
import { buildLocaleAlternates } from "@/lib/seo";
import type { TenantSeoContext } from "@/lib/custom-domain-seo";
import type { getPublishedHotelWebsite } from "@/lib/hotel/content/hotel-website-public.service";

type HotelWebsiteMetadataState = Awaited<ReturnType<typeof getPublishedHotelWebsite>>;
type HotelSeoContext = Pick<TenantSeoContext, "baseUrl" | "path" | "alternatePath">;

const noIndexRobots: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false, noimageindex: true },
};

/**
 * Build metadata only from the currently published, localized Hotel revision.
 * No organization description, inventory facts, or image is substituted when
 * approved localized content is absent.
 */
export function buildHotelWebsiteMetadata(input: {
  state: HotelWebsiteMetadataState;
  locale: string;
  seoContext?: HotelSeoContext;
}): Metadata {
  if (input.state?.mode !== "PUBLISHED" || !input.seoContext) {
    return {
      title: "Hotel website unavailable",
      description: "",
      alternates: { canonical: null, languages: {} },
      robots: noIndexRobots,
      openGraph: { title: "Hotel website unavailable", description: "", images: [] },
      twitter: { card: "summary", title: "Hotel website unavailable", description: "", images: [] },
    };
  }

  const content = input.state.content;
  const title = content.title?.trim() || content.hero.heading?.trim() || "Hotel website";
  const description = content.introduction.body?.trim() || content.hero.subheading?.trim() || "";
  const alternates = buildLocaleAlternates(
    input.locale,
    input.seoContext.path,
    input.seoContext.alternatePath,
    input.seoContext.baseUrl,
  );
  const canonical = alternates.canonical;

  return {
    ...(input.seoContext.baseUrl ? { metadataBase: new URL(input.seoContext.baseUrl) } : {}),
    title,
    description,
    alternates,
    robots: { index: true, follow: true },
    openGraph: { type: "website", title, description, url: canonical, images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}
