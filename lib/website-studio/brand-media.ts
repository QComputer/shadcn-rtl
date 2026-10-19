import "server-only";
import { resolveOrganizationHomeContent } from "@/lib/organization-home-content";
import { isEligibleWebsiteImage } from "./core";
import type { WebsiteMedia } from "./retail-contract";

/** Stable tenant-scoped id for one approved, file-backed brand image. */
export function tenantBrandMediaId(slug: string, url: string) {
  return `brand:${slug}:${url}`;
}

/** Use only the assets already published for this tenant's organization homepage. */
export function tenantBrandWebsiteMedia(organizationSlug: string): WebsiteMedia[] {
  const content = resolveOrganizationHomeContent({ organizationSlug, locale: "fa" });
  if (!content) return [];
  const sources = [
    content.hero.desktopImage,
    content.hero.mobileImage,
    ...content.collections.map((item) => item.image),
    ...content.featured.items.map((item) => item.image),
    ...content.lookbook.items.map((item) => item.image),
  ];
  const unique = new Map(sources.map((image) => [image.src, image]));
  return [...unique.values()].flatMap((image) => {
    const filename = image.src.split("/").at(-1) ?? "";
    const media: WebsiteMedia = {
      id: tenantBrandMediaId(organizationSlug, image.src),
      url: image.src,
      filename,
      mimeType: "image/webp",
      source: "TENANT_BRAND",
      alt: image.alt,
    };
    return media.id.length <= 128 ? [media] : [];
  });
}

/** Merge approved brand media with public uploads that can be delivered here. */
export function retailWebsiteMedia(organizationSlug: string, images: WebsiteMedia[], hasBlobReadWriteToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN)) {
  const uploadImages = images.filter(isEligibleWebsiteImage).filter((image) => hasBlobReadWriteToken || !image.url.startsWith("/uploads/"));
  return [...tenantBrandWebsiteMedia(organizationSlug), ...uploadImages];
}
