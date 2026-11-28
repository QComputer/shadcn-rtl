#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { verifyLocalDamoonDatabase } from "./verify-damoon-local-e2e-db.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(repo, "docs/hotel/damoon/DAMOON-31-UNIT-DRAFT-RECONCILIATION-2026-11-17.json"), "utf8"));
const defaultSource = "C:/Users/disso/damoon-real-data";

export function validateSources(sourceDir) {
  const units = JSON.parse(fs.readFileSync(path.join(sourceDir, "05-Units-Staging.json"), "utf8"));
  const tariffs = JSON.parse(fs.readFileSync(path.join(sourceDir, "06-Tariffs-Staging.json"), "utf8"));
  assert.equal(units.schema_version, "staging-1.0");
  assert.equal(units.status, "STAGING_REVIEW_NOT_FOR_PRODUCTION");
  assert.equal(units.null_meaning, "unknown or unstated; not false or zero");
  assert.equal(units.units.length, 31);
  const codes = units.units.map((unit) => unit.unit_code);
  assert.equal(new Set(codes).size, 31, "source unit codes must be unique");
  assert.ok(codes.every((code) => typeof code === "string" && /^\d{3}$/.test(code)));
  const categories = new Set(["double", "single", "twin", "triple_suite", "quad_suite", "quint_suite", "royal", "vip"]);
  const requiredUnitFields = ["row", "unit_code", "floor", "category", "category_fa", "kind", "capacity_as_written", "bed_configuration_read", "area_m2_read", "area_evidence", "window_or_natural_light", "western_toilet", "extra_service_allowed_as_printed", "operational_status_read", "photo_ref", "source_pages", "issues", "sale_enabled", "publication_allowed", "approval_status"];
  for (const [index, unit] of units.units.entries()) {
    assert.deepEqual(Object.keys(unit).sort(), [...requiredUnitFields].sort(), `unit ${index + 1} fields must match the reviewed source schema`);
    assert.equal(unit.row, index + 1);
    assert.ok(categories.has(unit.category), `unit ${unit.unit_code} has unsupported source category`);
    assert.ok(["room", "suite"].includes(unit.kind));
    assert.ok(Number.isInteger(unit.floor) || unit.floor === null);
    assert.ok(Number.isInteger(unit.area_m2_read) || unit.area_m2_read === null);
    assert.ok(unit.capacity_as_written && typeof unit.capacity_as_written === "object");
    assert.ok(unit.bed_configuration_read && typeof unit.bed_configuration_read === "object");
    assert.ok(unit.source_pages && typeof unit.source_pages === "object");
    assert.ok(Array.isArray(unit.issues));
    assert.ok(typeof unit.extra_service_allowed_as_printed === "boolean" || unit.extra_service_allowed_as_printed === null);
  }
  assert.ok(units.units.every((unit) => unit.sale_enabled === false && unit.publication_allowed === false));
  assert.equal(tariffs.status, "STAGING_REVIEW_NOT_FOR_PRODUCTION");
  assert.equal(tariffs.currency, "IRR");
  assert.equal(tariffs.tariffs.length, 8);
  assert.equal(new Set(tariffs.tariffs.map((item) => item.category)).size, 8);
  assert.ok(tariffs.tariffs.every((item) => Number.isSafeInteger(item.amount_irr) && item.amount_irr > 0 && item.sale_enabled === false));
  assert.ok(tariffs.tariffs.every((item) => typeof item.label_fa === "string" && item.label_fa.length > 0));
  assert.ok(units.units.every((unit) => unit.approval_status === "STAGING_REVIEW"));
  const tariffIntegrations = tariffs.tariffs.map((tariff) => {
    const irr = BigInt(tariff.amount_irr);
    const exactToman = irr % 10n === 0n;
    return { category: tariff.category, amountIRR: irr.toString(), amountToman: exactToman ? (irr / 10n).toString() : null,
      exactIntegerToman: exactToman, activationAllowed: false,
      reason: exactToman ? "STAGING_ONLY_UNPUBLISHED" : "IRR_NOT_EXACTLY_REPRESENTABLE_AS_INTEGER_TOMAN" };
  });
  return { units, tariffs, tariffIntegrations };
}

function reconcile(source, drafts) {
  const sourceCounts = new Map();
  for (const unit of source.units.units) sourceCounts.set(unit.category, (sourceCounts.get(unit.category) ?? 0) + 1);
  const draftCounts = new Map();
  for (const unit of manifest.draftUnits) draftCounts.set(unit.unitKind.value, (draftCounts.get(unit.unitKind.value) ?? 0) + 1);
  const byCode = new Map(drafts.map((draft) => [draft.temporaryCode, draft]));
  const rows = source.units.units.map((unit) => {
    const candidate = byCode.get(unit.unit_code);
    return { sourceCode: unit.unit_code, sourceCategory: unit.category, action: candidate ? "UPDATE_DRAFT" : "ADD_DRAFT", draftId: candidate?.id ?? null,
      unresolved: Object.entries(unit).filter(([, value]) => value === null).map(([key]) => key),
      preservedLinks: candidate ? { promotedRoomId: candidate.promotedRoomId, version: candidate.version } : null };
  });
  return { rows, categoryCounts: Object.fromEntries(sourceCounts), existingDraftCount: drafts.length,
    expectedDraftCount: manifest.draftUnits.length, manifestKindCounts: Object.fromEntries(draftCounts),
    mappingConflicts: rows.filter((row) => row.action === "ADD_DRAFT" && drafts.some((draft) => draft.temporaryCode === row.sourceCode)),
    unresolvedCount: rows.reduce((sum, row) => sum + row.unresolved.length, 0),
    reservationsAndMediaMutated: false, publicationEnabled: false };
}

async function run() {
  const source = validateSources(process.env.DAMOON_SOURCE_DIR || defaultSource);
  if (!process.argv.includes("--dry-run")) throw new Error("Only --dry-run is currently enabled; apply requires the verified disposable fixture suite.");
  const identity = await verifyLocalDamoonDatabase();
  const prisma = new PrismaClient();
  try {
    const propertyId = process.env.DAMOON_PROPERTY_ID;
    const organizationId = process.env.DAMOON_ORGANIZATION_ID;
    if (!propertyId || !organizationId) throw new Error("Explicit synthetic property and organization IDs are required.");
    const property = await prisma.hotelProperty.findFirst({ where: { id: propertyId, organizationId }, select: { id: true } });
    if (!property) throw new Error("Scoped synthetic property does not exist in disposable database.");
    const drafts = await prisma.hotelDraftAccommodation.findMany({ where: { organizationId, propertyId, archivedAt: null }, select: { id: true, temporaryCode: true, promotedRoomId: true, version: true } });
    const report = reconcile(source, drafts);
    console.log(JSON.stringify({ database: identity, propertyId, organizationId, mode: "READ_ONLY_DRY_RUN", tariffs: source.tariffIntegrations, ...report }, null, 2));
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run().catch((error) => { console.error(`Damoon import refused: ${error.message}`); process.exitCode = 1; });
