#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(repoRoot, "docs/hotel/damoon/DAMOON-31-UNIT-DRAFT-RECONCILIATION-2026-11-17.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const manifestFingerprint = createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex");
const allowedStatuses = new Set([
  "OWNER_CONFIRMED",
  "OWNER_CONFIRMED_PENDING_APPLICATION",
  "QUESTIONNAIRE_TRANSCRIBED",
  "MODEL_ASSUMED",
  "PENDING_VERIFICATION",
]);
const draftIds = manifest.draftUnits.map((unit) => unit.draftUnitId);
const uniqueDraftIds = new Set(draftIds);
const countUnits = (predicate) => manifest.draftUnits.filter(predicate).length;

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.property.draftOnly, true);
assert.equal(manifest.property.publiclyBookable, false);
assert.equal(manifest.ownerConfirmed.regularRoomCount.value, 20);
assert.equal(manifest.ownerConfirmed.suiteCount.value, 11);
assert.equal(manifest.ownerConfirmed.accommodationUnitCount.value, 31);
assert.equal(draftIds.length, 31, "The draft must represent exactly 31 accommodation units");
assert.equal(uniqueDraftIds.size, 31, "Draft identifiers must be unique");
assert.ok(draftIds.every((id) => /^DRAFT-(ROOM|SUITE)-[A-Z0-9-]+$/.test(id)), "Draft IDs must never look like real room codes");
assert.equal(countUnits((unit) => unit.unitKind.value === "ROOM"), 20);
assert.equal(countUnits((unit) => unit.unitKind.value === "SUITE"), 11);
assert.equal(countUnits((unit) => unit.categoryProposal.status === "MODEL_ASSUMED"), 4);
assert.equal(countUnits((unit) => unit.previousCategory?.status === "PENDING_VERIFICATION"), 4);
assert.ok(manifest.draftUnits.every((unit) => allowedStatuses.has(unit.unitKind.status)));
assert.ok(manifest.draftUnits.every((unit) => allowedStatuses.has(unit.draftIdentifierStatus)));
assert.ok(manifest.draftUnits.every((unit) => allowedStatuses.has(unit.categoryProposal.status)));
assert.ok(manifest.draftUnits.every((unit) => allowedStatuses.has(unit.capacityProposal.status)));
assert.ok(manifest.draftUnits.every((unit) => [unit.physicalRoomCode, unit.floor, unit.bedConfiguration, unit.amenities, unit.nightlyPriceToman, unit.physicalStatus].every((field) => field.value === null && field.status === "PENDING_VERIFICATION")));
assert.ok(Object.values(manifest.commonUnverifiedFields).every((field) => field.value === null && field.status === "PENDING_VERIFICATION"));
assert.equal(manifest.safety.databaseRoomTypesCreated, false);
assert.equal(manifest.safety.databasePhysicalRoomsCreated, false);
assert.equal(manifest.safety.liveRatePlansCreated, false);
assert.equal(manifest.safety.saleableInventoryCreated, false);
assert.equal(manifest.safety.importStatus, "NOT_IMPORTABLE_PENDING_VERIFICATION");
assert.equal(manifest.reconciliation.applicationAllowed, false);
assert.ok(manifest.draftUnits.every((unit) => unit.saleable.value === false));

const plan = {
  status: manifest.safety.importStatus,
  draftUnitCount: draftIds.length,
  reconciliationKey: `${manifest.property.propertyId}:${manifestFingerprint}`,
  manifestFingerprint,
  proposedGroupCounts: (() => {
    const groups = new Map();
    for (const unit of manifest.draftUnits) {
      const key = `${unit.unitKind.value}:${unit.categoryProposal.value}:${unit.categoryProposal.status}`;
      const current = groups.get(key) ?? {
        category: unit.categoryProposal.value,
        unitKind: unit.unitKind.value,
        count: 0,
        evidence: unit.categoryProposal.status,
      };
      current.count += 1;
      groups.set(key, current);
    }
    return [...groups.values()]
      .sort((left, right) => left.unitKind.localeCompare(right.unitKind) || left.category.localeCompare(right.category));
  })(),
  stableUnitKeys: manifest.draftUnits.map((unit) => unit.draftUnitId),
  importableRecords: 0,
  nonImportableReason: "Physical codes, room details, rates, and publishable status are unverified",
  unresolvedPerUnitFields: Object.entries(manifest.commonUnverifiedFields)
    .filter(([, field]) => field.status === "PENDING_VERIFICATION")
    .map(([field]) => field),
  productionWrites: false,
  publicBookingEnabled: false,
};

console.log("PASS: Damoon draft manifest represents 31 unique non-bookable design units with per-unit field evidence states.");
console.log("PASS: four owner-confirmed suites remain unclassified in source evidence; provisional category mappings are MODEL_ASSUMED.");
console.log("PASS: no Production room, rate, inventory, publication, or booking write is planned.");
if (process.argv.slice(2).some((argument) => argument !== "--plan")) throw new Error("Only --plan is supported; this tool never writes to a database.");
if (process.argv.includes("--plan")) console.log(JSON.stringify(plan, null, 2));
