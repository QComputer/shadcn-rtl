import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@/lib/api-guards";
import { initialRetailContent, referencedWebsiteImages, type RetailContent } from "@/lib/website-studio/retail-contract";
import { RetailWebsiteService, type StudioPrincipal } from "@/lib/website-studio/retail.service";
import { resolveRetailHeroThemeImages, retailHeroSchema, readRetailHeroPublication, type RetailHeroPublication } from "@/lib/website-studio/retail-hero-contract";
import { resolveRetailHero } from "@/lib/website-studio/retail-hero.server";

const org = { id: "org-1", name: "نمونه", slug: "sample", description: null, phone: null, email: null, address: null };
const principal: StudioPrincipal = { userId: "user-1", role: "ADMIN", organizationId: "org-1" };
const image = { id: "hero-image", url: "https://store.public.blob.vercel-storage.com/hero.jpg", filename: "hero.jpg", mimeType: "image/jpeg" };
const secondImage = { id: "hero-image-mobile", url: "https://store.public.blob.vercel-storage.com/mobile.jpg", filename: "mobile.jpg", mimeType: "image/jpeg" };
const darkImage = { id: "hero-image-dark", url: "https://store.public.blob.vercel-storage.com/dark.jpg", filename: "dark.jpg", mimeType: "image/jpeg" };

function content(heroOverrides: Record<string, unknown> = {}): RetailContent {
  const base = initialRetailContent(org);
  return {
    ...base,
    hero: {
      enabled: true,
      mode: "CAMPAIGN",
      heading: "تابستان تازه",
      description: "مجموعه تازه را ببینید",
      ctaLabel: "مشاهده",
      ctaHref: "/fa/retail/sample",
      desktopImageId: image.id,
      mobileImageId: secondImage.id,
      darkDesktopImageId: "",
      darkMobileImageId: "",
      imageAlt: "مجموعه تابستانی",
      imageFit: "cover",
      focalX: 50,
      focalY: 50,
      productIds: [],
      autoplay: false,
      ...heroOverrides,
    },
  } as RetailContent;
}

type PublicationOptions = {
  membership?: boolean;
  organization?: typeof org | null;
  userRole?: string;
  settings?: unknown;
  revisions?: Record<string, RetailContent | null>;
  images?: typeof image[];
  products?: string[];
};

function publicationService(options: PublicationOptions = {}) {
  let settings = options.settings ?? null;
  const audit: unknown[] = [];
  const sql: string[] = [];
  const values: unknown[][] = [];
  const revisionLookups: unknown[] = [];
  const imageLookups: unknown[] = [];
  const productLookups: unknown[] = [];
  const tx = {
    user: { findFirst: async () => options.userRole === "MISSING" ? null : { role: options.userRole ?? "ADMIN" } },
    organization: { findFirst: async () => options.organization === null ? null : options.organization ?? org },
    organizationMember: { findFirst: async () => options.membership === false ? null : { id: "member-1" } },
    organizationSettings: { findUnique: async () => settings === null ? null : { settings } },
    tenantWebsiteRevision: { findFirst: async ({ where }: { where: { id: string; organizationId: string } }) => {
      revisionLookups.push(where);
      const revision = options.revisions?.[where.id];
      return revision ? { content: revision } : null;
    } },
    image: { findMany: async (query: unknown) => { imageLookups.push(query); return options.images ?? [image, secondImage]; } },
    product: { findMany: async ({ where }: { where: { id: { in: string[] }; organizationId: string; category: { organizationId: string; isActive: boolean } } }) => {
      productLookups.push(where);
      return (options.products ?? where.id.in).filter(id => where.id.in.includes(id)).map(id => ({ id }));
    } },
    auditLog: { create: async ({ data }: { data: unknown }) => { audit.push(data); return {}; } },
    $queryRaw: async () => [],
    $executeRaw: async (strings: TemplateStringsArray, ...interpolations: unknown[]) => {
      sql.push(strings.join("?"));
      values.push(interpolations);
      const publicationValue = interpolations.find(value => typeof value === "string" && String(value).includes('"revisionId"'));
      if (typeof publicationValue === "string") {
        const publication = JSON.parse(publicationValue) as RetailHeroPublication;
        settings = { ...(settings && typeof settings === "object" ? settings : {}), retailHeroPublication: publication };
      }
      return 1;
    },
  };
  const db = { $transaction: async <T>(callback: (transaction: unknown) => Promise<T>) => callback(tx) };
  return { service: new RetailWebsiteService(db as never), audit, sql, values, revisionLookups, imageLookups, productLookups, currentSettings: () => settings };
}

function publish(revisionId: string, basePublishedRevisionId: string | null = null) {
  return { action: "publish", revisionId, basePublishedRevisionId } as const;
}

function rollback(revisionId: string, basePublishedRevisionId: string | null) {
  return { action: "rollback", revisionId, basePublishedRevisionId } as const;
}

test("Retail hero contract rejects unsafe destinations, invalid media ids, duplicate products, and out-of-range focal points", () => {
  const valid = content().hero!;
  assert.equal(retailHeroSchema.safeParse(valid).success, true);
  for (const href of ["//outside.example", "https://outside.example", "javascript:alert(1)", "data:text/html,hello", "/path with spaces"]) {
    assert.equal(retailHeroSchema.safeParse({ ...valid, ctaHref: href }).success, false, href);
  }
  assert.equal(retailHeroSchema.safeParse({ ...valid, desktopImageId: "" }).success, false);
  assert.equal(retailHeroSchema.safeParse({ ...valid, productIds: ["p1", "p1"], mode: "PRODUCTS" }).success, false);
  assert.equal(retailHeroSchema.safeParse({ ...valid, productIds: ["p1", "p2", "p3", "p4"], mode: "PRODUCTS" }).success, false);
  assert.equal(retailHeroSchema.safeParse({ ...valid, productIds: ["", "p2"], mode: "PRODUCTS" }).success, false);
  assert.equal(retailHeroSchema.safeParse({ ...valid, focalX: -1 }).success, false);
  assert.equal(retailHeroSchema.safeParse({ ...valid, focalY: 101 }).success, false);
  assert.equal(retailHeroSchema.safeParse({ ...valid, unexpected: true }).success, false);
});

test("hero contract defaults dark images for saved legacy revisions and resolves theme-specific images only from eligible tenant media", () => {
  const legacy = { ...content().hero! } as Record<string, unknown>;
  delete legacy.darkDesktopImageId;
  delete legacy.darkMobileImageId;
  const parsedLegacy = retailHeroSchema.parse(legacy);
  assert.equal(parsedLegacy.darkDesktopImageId, "");
  assert.equal(parsedLegacy.darkMobileImageId, "");

  const themed = content({ darkDesktopImageId: darkImage.id });
  const resolved = resolveRetailHero(themed, [image, secondImage, darkImage]);
  assert.equal(resolved?.darkDesktopImage, darkImage.url);
  assert.equal(resolved?.darkMobileImage, null);
  assert.equal("darkDesktopImageId" in (resolved ?? {}), false);
  assert.equal(resolveRetailHero(themed, [image, secondImage])?.darkDesktopImage, null);
  assert.deepEqual(referencedWebsiteImages(themed), [image.id, secondImage.id, darkImage.id]);
});

test("hero theme image selection prefers the active theme across desktop and mobile breakpoints", () => {
  const images = { desktopImage: "light-desktop", mobileImage: "light-mobile", darkDesktopImage: "dark-desktop", darkMobileImage: null };
  assert.deepEqual(resolveRetailHeroThemeImages(images, "dark"), {
    desktop: "dark-desktop", mobile: "dark-desktop", hasMobileImage: true,
  });
  assert.deepEqual(resolveRetailHeroThemeImages({ ...images, darkDesktopImage: null, darkMobileImage: "dark-mobile" }, "dark"), {
    desktop: "dark-mobile", mobile: "dark-mobile", hasMobileImage: true,
  });
  assert.deepEqual(resolveRetailHeroThemeImages({ ...images, desktopImage: null }, "light"), {
    desktop: "light-mobile", mobile: "light-mobile", hasMobileImage: true,
  });
  assert.deepEqual(resolveRetailHeroThemeImages({ ...images, mobileImage: null, darkMobileImage: null }, "light"), {
    desktop: "light-desktop", mobile: "light-desktop", hasMobileImage: false,
  });
});

test("hero resolution includes eligible images and hides a campaign when its image is revoked", () => {
  const resolved = resolveRetailHero(content(), [image, secondImage]);
  assert.equal(resolved?.desktopImage, image.url);
  assert.equal(resolved?.mobileImage, secondImage.url);
  assert.equal("desktopImageId" in (resolved ?? {}), false);
  assert.equal("revisionId" in (resolved ?? {}), false);
  assert.equal(resolveRetailHero(content(), [secondImage]), null);
  assert.equal(resolveRetailHero(content({ mode: "PRODUCTS", productIds: ["product-1"] }), [secondImage])?.desktopImage, null);
});

test("publication checks current tenant management membership and rejects a stale published pointer", async () => {
  const noMembership = publicationService({ membership: false, revisions: { r1: content() } });
  await assert.rejects(noMembership.service.changePublication(principal, "org-1", publish("r1")), (error: unknown) => error instanceof ApiError && error.status === 403);

  const noScope = publicationService({ organization: null, revisions: { r1: content() } });
  await assert.rejects(noScope.service.changePublication(principal, "org-1", publish("r1")), (error: unknown) => error instanceof ApiError && error.status === 403);

  const stale = publicationService({
    settings: { retailHeroPublication: { revisionId: "r2", previousRevisionId: "r1", publishedAt: "2026-11-01T12:00:00.000Z" } },
    revisions: { r1: content(), r2: content() },
  });
  await assert.rejects(stale.service.changePublication(principal, "org-1", publish("r1", "r1")), (error: unknown) => error instanceof ApiError && error.status === 409);
  assert.equal(stale.sql.length, 0);
});

test("publication requires an immutable revision owned by the tenant and currently eligible media", async () => {
  const missingRevision = publicationService({ revisions: { foreign: null } });
  await assert.rejects(missingRevision.service.changePublication(principal, "org-1", publish("foreign")), (error: unknown) => error instanceof ApiError && error.status === 404);

  const changedDraft = content({ desktopImageId: "private-image" });
  const mediaRevoked = publicationService({ revisions: { r1: changedDraft }, images: [] });
  await assert.rejects(mediaRevoked.service.changePublication(principal, "org-1", publish("r1")), (error: unknown) => error instanceof ApiError && error.status === 422);
  assert.equal(mediaRevoked.audit.length, 0);
  assert.equal(mediaRevoked.sql.length, 0);

  const foreignDarkAsset = content({ darkDesktopImageId: "image-from-another-tenant" });
  const darkMediaRevoked = publicationService({ revisions: { r1: foreignDarkAsset } });
  await assert.rejects(darkMediaRevoked.service.changePublication(principal, "org-1", publish("r1")), (error: unknown) => error instanceof ApiError && error.status === 422);
  assert.equal(darkMediaRevoked.audit.length, 0);
  assert.equal(darkMediaRevoked.sql.length, 0);

  const themed = publicationService({ revisions: { r1: content({ darkDesktopImageId: darkImage.id, darkMobileImageId: darkImage.id }) }, images: [image, secondImage, darkImage] });
  assert.equal((await themed.service.changePublication(principal, "org-1", publish("r1"))).revisionId, "r1");

  const valid = publicationService({ revisions: { r1: content() } });
  const result = await valid.service.changePublication(principal, "org-1", publish("r1"));
  assert.equal(result.revisionId, "r1");
  assert.equal(result.previousRevisionId, null);
  assert.deepEqual(valid.revisionLookups, [{ id: "r1", organizationId: "org-1" }]);
  assert.deepEqual(valid.imageLookups, [{ where: { organizationId: "org-1", access: "PUBLIC" }, select: { id: true, url: true, filename: true, mimeType: true, organizationId: true, access: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }]);
  assert.equal(valid.audit.length, 1);
  assert.match(valid.sql[0] ?? "", /COALESCE\("OrganizationSettings"\.settings,'\{\}'::jsonb\) \|\| jsonb_build_object\('retailHeroPublication'/);
});

test("product hero publication rejects products outside the published tenant catalog", async () => {
  const productsContent = content({ mode: "PRODUCTS", productIds: ["product-1", "product-2"] });
  const noLongerPublished = publicationService({ revisions: { r1: productsContent }, products: ["product-1"] });
  await assert.rejects(noLongerPublished.service.changePublication(principal, "org-1", publish("r1")), (error: unknown) => error instanceof ApiError && error.status === 422);
  assert.equal(noLongerPublished.sql.length, 0);

  const accepted = publicationService({ revisions: { r1: productsContent }, products: ["product-1", "product-2"] });
  assert.equal((await accepted.service.changePublication(principal, "org-1", publish("r1"))).revisionId, "r1");
  assert.deepEqual(accepted.productLookups, [{ id: { in: ["product-1", "product-2"] }, organizationId: "org-1", isActive: true, deletedAt: null, category: { organizationId: "org-1", isActive: true, deletedAt: null } }]);
});

test("rollback restores the preceding immutable revision, preserves unrelated settings, then can clear first publication", async () => {
  const previous = { revisionId: "r1", previousRevisionId: null, publishedAt: "2026-10-30T12:00:00.000Z" };
  const current = { revisionId: "r2", previousRevisionId: "r1", publishedAt: "2026-11-01T12:00:00.000Z" };
  const existingSettings = { checkout: { enabled: true }, unrelatedFlag: "keep", retailHeroPublication: current };
  const service = publicationService({ settings: existingSettings, revisions: { r1: content({ heading: "نسخه قبلی" }), r2: content({ heading: "نسخه فعلی" }) } });

  const restored = await service.service.changePublication(principal, "org-1", rollback("r2", "r2"));
  assert.equal(restored.revisionId, "r1");
  assert.equal(restored.previousRevisionId, "r2");
  assert.deepEqual(service.currentSettings(), { checkout: { enabled: true }, unrelatedFlag: "keep", retailHeroPublication: restored });
  assert.match(service.sql[0] ?? "", /COALESCE\("OrganizationSettings"\.settings,'\{\}'::jsonb\) \|\| jsonb_build_object\('retailHeroPublication'/);
  assert.equal(service.audit.length, 1);

  const clearFirst = publicationService({
    settings: { retailHeroPublication: { revisionId: "r1", previousRevisionId: null, publishedAt: "2026-10-30T12:00:00.000Z" } },
    revisions: { r1: content() },
  });
  const unpublished = await clearFirst.service.changePublication(principal, "org-1", rollback("r1", "r1"));
  assert.equal(unpublished.revisionId, null);
  assert.equal(unpublished.previousRevisionId, "r1");
  assert.equal(readRetailHeroPublication(clearFirst.currentSettings())?.revisionId, null);
});
