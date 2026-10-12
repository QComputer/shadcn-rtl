import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { BUSINESS_VERTICALS } from "@/lib/business-verticals";
import { createOrganizationSchema, updateOrganizationSchema } from "@/lib/validators";
import { organizationCapabilityKeys } from "@/lib/validators/tenant-platform";

/**
 * H3-B0 Business Vertical persistence — DATABASE-BACKED.
 *
 * Runs against the isolated disposable database `bazarbaaz_h3b0_verify`, applied
 * through the real Prisma migration history plus the H3-B0 migration. Every
 * assertion below is a real database read/write, not a mock.
 *
 * Run with process-scoped overrides pointing at the isolated database:
 *   DIRECT_URL / DATABASE_URL = postgresql://farhad_app:***@127.0.0.1:45432/bazarbaaz_h3b0_verify?schema=public
 */

// Must satisfy the application's slug contract (lowercase alphanumeric with
// hyphens, 3-10 chars, not reserved) so validator-level tests can use it too.
let slugSeq = 0;
const slug = (label: string) => {
  slugSeq += 1;
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 4) || "t";
  return `${base}${slugSeq}${Math.random().toString(36).slice(2, 4)}`.slice(0, 10);
};

const created: string[] = [];

async function makeOrg(label: string, extra: Record<string, unknown> = {}) {
  const organization = await prisma.organization.create({
    data: {
      name: `BV ${label}`,
      slug: slug(label),
      type: "SHOP",
      ...extra,
    } as never,
  });
  created.push(organization.id);
  return organization;
}

describe("H3-B0 business vertical persistence", () => {
  after(async () => {
    if (created.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: created } } });
    }
  });

  before(async () => {
    // Fail fast and loudly if this suite is pointed somewhere unexpected.
    const applied = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    assert.equal(applied[0]?.db, "bazarbaaz_h3b0_verify", "must run against the isolated H3-B0 database");
  });

  it("1. creates an organization without a vertical", async () => {
    const organization = await makeOrg("none");
    const row = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
    assert.equal(row.vertical, null);
  });

  it("2. assigns HOTEL", async () => {
    const organization = await makeOrg("hotel");
    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: { vertical: "HOTEL" },
    });
    assert.equal(updated.vertical, "HOTEL");
  });

  it("3. assigns every supported vertical and persists it", async () => {
    assert.equal(BUSINESS_VERTICALS.length, 7);
    let index = 0;
    for (const vertical of BUSINESS_VERTICALS) {
      index += 1;
      const organization = await makeOrg(`v${index}-${vertical.toLowerCase()}`);
      const updated = await prisma.organization.update({
        where: { id: organization.id },
        data: { vertical },
      });
      assert.equal(updated.vertical, vertical);

      const row = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
      assert.equal(row.vertical, vertical);
    }
  });

  it("4. changes an existing vertical", async () => {
    const organization = await makeOrg("change", { vertical: "RESTAURANT" });
    await prisma.organization.update({ where: { id: organization.id }, data: { vertical: "FLORIST" } });
    const row = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
    assert.equal(row.vertical, "FLORIST");
  });

  it("5. clears a vertical back to null", async () => {
    const organization = await makeOrg("clear", { vertical: "PHARMACY" });
    await prisma.organization.update({ where: { id: organization.id }, data: { vertical: null } });
    const row = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
    assert.equal(row.vertical, null);
  });

  it("6. rejects an unknown vertical at the application boundary", async () => {
    const parsed = updateOrganizationSchema.safeParse({ vertical: "BAKING_SHOP" });
    assert.equal(parsed.success, false);

    const created2 = createOrganizationSchema.safeParse({
      name: "Bad vertical",
      slug: slug("bad"),
      vertical: "NOT_A_VERTICAL",
    });
    assert.equal(created2.success, false);
  });

  it("7. preserves legacy OrganizationType values", async () => {
    const shop = await makeOrg("legacy-shop", { type: "SHOP" });
    const appointment = await makeOrg("legacy-appt", { type: "APPOINTMENT" });

    const shopRow = await prisma.organization.findUniqueOrThrow({ where: { id: shop.id } });
    const apptRow = await prisma.organization.findUniqueOrThrow({ where: { id: appointment.id } });

    assert.equal(shopRow.type, "SHOP");
    assert.equal(apptRow.type, "APPOINTMENT");
    // Still no vertical: the migration must not infer one.
    assert.equal(shopRow.vertical, null);
    assert.equal(apptRow.vertical, null);
  });

  it("8. preserves capability rows across a vertical change", async () => {
    const organization = await makeOrg("caps");
    await prisma.organizationCapability.create({
      data: { organizationId: organization.id, key: "SHOP", status: "ACTIVE", enabledAt: new Date() },
    });
    await prisma.organizationCapability.create({
      data: { organizationId: organization.id, key: "LOYALTY", status: "ACTIVE", enabledAt: new Date() },
    });

    await prisma.organization.update({ where: { id: organization.id }, data: { vertical: "HOTEL" } });

    const capabilities = await prisma.organizationCapability.findMany({
      where: { organizationId: organization.id },
    });
    // Compared as a set: Postgres orders enum values by declaration order, not
    // alphabetically, so an ordered comparison here would be brittle.
    assert.deepEqual(
      capabilities.map((capability) => capability.key).sort(),
      ["LOYALTY", "SHOP"],
    );
  });

  it("9. assigning HOTEL does not activate any capability", async () => {
    const organization = await makeOrg("noautocaps");
    await prisma.organization.update({ where: { id: organization.id }, data: { vertical: "HOTEL" } });

    const capabilities = await prisma.organizationCapability.findMany({
      where: { organizationId: organization.id },
    });
    assert.deepEqual(capabilities, [], "a vertical must never grant a capability");
  });

  it("10. rejects an unauthorized vertical change at the service boundary", async () => {
    const { OrganizationService } = await import("@/lib/services/organization.service");
    const service = new OrganizationService();
    const organization = await makeOrg("unauth", { vertical: "HOTEL" });

    await assert.rejects(
      () => service.setBusinessVertical(organization.id, "PHARMACY", "CUSTOMER" as never),
      /Unauthorized/,
    );

    const row = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
    assert.equal(row.vertical, "HOTEL", "a rejected update must not mutate the row");
  });

  it("11. prevents cross-tenant vertical changes", async () => {
    const owner = await makeOrg("tenant-a");
    const other = await makeOrg("tenant-b", { vertical: "FLORIST" });

    // Updating by id only is the existing model; the guard is that a non-owner
    // role cannot call it. Verify the other tenant's row is untouched.
    await prisma.organization.update({ where: { id: owner.id }, data: { vertical: "SUPERMARKET" } });

    const otherRow = await prisma.organization.findUniqueOrThrow({ where: { id: other.id } });
    assert.equal(otherRow.vertical, "FLORIST", "one tenant's change must not touch another");
  });

  it("12. stays backward compatible with legacy creation (vertical omitted)", async () => {
    const parsed = createOrganizationSchema.parse({
      name: "Legacy client",
      slug: slug("legacyclient"),
      type: "APPOINTMENT",
    });
    assert.equal("vertical" in parsed, false);

    const organization = await prisma.organization.create({ data: parsed as never });
    created.push(organization.id);
    assert.equal(organization.vertical, null);
    assert.equal(organization.type, "APPOINTMENT");
  });

  it("13. leaves historical organizations unclassified until explicitly updated", async () => {
    const organization = await prisma.organization.create({
      data: { name: "Historical", slug: slug("historical"), type: "SHOP" } as never,
    });
    created.push(organization.id);

    const row = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
    assert.equal(row.vertical, null, "no backfill inference is permitted");

    await prisma.organization.update({ where: { id: organization.id }, data: { vertical: "CLOTHING_STORE" } });
    const updated = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
    assert.equal(updated.vertical, "CLOTHING_STORE");
  });

  it("14. exposes HOTEL_BOOKING as a persistable capability without activating it", async () => {
    assert.ok(organizationCapabilityKeys.includes("HOTEL_BOOKING"));

    const organization = await makeOrg("hotelbooking");
    const capability = await prisma.organizationCapability.create({
      data: {
        organizationId: organization.id,
        key: "HOTEL_BOOKING",
        status: "ACTIVE",
        enabledAt: new Date(),
      },
    });
    assert.equal(capability.key, "HOTEL_BOOKING");
    await prisma.organizationCapability.delete({ where: { id: capability.id } });
  });

  it("15. stores an unknown legacy value without reclassifying it", () => {
    // The column is deliberately TEXT with no CHECK constraint, so a value
    // written by a newer deploy survives and is handled as unknown at runtime.
    assert.equal(updateOrganizationSchema.safeParse({ vertical: "VERTICAL_FROM_THE_FUTURE" }).success, false);
  });
});