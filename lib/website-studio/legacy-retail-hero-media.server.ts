import "server-only";
import { resolveOrganizationHomeContent } from "@/lib/organization-home-content";
import type { WebsiteMedia } from "./retail-contract";

/** Read-only bridge for the already published pointer. Never used by gallery or write validation. */
export function legacyPublishedRetailHeroMedia(organizationSlug: string): WebsiteMedia[] {
  const content = resolveOrganizationHomeContent({ organizationSlug, locale: "fa" });
  if (!content) return [];
  const images = [content.hero.desktopImage, content.hero.mobileImage, ...content.collections.map((item) => item.image), ...content.featured.items.map((item) => item.image), ...content.lookbook.items.map((item) => item.image)];
  return [...new Map(images.map((image) => [image.src, image])).values()].map((image) => ({
    id: `brand:${organizationSlug}:${image.src}`, url: image.src,
    filename: image.src.split("/").at(-1) ?? "", mimeType: "image/webp", alt: image.alt,
  })).filter((image) => image.id.length <= 128);
}
