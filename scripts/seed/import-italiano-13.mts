import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importItaliano13Snapshot, type Italiano13Snapshot } from "../../lib/external-catalog/italiano-13-import";

const APPLY = process.argv.includes("--apply");
const requestedOrganizationId = process.argv.find((argument) => argument.startsWith("--organization-id="))?.split("=")[1];
const snapshotPath = path.join(process.cwd(), "prisma", "seed-data", "italiano-13-snappfood-menu.json");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as Italiano13Snapshot;

assert.equal(snapshot.counts.categories, 9);
assert.equal(snapshot.counts.products, 56);
assert.equal(snapshot.counts.prices, 72);
assert.equal(snapshot.counts.unpricedOrAmbiguous, 0);
assert.equal(snapshot.counts.duplicateSourceIdentities, 0);

if (!APPLY) {
  console.log(JSON.stringify({
    mode: "DRY_RUN",
    wouldMutateDatabase: false,
    organizationSlug: snapshot.organization.slug,
    counts: snapshot.counts,
    money: snapshot.money,
    excludedFields: snapshot.excludedFields,
    instruction: "Pass --apply only against a disposable or explicitly approved local database.",
  }, null, 2));
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required for --apply");
const parsedDatabaseUrl = new URL(databaseUrl);
assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsedDatabaseUrl.hostname), "Italiano 13 import refuses non-local databases");
if (process.env.DIRECT_URL) {
  const parsedDirectUrl = new URL(process.env.DIRECT_URL);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsedDirectUrl.hostname), "Italiano 13 import refuses non-local DIRECT_URL values");
}

const prisma = new PrismaClient();
try {
  const organization = requestedOrganizationId
    ? await prisma.organization.findFirst({ where: { id: requestedOrganizationId, slug: snapshot.organization.slug }, select: { id: true } })
    : await prisma.organization.findUnique({ where: { slug: snapshot.organization.slug }, select: { id: true } });
  assert.ok(organization, "Italiano 13 organization is missing; this script never creates or assigns tenant ownership");
  const summary = await importItaliano13Snapshot({ prisma, organizationId: organization.id, snapshot });
  console.log(JSON.stringify({ mode: "LOCAL_APPLY", providerCalled: false, ...summary }, null, 2));
} finally {
  await prisma.$disconnect();
}
