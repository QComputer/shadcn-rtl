import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { verifyLocalDamoonDatabase } from "../../scripts/hotel/verify-damoon-local-e2e-db.mjs";
import { validateSources } from "../../scripts/hotel/damoon-real-data-import.mjs";
test("read-only dry run reconciles synthetic draft records without inferring identity and preserves database state", async () => {
  await verifyLocalDamoonDatabase();
  const source = validateSources(process.env.DAMOON_SOURCE_DIR || "C:/Users/disso/damoon-real-data");
  const db = new PrismaClient(); const tag = `dryrun-${randomUUID()}`;
  try {
    const org = await db.organization.create({ data: { name: tag, slug: tag, type: "SHOP", vertical: "HOTEL" } });
    const property = await db.hotelProperty.create({ data: { organizationId: org.id, organizationSlug: org.slug, slug: "fixture-hotel", name: "Synthetic" } });
    const mapping = [];
    for (const [index, unit] of source.units.units.entries()) {
      const draft = await db.hotelDraftAccommodation.create({ data: { organizationId: org.id, propertyId: property.id, temporaryCode: `fixture-${index}`, category: "synthetic" } });
      mapping.push({ sourceCode: unit.unit_code, draftId: draft.id, expectedVersion: draft.version });
    }
    const before = await db.hotelDraftAccommodation.findMany({ where: { organizationId: org.id, propertyId: property.id }, orderBy: { id: "asc" } });
    const folder = await mkdtemp(path.join(os.tmpdir(), "damoon-synthetic-map-")); const mappingPath = path.join(folder, "mapping.json");
    await writeFile(mappingPath, JSON.stringify([]));
    const run = spawnSync(process.execPath, ["scripts/hotel/damoon-real-data-import.mjs", "--dry-run"], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DAMOON_ORGANIZATION_ID: org.id, DAMOON_PROPERTY_ID: property.id, DAMOON_PHYSICAL_VERIFICATIONS_PATH: mappingPath } });
    assert.equal(run.status, 0, run.stderr); const report = JSON.parse(run.stdout);
    assert.equal(report.mode, "READ_ONLY_DRY_RUN"); assert.equal(report.rows.length, 31); assert.equal(report.tariffs.length, 8); assert.equal(report.publicationEnabled, false);
    assert.deepEqual(await db.hotelDraftAccommodation.findMany({ where: { organizationId: org.id, propertyId: property.id }, orderBy: { id: "asc" } }), before);
  } finally { await db.$disconnect(); }
});
