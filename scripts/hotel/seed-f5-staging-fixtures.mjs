import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import bcrypt from "bcryptjs";

const fail = (message) => { throw new Error(`F5 synthetic fixture guard: ${message}`); };
const required = [
  "DATABASE_URL", "DIRECT_URL", "HOTEL_F5_NEON_EXPECTED_HOST", "BLOB_READ_WRITE_TOKEN",
  "HOTEL_F5_PUBLIC_HOST", "HOTEL_F5_FOREIGN_HOST", "HOTEL_F5_INACTIVE_HOST", "HOTEL_F5_CAP_DISABLED_HOST",
  "HOTEL_F5_AUTHOR_PASSWORD", "HOTEL_F5_REVIEWER_PASSWORD", "HOTEL_F5_MANAGER_PASSWORD", "HOTEL_F5_FOREIGN_PASSWORD",
];
for (const name of required) if (!process.env[name]?.trim()) fail(`${name} is required`);
if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/codex/hotel-damoon-f5-staging-20261013") fail("fixture writes are allowed only in the protected F5 staging workflow on its dedicated branch");

const databaseUrl = new URL(process.env.DATABASE_URL);
const directUrl = new URL(process.env.DIRECT_URL);
if (databaseUrl.hostname !== process.env.HOTEL_F5_NEON_EXPECTED_HOST || directUrl.hostname !== databaseUrl.hostname) fail("database endpoint does not match the exact F5 staging endpoint");
if (databaseUrl.pathname !== "/hotel_f5_staging" || directUrl.pathname !== databaseUrl.pathname) fail("database name is not hotel_f5_staging");
if (decodeURIComponent(databaseUrl.username) !== "neondb_owner" || decodeURIComponent(directUrl.username) !== "neondb_owner") fail("fixture provisioning must use the isolated staging owner role");
if (databaseUrl.hostname === "ep-little-river-aifwxtf7") fail("Production endpoint is forbidden");

const hosts = ["HOTEL_F5_PUBLIC_HOST", "HOTEL_F5_FOREIGN_HOST", "HOTEL_F5_INACTIVE_HOST", "HOTEL_F5_CAP_DISABLED_HOST"].map((key) => {
  const value = process.env[key].toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9.-]+\.vercel\.app$/.test(value) || value.includes("bazar-baz") || value.includes("akashoes") || value.includes("damoon-hotel")) fail(`${key} must be an isolated Vercel Preview hostname`);
  return value;
});
if (new Set(hosts).size !== hosts.length) fail("each host fixture must have a distinct deployment hostname");

const tag = "F5-SYNTHETIC-STAGING";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG8sAAAAASUVORK5CYII=", "base64");
const filename = "hotel-f5-synthetic.png";

const prisma = new PrismaClient();
const output = async (name, value) => {
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import("node:fs/promises");
    await fs.appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { mode: 0o600 });
  }
};

try {
  await prisma.$connect();
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS database_name, current_user AS role_name, current_setting('server_version_num')::int AS version`;
  if (identity.database_name !== "hotel_f5_staging" || identity.role_name !== "neondb_owner" || Number(identity.version) < 180000) fail("live connection identity/version mismatch");
  const [ledger] = await prisma.$queryRaw`SELECT count(*)::int AS successful FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  if (ledger.successful !== 95) fail("expected the 95-migration accepted F5 ledger before fixture writes");
  const blob = await put(`hotel-f5/${tag}/hotel-f5-synthetic.png`, png, { access: "public", contentType: "image/png", addRandomSuffix: false, allowOverwrite: true });
  if (!new URL(blob.url).hostname.endsWith(".public.blob.vercel-storage.com")) fail("uploaded media is not served by the dedicated public Blob store");

  const tenant = async (slug, name, host, websiteActive, domainActive) => {
    let organization = await prisma.organization.upsert({
      where: { slug },
      create: { slug, name, type: "SHOP", vertical: "HOTEL", isActive: true, capabilitiesInitializedAt: new Date() },
      update: { name, type: "SHOP", vertical: "HOTEL", isActive: true, deletedAt: null, capabilitiesInitializedAt: new Date() },
    });
    const property = await prisma.hotelProperty.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug } },
      create: { organizationId: organization.id, organizationSlug: slug, slug, name: `${name} synthetic property`, isActive: true },
      update: { organizationSlug: slug, name: `${name} synthetic property`, isActive: true, deletedAt: null },
    });
    await prisma.organizationCapability.upsert({
      where: { organizationId_key: { organizationId: organization.id, key: "HOTEL_WEBSITE" } },
      create: { organizationId: organization.id, key: "HOTEL_WEBSITE", status: websiteActive ? "ACTIVE" : "INACTIVE", enabledAt: websiteActive ? new Date() : null, disabledAt: websiteActive ? null : new Date() },
      update: { status: websiteActive ? "ACTIVE" : "INACTIVE", enabledAt: websiteActive ? new Date() : null, disabledAt: websiteActive ? null : new Date() },
    });
    const priorDomain = await prisma.organizationDomain.findUnique({ where: { normalizedDomain: host }, select: { organizationId: true } });
    if (priorDomain && priorDomain.organizationId !== organization.id) fail(`Preview host ${host} is already owned by a different tenant`);
    await prisma.organizationDomain.upsert({
      where: { normalizedDomain: host },
      create: { organizationId: organization.id, domain: host, normalizedDomain: host, kind: "SUBDOMAIN", provider: "VERCEL", type: "CUSTOM", status: domainActive ? "ACTIVE" : "REQUESTED", providerVerified: true, dnsConfigured: true, sslReady: true, activatedAt: domainActive ? new Date() : null },
      update: { organizationId: organization.id, domain: host, status: domainActive ? "ACTIVE" : "REQUESTED", providerVerified: true, dnsConfigured: true, sslReady: true, activatedAt: domainActive ? new Date() : null },
    });
    const page = await prisma.hotelWebsitePage.upsert({
      where: { organizationId_propertyId_pageKey: { organizationId: organization.id, propertyId: property.id, pageKey: "HOME" } },
      create: { organizationId: organization.id, propertyId: property.id, pageKey: "HOME" },
      update: {},
    });
    return { organization, property, page };
  };

  const target = await tenant("f5-synthetic-damoon", "F5 Synthetic Hotel Damoon", hosts[0], true, true);
  const foreign = await tenant("f5-synthetic-foreign", "F5 Synthetic Foreign Hotel", hosts[1], true, true);
  const inactive = await tenant("f5-synthetic-inactive", "F5 Synthetic Inactive Hotel", hosts[2], true, false);
  const capabilityDisabled = await tenant("f5-synthetic-capability-off", "F5 Synthetic Capability-Off Hotel", hosts[3], false, true);
  void inactive;
  void capabilityDisabled;

  const users = {};
  const provisionUser = async ({ name, role, organization, password }) => {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { name },
      create: { name, password: passwordHash, role, isActive: true, isTeamMember: true, locale: "fa" },
      update: { password: passwordHash, role, isActive: true, deletedAt: null, failedLoginAttempts: 0, lockedUntil: null },
    });
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      create: { organizationId: organization.id, organizationSlug: organization.slug, userId: user.id, role, isActive: true },
      update: { organizationSlug: organization.slug, role, isActive: true },
    });
    return user;
  };
  users.author = await provisionUser({ name: "f5-author", role: "ADMIN", organization: target.organization, password: process.env.HOTEL_F5_AUTHOR_PASSWORD });
  users.reviewer = await provisionUser({ name: "f5-independent-reviewer", role: "ADMIN", organization: target.organization, password: process.env.HOTEL_F5_REVIEWER_PASSWORD });
  users.manager = await provisionUser({ name: "f5-manager-negative-reviewer", role: "MANAGER", organization: target.organization, password: process.env.HOTEL_F5_MANAGER_PASSWORD });
  users.foreign = await provisionUser({ name: "f5-foreign-author", role: "ADMIN", organization: foreign.organization, password: process.env.HOTEL_F5_FOREIGN_PASSWORD });

  const imageIds = { target: "hotel_f5_synthetic_media", foreign: "hotel_f5_foreign_media" };
  for (const [key, organizationId] of [["target", target.organization.id], ["foreign", foreign.organization.id]]) {
    const priorImage = await prisma.image.findUnique({ where: { id: imageIds[key] }, select: { organizationId: true } });
    if (priorImage && priorImage.organizationId !== organizationId) fail(`reserved ${key} media identifier is already owned outside its synthetic tenant`);
    await prisma.image.upsert({
      where: { id: imageIds[key] },
      create: { id: imageIds[key], organizationId, uploadedByUserId: key === "target" ? users.author.id : users.foreign.id, filename, mimeType: "image/png", sizeBytes: png.length, purpose: "hotel-f5-synthetic-acceptance", url: blob.url, access: "PUBLIC" },
      update: { organizationId, uploadedByUserId: key === "target" ? users.author.id : users.foreign.id, filename, mimeType: "image/png", sizeBytes: png.length, purpose: "hotel-f5-synthetic-acceptance", url: blob.url, access: "PUBLIC" },
    });
  }

  const foreignRevisionId = "hotel_f5_foreign_draft_revision";
  const foreignAssociationId = "hotel_f5_foreign_draft_media_assoc";
  const foreignContent = { title: { fa: "محتوای مصنوعی F5" }, hero: { heading: { fa: "محتوای خصوصی مستأجر دیگر" } }, introduction: { body: { fa: "صرفاً داده synthetic برای آزمون جداسازی F5؛ محتوای واقعی هتل نیست." } }, sections: [], contact: {} };
  const foreignCanonical = JSON.stringify(foreignContent);
  await prisma.hotelWebsiteContentRevision.upsert({
    where: { id: foreignRevisionId },
    create: { id: foreignRevisionId, organizationId: foreign.organization.id, propertyId: foreign.property.id, pageId: foreign.page.id, revisionNumber: 1, status: "DRAFT", content: foreignContent, contentSha256: createHash("sha256").update(foreignCanonical).digest("hex"), createdByUserId: users.foreign.id },
    update: {},
  });
  await prisma.hotelWebsiteMediaAssociation.upsert({
    where: { id: foreignAssociationId },
    create: { id: foreignAssociationId, organizationId: foreign.organization.id, propertyId: foreign.property.id, pageId: foreign.page.id, revisionId: foreignRevisionId, imageId: imageIds.foreign, scope: "PROPERTY", roomTypeId: null, sortOrder: 0, slot: "GALLERY", altText: { fa: "رسانه مصنوعی مستأجر دیگر؛ تصویر واقعی هتل نیست" } },
    update: { organizationId: foreign.organization.id, propertyId: foreign.property.id, pageId: foreign.page.id, revisionId: foreignRevisionId, imageId: imageIds.foreign, scope: "PROPERTY", roomTypeId: null, sortOrder: 0, slot: "GALLERY", altText: { fa: "رسانه مصنوعی مستأجر دیگر؛ تصویر واقعی هتل نیست" } },
  });

  const activePublications = await prisma.hotelWebsitePublication.count({ where: { organizationId: target.organization.id, revokedAt: null } });
  if (activePublications !== 0) fail("target must have no active publication before the acceptance run");
  const bookingCapabilities = await prisma.organizationCapability.count({ where: { organizationId: { in: [target.organization.id, foreign.organization.id] }, key: "HOTEL_BOOKING", status: "ACTIVE" } });
  if (bookingCapabilities !== 0) fail("synthetic tenant fixtures must not activate HOTEL_BOOKING");

  await output("organization_id", target.organization.id);
  await output("property_id", target.property.id);
  await output("foreign_organization_id", foreign.organization.id);
  await output("foreign_property_id", foreign.property.id);
  await output("author_id", users.author.id);
  await output("reviewer_id", users.reviewer.id);
  await output("manager_id", users.manager.id);
  await output("foreign_user_id", users.foreign.id);
  await output("synthetic_media_id", imageIds.target);
  await output("foreign_media_id", imageIds.foreign);
  await output("foreign_association_id", foreignAssociationId);
  console.log(JSON.stringify({ organizationId: target.organization.id, propertyId: target.property.id, propertySlug: target.property.slug, foreignOrganizationId: foreign.organization.id, foreignPropertyId: foreign.property.id, mediaId: imageIds.target, foreignMediaId: imageIds.foreign, foreignAssociationId }));
  console.log("Provisioned idempotent synthetic F5 tenants, CMS roles, inactive/capability-negative domains, and two tiny public PNG fixtures. Booking remains disabled; target editorial state is unpublished.");
} finally {
  await prisma.$disconnect();
}
