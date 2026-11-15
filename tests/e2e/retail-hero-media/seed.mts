import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createStoredImageFilename, writeStoredImage } from "@/lib/media-storage";
import { initialRetailContent, retailContentSchema } from "@/lib/website-studio/retail-contract";
import { retailHeroSchema } from "@/lib/website-studio/retail-hero-contract";
import { legacyPublishedRetailHeroMedia } from "@/lib/website-studio/legacy-retail-hero-media.server";

function target() {
  assert.equal(process.env.RETAIL_HERO_MEDIA_DISPOSABLE, "true");
  assert.equal(process.env.DATABASE_URL, process.env.DIRECT_URL);
  assert.equal(process.env.DATABASE_RUNTIME_ADAPTER, "postgresql");
  assert.equal(process.env.APPLICATION_STORAGE_ADAPTER, "persistent-disk");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, process.env.RETAIL_HERO_MEDIA_DB_PORT);
  assert.match(url.pathname, /^\/retail_hero_e2e_[a-z0-9_]{8,32}$/i);
  return decodeURIComponent(url.pathname.slice(1));
}

const database = target();
const db = new PrismaClient();
const stamp = randomBytes(6).toString("hex");
const slug = "aka-shoes";
const managerName = `hero-manager-${stamp}`;
const managerPassword = process.env.RETAIL_HERO_MEDIA_MANAGER_PASSWORD;
assert.ok(managerPassword && managerPassword.length >= 16, "an ephemeral manager password must be provided by the acceptance runner");

try {
  const identity = await db.$queryRaw<Array<{ database: string }>>`SELECT current_database() AS database`;
  assert.equal(identity[0]?.database, database);
  assert.equal(await db.organization.count(), 0, "disposable fixture database must start without organizations");
  assert.equal(await db.user.count(), 0, "disposable fixture database must start without accounts");

  const organization = await db.organization.create({ data: {
    name: "فروشگاه آزمایشی رسانه هیرو", slug, type: "SHOP", locale: "fa", isActive: true,
    capabilitiesInitializedAt: new Date(),
  } });
  const foreign = await db.organization.create({ data: {
    name: "فروشگاه دوم جداسازی", slug: `${slug}-foreign`, type: "SHOP", locale: "fa", isActive: true,
    capabilitiesInitializedAt: new Date(),
  } });
  await db.organizationCapability.createMany({ data: [organization.id, foreign.id].map(organizationId => ({ organizationId, key: "SHOP" as const, status: "ACTIVE" as const, enabledAt: new Date() })) });
  const password = await bcrypt.hash(managerPassword, 10);
  const manager = await db.user.create({ data: { name: managerName, password, role: "MANAGER", isActive: true, isTeamMember: true, locale: "fa" } });
  await db.organizationMember.create({ data: { organizationId: organization.id, organizationSlug: slug, userId: manager.id, role: "MANAGER", isActive: true } });
  await db.organizationSettings.create({ data: { organizationSlug: slug, currency: "IRR", settings: { retailCatalog: { productExperience: "VARIANTS_V1" } } } });

  const legacy = new Set(legacyPublishedRetailHeroMedia(slug).map(image => image.id));
  const legacyDesktop = `brand:${slug}:/brand/tenants/${slug}/home/hero/aka-home-hero-desktop.webp`;
  const legacyMobile = `brand:${slug}:/brand/tenants/${slug}/home/hero/aka-home-hero-mobile.webp`;
  const legacyAbout = `brand:${slug}:/brand/tenants/${slug}/home/collections/aka-collection-dark.webp`;
  const legacyPublishedHero = `brand:${slug}:/brand/tenants/${slug}/home/lookbook/aka-lookbook-green-yellow.webp`;
  for (const id of [legacyDesktop, legacyMobile, legacyAbout, legacyPublishedHero]) assert.ok(legacy.has(id), `expected mapped Aka Shoes legacy reference: ${id}`);
  const occupiedLegacyIds = new Set([legacyDesktop, legacyMobile, legacyAbout, legacyPublishedHero]);
  const legacyNew = legacyPublishedRetailHeroMedia(slug).find(image => !occupiedLegacyIds.has(image.id))?.id;
  assert.ok(legacyNew, "a second mapped static asset is required to test introduced legacy references");

  const initial = initialRetailContent({ name: organization.name, description: null, phone: null, address: null, email: null });
  const legacyContent = retailContentSchema.parse({
    ...initial,
    hero: retailHeroSchema.parse({ enabled: true, mode: "CAMPAIGN", heading: "Synthetic legacy Aka hero", description: "Disposable legacy media fixture", ctaLabel: "مشاهده مجموعه", ctaHref: "", desktopImageId: legacyPublishedHero, mobileImageId: legacyPublishedHero, darkDesktopImageId: "", darkMobileImageId: "", imageAlt: "Legacy fixture", imageFit: "cover", focalX: 50, focalY: 50, productIds: [], autoplay: false }),
    sections: initial.sections.map(section => {
      if (section.kind === "HERO") return { ...section, visible: false, imageId: legacyDesktop };
      if (section.kind === "ABOUT") return { ...section, imageId: legacyAbout };
      if (section.kind === "GALLERY") return { ...section, visible: false, imageIds: [legacyMobile, legacyDesktop] };
      return section;
    }),
  });
  const legacyRevisionId = randomUUID();
  await db.tenantWebsiteRevision.create({ data: { id: legacyRevisionId, organizationId: organization.id, content: legacyContent, createdBy: manager.id, requestId: randomUUID() } });
  await db.organizationSettings.update({ where: { organizationSlug: slug }, data: { settings: { retailCatalog: { productExperience: "VARIANTS_V1" }, retailHeroPublication: { revisionId: legacyRevisionId, previousRevisionId: null, publishedAt: new Date().toISOString() } } } });

  const bytes = await (await import("node:fs/promises")).readFile("public/retail-preview/preview-fashion-campaign.png");
  const galleryCount = 25;
  for (let index = 0; index < galleryCount; index++) {
    const filename = createStoredImageFilename("image/png", `gallery-fixture-${String(index + 1).padStart(2, "0")}`);
    const stored = await writeStoredImage(filename, bytes, "PUBLIC", organization.id);
    await db.image.create({ data: { url: stored.url, filename: stored.pathname, mimeType: "image/png", sizeBytes: bytes.length,
      purpose: "retail-hero-gallery-fixture", access: "PUBLIC", organizationId: organization.id, uploadedByUserId: manager.id,
      createdAt: new Date(Date.UTC(2026, 10, 13, 0, 0, index)) } });
  }
  const foreignFilename = createStoredImageFilename("image/png", "foreign-gallery-fixture");
  const foreignStored = await writeStoredImage(foreignFilename, bytes, "PUBLIC", foreign.id);
  const foreignImage = await db.image.create({ data: { url: foreignStored.url, filename: foreignStored.pathname, mimeType: "image/png", sizeBytes: bytes.length,
    purpose: "retail-hero-gallery-fixture", access: "PUBLIC", organizationId: foreign.id, uploadedByUserId: manager.id,
    createdAt: new Date(Date.UTC(2026, 10, 14, 0, 0, 0)) } });
  const privateFilename = createStoredImageFilename("image/png", "private-gallery-fixture");
  const privateImage = await db.image.create({ data: { url: `https://private-fixtures.public.blob.vercel-storage.com/${privateFilename}`, filename: privateFilename, mimeType: "image/png", sizeBytes: bytes.length,
    purpose: "retail-hero-private-fixture", access: "PRIVATE", organizationId: organization.id, uploadedByUserId: manager.id } });
  const revokedFilename = createStoredImageFilename("image/png", "revoked-gallery-fixture");
  const revokedStored = await writeStoredImage(revokedFilename, bytes, "PUBLIC", organization.id);
  const revokedImage = await db.image.create({ data: { url: revokedStored.url, filename: revokedStored.pathname, mimeType: "image/png", sizeBytes: bytes.length,
    purpose: "retail-hero-revoked-fixture", access: "PUBLIC", organizationId: organization.id, uploadedByUserId: manager.id } });
  await db.image.update({ where: { id: revokedImage.id }, data: { access: "PRIVATE" } });
  const missingFilename = createStoredImageFilename("image/png", "missing-disk-fixture");
  const missingDiskImage = await db.image.create({ data: { url: `/api/media/${encodeURIComponent(organization.id)}/tenants/${encodeURIComponent(organization.id)}/uploads/${encodeURIComponent(missingFilename)}`, filename: missingFilename, mimeType: "image/png", sizeBytes: bytes.length,
    purpose: "retail-hero-missing-disk-fixture", access: "PUBLIC", organizationId: organization.id, uploadedByUserId: manager.id } });
  console.log(JSON.stringify({ organizationId: organization.id, slug, managerName, galleryCount, foreignOrganizationId: foreign.id, foreignImageId: foreignImage.id, privateImageId: privateImage.id, revokedImageId: revokedImage.id, missingDiskImageId: missingDiskImage.id, missingDiskFilename: missingFilename, legacyRevisionId, legacyDesktop, legacyMobile, legacyAbout, legacyPublishedHero, legacyNew }));
} finally {
  await db.$disconnect();
}
