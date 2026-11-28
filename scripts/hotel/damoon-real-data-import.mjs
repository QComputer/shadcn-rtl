#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { validateLocalDamoonTarget, verifyLocalDamoonDatabase } from "./verify-damoon-local-e2e-db.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(repo, "docs/hotel/damoon/DAMOON-31-UNIT-DRAFT-RECONCILIATION-2026-11-17.json"), "utf8"));
const defaultSource = "C:/Users/disso/damoon-real-data";

export function validateSources(sourceDir) {
  const units = JSON.parse(fs.readFileSync(path.join(sourceDir, "05-Units-Staging.json"), "utf8"));
  const tariffs = JSON.parse(fs.readFileSync(path.join(sourceDir, "06-Tariffs-Staging.json"), "utf8"));
  return validateSourceDocuments(units, tariffs);
}

function validateSourceDocuments(units, tariffs) {
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
    assert.ok(typeof unit.category_fa === "string" && unit.category_fa.length > 0 && unit.category_fa.length <= 100);
    assert.ok(categories.has(unit.category), `unit ${unit.unit_code} has unsupported source category`);
    assert.ok(["room", "suite"].includes(unit.kind));
    assert.ok((Number.isInteger(unit.floor) && unit.floor >= 0 && unit.floor <= 100) || unit.floor === null);
    assert.ok((Number.isInteger(unit.area_m2_read) && unit.area_m2_read > 0) || unit.area_m2_read === null);
    assert.ok(unit.capacity_as_written && typeof unit.capacity_as_written === "object");
    assert.ok(unit.bed_configuration_read && typeof unit.bed_configuration_read === "object");
    assert.ok(unit.source_pages && typeof unit.source_pages === "object");
    assert.deepEqual(Object.keys(unit.capacity_as_written).sort(), ["adults","children","extra_persons","note"].sort());
    for (const key of ["adults","children","extra_persons"]) assert.ok(unit.capacity_as_written[key] === null || (Number.isSafeInteger(unit.capacity_as_written[key]) && unit.capacity_as_written[key] >= 0));
    assert.ok(unit.capacity_as_written.note === null || typeof unit.capacity_as_written.note === "string");
    assert.ok(Object.entries(unit.bed_configuration_read).every(([key,value]) => ["single","double"].includes(key) && (value === null || (Number.isSafeInteger(value) && value >= 0))));
    assert.deepEqual(Object.keys(unit.source_pages).sort(), ["physical","technical"]);
    assert.ok(Object.values(unit.source_pages).every(value => Number.isSafeInteger(value) && value > 0));
    assert.ok([unit.window_or_natural_light,unit.western_toilet].every(value => value === null || typeof value === "boolean"));
    assert.ok(typeof unit.area_evidence === "string" && typeof unit.operational_status_read === "string");
    assert.ok(unit.photo_ref === null || typeof unit.photo_ref === "string");
    assert.ok(Array.isArray(unit.issues) && unit.issues.every(value => typeof value === "string"));
    assert.ok(typeof unit.extra_service_allowed_as_printed === "boolean" || unit.extra_service_allowed_as_printed === null);
  }
  assert.ok(units.units.every((unit) => unit.sale_enabled === false && unit.publication_allowed === false));
  assert.equal(tariffs.status, "STAGING_REVIEW_NOT_FOR_PRODUCTION");
  assert.equal(tariffs.currency, "IRR");
  assert.equal(tariffs.tariffs.length, 8);
  const tariffCategories = ["single", "double_or_twin", "triple_suite", "quad_suite", "quint_suite", "royal", "vip", "extra_service"];
  assert.deepEqual(tariffs.tariffs.map(item => item.category).sort(), [...tariffCategories].sort(), "tariff categories must match the reviewed source");
  assert.ok(tariffs.tariffs.every(item => Object.keys(item).sort().join(",") === "amount_irr,category,label_fa,sale_enabled"), "tariff entry fields must match the reviewed schema");
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

/** Physical codes are never mapped to historical hypothetical draft identifiers. */
export function reconcile(source, drafts, rooms = [], verifications = []) {
  assert.ok(Array.isArray(verifications), "verifications must be a list");
  const byCode = new Map(rooms.map(room => [room.code, room]));
  const sourceCodes = new Set(source.units.units.map(unit => unit.unit_code));
  const checked = new Map();
  for (const entry of verifications) {
    assert.ok(entry && Object.keys(entry).sort().join(",") === "externalDependenciesAbsent,roomId,sourceCode,updatedAt", "invalid verification fields");
    const room = byCode.get(entry.sourceCode);
    assert.ok(sourceCodes.has(entry.sourceCode) && room && room.id === entry.roomId && entry.externalDependenciesAbsent === true && typeof entry.updatedAt === "string" && !Number.isNaN(Date.parse(entry.updatedAt)), "verification must identify an exact scoped physical code and confirm no external dependencies");
    assert.ok(!checked.has(entry.sourceCode), "duplicate physical verification"); checked.set(entry.sourceCode, entry);
  }
  const historicalIds = new Set(manifest.draftUnits.map(item => item.draftUnitId));
  const rows = source.units.units.map(unit => {
    const room = byCode.get(unit.unit_code);
    if (!room) return { sourceCode:unit.unit_code, action:"PROPOSE_CREATE", reason:"NO_PHYSICAL_CODE_MATCH" };
    const dependent = room.reservationCount > 0 || room.maintenanceCount > 0 || room.mediaCount > 0;
    const verified = checked.get(unit.unit_code);
    if (dependent || !verified || room.deletedAt) return { sourceCode:unit.unit_code, roomId:room.id, action:"PRESERVE_REVIEW", reason:dependent ? "HAS_DEPENDENCIES" : "IDENTITY_OR_STATUS_UNVERIFIED" };
    return { sourceCode:unit.unit_code, roomId:room.id, expectedUpdatedAt:verified.updatedAt, action:"RECONCILE_EXISTING" };
  });
  const draftProposals = drafts.map(draft => ({ draftId:draft.id, temporaryCode:draft.temporaryCode, action:historicalIds.has(draft.temporaryCode) && !draft.promotedRoomId ? "PROPOSE_SUPERSEDE_REVIEW" : "PRESERVE_REVIEW" }));
  return { rows, draftProposals, reservationsAndMediaMutated:false, publicationEnabled:false };
}
async function scopedInventory(tx, scope) {
  const drafts = await tx.hotelDraftAccommodation.findMany({ where:{...scope,archivedAt:null}, select:{id:true,temporaryCode:true,promotedRoomId:true,version:true} });
  const rows = await tx.hotelRoom.findMany({ where:scope, select:{id:true,code:true,floor:true,deletedAt:true,updatedAt:true,_count:{select:{reservationRooms:true,maintenanceBlocks:true}},roomType:{select:{_count:{select:{websiteMedia:true}}}}} });
  const rooms = rows.map(row => ({ id:row.id,code:row.code,floor:row.floor,deletedAt:row.deletedAt,updatedAt:row.updatedAt,reservationCount:row._count.reservationRooms,maintenanceCount:row._count.maintenanceBlocks,mediaCount:row.roomType._count.websiteMedia }));
  return { drafts, rooms };
}
/** Persist an exact staging snapshot and reconcile only explicitly verified, dependency-free physical rooms. */
export async function applyReviewedImport(prisma, scope, source, verifications = []) {
  source = validateSourceDocuments(source.units, source.tariffs);
  const target = validateLocalDamoonTarget();
  if (!target.ok) throw new Error(target.errors.join(" "));
  const canonical = [...verifications].sort((a,b) => a.sourceCode.localeCompare(b.sourceCode));
  const digest = createHash("sha256").update(JSON.stringify([source.units,source.tariffs,canonical])).digest("hex");
  return prisma.$transaction(async tx => {
    const [identity] = await tx.$queryRaw`SELECT current_database() AS "databaseName", current_user AS "userName", current_schema() AS "schemaName", current_setting('server_version_num')::int AS "version", inet_server_port() AS "serverPort", inet_server_addr()::text AS "serverAddress"`;
    if (identity?.databaseName !== target.databaseName || identity.userName !== target.databaseUser || identity.schemaName !== "public" || identity.version < 170000 || identity.version >= 180000 || identity.serverPort !== 5432 || !identity.serverAddress) throw new Error("Connected target identity does not match the isolated PostgreSQL 17 test database");
    const locked = await tx.$queryRaw`SELECT "id" FROM "HotelProperty" WHERE "id"=${scope.propertyId} AND "organizationId"=${scope.organizationId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (locked.length !== 1) throw new Error("Scoped property unavailable");
    const previous = await tx.hotelDamoonDataImport.findUnique({ where:{organizationId_propertyId_sourceDigest:{...scope,sourceDigest:digest}} });
    if (previous) return { outcome:"REPLAY",id:previous.id,digest };
    await tx.$queryRaw`SELECT "id" FROM "HotelRoom" WHERE "organizationId"=${scope.organizationId} AND "propertyId"=${scope.propertyId} ORDER BY "id" FOR UPDATE`;
    const { drafts,rooms } = await scopedInventory(tx,scope); const report = reconcile(source,drafts,rooms,canonical);
    const byCode = new Map(source.units.units.map(unit=>[unit.unit_code,unit]));
    for (const row of report.rows.filter(item=>item.action === "RECONCILE_EXISTING").sort((a,b)=>a.roomId.localeCompare(b.roomId))) {
      const unit=byCode.get(row.sourceCode), current=rooms.find(room=>room.id === row.roomId);
      if (!current || current.updatedAt.toISOString() !== new Date(row.expectedUpdatedAt).toISOString()) throw new Error("Verified physical room changed during import");
      if (unit.floor === null || current.floor === String(unit.floor)) continue;
      const update=await tx.hotelRoom.updateMany({where:{id:row.roomId,...scope,code:row.sourceCode,deletedAt:null,updatedAt:new Date(row.expectedUpdatedAt)},data:{...(unit.floor === null ? {} : {floor:String(unit.floor)})}});
      if(update.count !== 1) throw new Error("Verified physical room changed during import");
    }
    const batch=await tx.hotelDamoonDataImport.create({data:{...scope,sourceDigest:digest,units:source.units,tariffs:source.tariffs,mapping:{verifications:canonical,report}}});
    return {outcome:"APPLIED",id:batch.id,digest,report};
  },{isolationLevel:"Serializable",maxWait:5000,timeout:30000});
}

async function run() {
  const source = validateSources(process.env.DAMOON_SOURCE_DIR || defaultSource);
  const apply = process.argv.includes("--apply"), dryRun = process.argv.includes("--dry-run");
  if (apply === dryRun) throw new Error("Choose exactly one of --dry-run or --apply.");
  const identity = await verifyLocalDamoonDatabase();
  const prisma = new PrismaClient();
  try {
    const propertyId = process.env.DAMOON_PROPERTY_ID;
    const organizationId = process.env.DAMOON_ORGANIZATION_ID;
    if (!propertyId || !organizationId) throw new Error("Explicit synthetic property and organization IDs are required.");
    const property = await prisma.hotelProperty.findFirst({ where: { id: propertyId, organizationId, deletedAt: null }, select: { id: true } });
    if (!property) throw new Error("Scoped synthetic property does not exist in disposable database.");
    const scope = { organizationId, propertyId };
    const verificationPath = process.env.DAMOON_PHYSICAL_VERIFICATIONS_PATH;
    const verifications = verificationPath ? JSON.parse(fs.readFileSync(verificationPath, "utf8")) : [];
    if (apply) {
      const result = await applyReviewedImport(prisma, scope, source, verifications);
      console.log(JSON.stringify({ database:identity, mode:"ISOLATED_STAGING_APPLY", ...result }, null, 2));
    } else {
      const report = await prisma.$transaction(async tx => { const inventory=await scopedInventory(tx,scope); return reconcile(source,inventory.drafts,inventory.rooms,verifications); }, { isolationLevel:"RepeatableRead" });
      console.log(JSON.stringify({ database:identity, propertyId, organizationId, mode:"READ_ONLY_DRY_RUN", tariffs:source.tariffIntegrations, ...report }, null, 2));
    }
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run().catch((error) => { console.error(`Damoon import refused: ${error.message}`); process.exitCode = 1; });
