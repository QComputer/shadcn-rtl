import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createStoredImageFilename, writeStoredImage } from "@/lib/media-storage";

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
const slug = `hero-gallery-${stamp}`;
const managerName = `hero-manager-${stamp}`;
const managerPassword = "E2ePass!23456";

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
  await db.image.create({ data: { url: foreignStored.url, filename: foreignStored.pathname, mimeType: "image/png", sizeBytes: bytes.length,
    purpose: "retail-hero-gallery-fixture", access: "PUBLIC", organizationId: foreign.id, uploadedByUserId: manager.id,
    createdAt: new Date(Date.UTC(2026, 10, 14, 0, 0, 0)) } });
  console.log(JSON.stringify({ organizationId: organization.id, slug, managerName, galleryCount, foreignOrganizationId: foreign.id }));
} finally {
  await db.$disconnect();
}
