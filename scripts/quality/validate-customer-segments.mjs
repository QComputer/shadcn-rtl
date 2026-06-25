#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function ok(name, detail = "") {
  results.push({ name, ok: true, detail });
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function add(name, condition, detail = "") {
  condition ? ok(name, detail) : fail(name, detail);
}

const schema = exists("prisma/schema.prisma") ? read("prisma/schema.prisma") : "";
const service = exists("lib/services/customer-segments.service.ts") ? read("lib/services/customer-segments.service.ts") : "";
const route = exists("app/api/dashboard/customer-club/segments/route.ts") ? read("app/api/dashboard/customer-club/segments/route.ts") : "";
const page = exists("app/[locale]/dashboard/customer-club/segments/page.tsx") ? read("app/[locale]/dashboard/customer-club/segments/page.tsx") : "";
const membersPage = exists("app/[locale]/dashboard/customer-club/members/page.tsx") ? read("app/[locale]/dashboard/customer-club/members/page.tsx") : "";
const policy = exists("lib/dashboard/navigation-policy.ts") ? read("lib/dashboard/navigation-policy.ts") : "";
const accessControl = exists("lib/access-control.ts") ? read("lib/access-control.ts") : "";
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : "";
const packageJson = exists("package.json") ? read("package.json") : "";
const readme = exists("README.md") ? read("README.md") : "";
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : "";

const segmentKeys = [
  "all_club_members",
  "new_members_30d",
  "recent_buyers_30d",
  "inactive_60d",
  "vip_by_revenue",
  "high_order_count",
  "abandoned_cart_candidates",
];

add("CustomerSegment model exists", /model\s+CustomerSegment\s*{/.test(schema));
add("CustomerSegmentRule model exists", /model\s+CustomerSegmentRule\s*{/.test(schema));
add("CustomerSegmentSnapshot model exists", /model\s+CustomerSegmentSnapshot\s*{/.test(schema));
add("Organization relates customer segments", /customerSegments\s+CustomerSegment\[\]/.test(schema));
add("Organization relates customer segment snapshots", /customerSegmentSnapshots\s+CustomerSegmentSnapshot\[\]/.test(schema));
add("CustomerSegment is organization keyed", /@@unique\(\[organizationId,\s*key\]\)/.test(schema));
add("CustomerSegment active index exists", /@@index\(\[organizationId,\s*isActive\]\)/.test(schema));
add("CustomerSegmentSnapshot timeline index exists", /@@index\(\[organizationId,\s*segmentKey,\s*calculatedAt\]\)/.test(schema));
add("P44 segment migration exists", exists("prisma/migrations/20260625000300_customer_segments_mvp/migration.sql"));

add("customer segments service exists", exists("lib/services/customer-segments.service.ts"));
add("service exports ready segment definitions", /CUSTOMER_SEGMENT_DEFINITIONS/.test(service));
for (const key of segmentKeys) {
  add(`service includes ${key}`, service.includes(key));
}
add("service computes from active customer club memberships", /customerClubMembership\.findMany/.test(service) && /status:\s*"ACTIVE"/.test(service));
add("service scopes membership queries by organization id", /organizationId:\s*organization\.id/.test(service));
add("service scopes order queries by organization slug", /order\.findMany/.test(service) && /organizationSlug:\s*organization\.slug/.test(service));
add("service scopes cart queries by organization slug", /shopCart\.findMany/.test(service) && /organizationSlug:\s*organization\.slug/.test(service));
add("service excludes cancelled/refunded orders", /notIn:\s*\["CANCELLED",\s*"REFUNDED"\]/.test(service));
add("service saves reusable segment rows", /customerSegment\.upsert/.test(service));
add("service saves reusable segment rules", /customerSegmentRule\.create/.test(service));
add("service saves count snapshots", /customerSegmentSnapshot\.create/.test(service));
add("service audit logs snapshot writes", /writeAuditLog/.test(service) && /CustomerSegmentSnapshot/.test(service));
const listBlock = service.match(/async\s+listSegments[\s\S]*?async\s+saveSnapshot/)?.[0] ?? "";
add("segment list path is read-only", !/(customerSegment\.upsert|customerSegmentSnapshot\.create|customerSegmentRule\.create|writeAuditLog)/.test(listBlock));

add("customer segments API exists", exists("app/api/dashboard/customer-club/segments/route.ts"));
add("customer segments API supports GET", /export\s+async\s+function\s+GET/.test(route));
add("customer segments API supports POST", /export\s+async\s+function\s+POST/.test(route));
add("customer segments API requires management access", /requireOrgAccess\(session,\s*organizationId,\s*\["ADMIN",\s*"MANAGER"\]\)/.test(route));
add("customer segments API lists segments", /customerSegmentsService\.listSegments/.test(route));
add("customer segments API snapshots segments", /customerSegmentsService\.saveSnapshot/.test(route));
const getBlock = route.match(/export\s+async\s+function\s+GET[\s\S]*?export\s+async\s+function\s+POST/)?.[0] ?? "";
add("customer segments GET does not snapshot", !/saveSnapshot|create|upsert|deleteMany/.test(getBlock));

add("customer segments dashboard page exists", exists("app/[locale]/dashboard/customer-club/segments/page.tsx"));
add("customer segments page fetches API", /\/api\/dashboard\/customer-club\/segments/.test(page));
add("customer segments page has loading state", /loading/.test(page));
add("customer segments page has error state", /errorTitle/.test(page));
add("customer segments page has empty state", /emptyTitle/.test(page));
add("customer segments page can save snapshots", /saveSnapshot/.test(page) && /method:\s*"POST"/.test(page));
add("customer segments page explains tenant safety", /tenantSafeNote/.test(page));
add("customer club members page links to segments", /customer-club\/segments/.test(membersPage));

add("navigation policy maps customer segments", /"\/customer-club\/segments":\s*ROLE_NAVIGATION_POLICY\.customerClub/.test(policy));
add("legacy access-control maps customer segments", /"\/dashboard\/customer-club\/segments"/.test(accessControl));

for (const locale of ["fa", "en", "ar"]) {
  const rel = `dictionaries/${locale}.json`;
  const text = exists(rel) ? read(rel) : "";
  add(`${locale} dictionary has customer segment copy`, /"customerSegments"\s*:/.test(text) && /"saveSnapshot"\s*:/.test(text));
  add(`${locale} customer club copy links segments`, /"segments"\s*:/.test(text));
}

add("P44 phase doc exists", exists("docs/PHASE_44_CUSTOMER_SEGMENTS_MVP.md"));
add("P44 overlay manifest exists", exists("docs/PHASE_44_OVERLAY_MANIFEST.md"));
add("package script exposes P44 validator", /"quality:customer-segments":\s*"node scripts\/quality\/validate-customer-segments\.mjs"/.test(packageJson));
add("validate-project references P44 validator", /validate-customer-segments\.mjs/.test(validateProject));
add("README references P44 customer segments", /P44/.test(readme) && /Customer Segments/i.test(readme));
add("source of truth references P44 customer segments", /P44/.test(sourceOfTruth) && /Customer Segments/i.test(sourceOfTruth));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Customer segments validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}
console.log("Customer segments validation passed.");
