import "server-only";
import { prisma } from "@/lib/db-runtime";
import { ApiError } from "@/lib/api-guards";
import { getPublicCatalogProduct, listPublicCatalogProducts } from "@/lib/public-catalog/service.server";
import { retailWebsiteMedia } from "./brand-media";
import { retailContentSchema, type RetailContent, type WebsiteMedia } from "./retail-contract";
import { readRetailHeroPublication, type PublishedRetailHero } from "./retail-hero-contract";

export function resolveRetailHero(content: RetailContent, media: WebsiteMedia[]): PublishedRetailHero | null {
  const hero = content.hero;
  if (!hero) return null;
  const { desktopImageId, mobileImageId, darkDesktopImageId, darkMobileImageId, ...config } = hero;
  const desktopImage = media.find(image => image.id === desktopImageId)?.url ?? null;
  const mobileImage = media.find(image => image.id === mobileImageId)?.url ?? null;
  const darkDesktopImage = media.find(image => image.id === darkDesktopImageId)?.url ?? null;
  const darkMobileImage = media.find(image => image.id === darkMobileImageId)?.url ?? null;
  // A revoked campaign image must not continue rendering from a cached URL.
  if (hero.enabled && hero.mode === "CAMPAIGN" && !desktopImage) return null;
  return { ...config, desktopImage, mobileImage, darkDesktopImage, darkMobileImage };
}

export async function retailHeroProducts(slug: string, ids: string[]) {
  const results = await Promise.all(ids.slice(0, 3).map(async id => {
    try { return await getPublicCatalogProduct(slug, id); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }));
  return results.filter(Boolean);
}

/** Only the published pointer is public; drafts and revision metadata never leave this adapter. */
export async function getPublishedRetailHero(slug: string) {
  const org = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, capabilities: { some: { key: "SHOP", status: "ACTIVE", enabledAt: { not: null } } } },
    select: { id: true, slug: true, settings: { select: { settings: true } } },
  });
  const pointer = readRetailHeroPublication(org?.settings?.settings);
  if (!org || !pointer?.revisionId) return null;
  const row = await prisma.tenantWebsiteRevision.findFirst({ where: { id: pointer.revisionId, organizationId: org.id }, select: { content: true } });
  const parsed = retailContentSchema.safeParse(row?.content);
  if (!parsed.success) return null;
  const images = await prisma.image.findMany({ where: { organizationId: org.id, access: "PUBLIC" }, select: { id: true, url: true, filename: true, mimeType: true } });
  const hero = resolveRetailHero(parsed.data, retailWebsiteMedia(org.slug, images));
  if (!hero) return null;
  return { hero, products: hero.mode === "PRODUCTS" ? await retailHeroProducts(slug, hero.productIds) : [] };
}

export async function studioProductChoices(slug: string, selectedIds: string[] = []) {
  const page = await listPublicCatalogProducts({ organizationIdentifier: slug, page: 1, limit: 50 });
  const extra = await retailHeroProducts(slug, selectedIds.filter(id => !page.products.some(product => product.id === id)));
  return [...page.products, ...extra];
}
