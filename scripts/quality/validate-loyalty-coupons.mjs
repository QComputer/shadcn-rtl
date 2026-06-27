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
const service = exists("lib/services/loyalty-coupons.service.ts") ? read("lib/services/loyalty-coupons.service.ts") : "";
const loyaltyRoute = exists("app/api/dashboard/customer-club/loyalty/route.ts") ? read("app/api/dashboard/customer-club/loyalty/route.ts") : "";
const couponsRoute = exists("app/api/dashboard/customer-club/coupons/route.ts") ? read("app/api/dashboard/customer-club/coupons/route.ts") : "";
const loyaltyPage = exists("app/[locale]/dashboard/customer-club/loyalty/page.tsx") ? read("app/[locale]/dashboard/customer-club/loyalty/page.tsx") : "";
const couponsPage = exists("app/[locale]/dashboard/customer-club/coupons/page.tsx") ? read("app/[locale]/dashboard/customer-club/coupons/page.tsx") : "";
const policy = exists("lib/dashboard/navigation-policy.ts") ? read("lib/dashboard/navigation-policy.ts") : "";
const accessControl = exists("lib/access-control.ts") ? read("lib/access-control.ts") : "";
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : "";
const packageJson = exists("package.json") ? read("package.json") : "";
const readme = exists("README.md") ? read("README.md") : "";
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : "";

function modelBlock(name) {
  return schema.match(new RegExp(`model\\s+${name}\\s*{[\\s\\S]*?\\n}`))?.[0] ?? "";
}

const loyaltyLedgerModel = modelBlock("LoyaltyLedger");

add("LoyaltyLedgerType enum exists", /enum\s+LoyaltyLedgerType\s*{[\s\S]*EARN[\s\S]*REDEEM[\s\S]*ADJUST[\s\S]*EXPIRE[\s\S]*REFUND/.test(schema));
add("CouponDiscountType enum exists", /enum\s+CouponDiscountType\s*{[\s\S]*PERCENTAGE[\s\S]*FIXED_AMOUNT/.test(schema));
add("LoyaltyLedger model exists", /model\s+LoyaltyLedger\s*{/.test(schema));
add("LoyaltyRule model exists", /model\s+LoyaltyRule\s*{/.test(schema));
add("Coupon model exists", /model\s+Coupon\s*{/.test(schema));
add("CouponRedemption model exists", /model\s+CouponRedemption\s*{/.test(schema));
add("LoyaltyLedger is organization scoped", /model\s+LoyaltyLedger\s*{[\s\S]*organizationId\s+String/.test(schema) && /@@index\(\[organizationId,\s*customerId,\s*createdAt\]\)/.test(schema));
add("LoyaltyLedger has no updatedAt mutable timestamp", /createdAt\s+DateTime/.test(loyaltyLedgerModel) && !/updatedAt/.test(loyaltyLedgerModel));
add("LoyaltyLedger is idempotent for purchase awards", /@@unique\(\[organizationId,\s*orderId,\s*type\]\)/.test(schema));
add("LoyaltyRule stores purchase earning formula", /spendAmount\s+Decimal/.test(schema) && /pointsAwarded\s+Int/.test(schema) && /pointsPerOrder\s+Int/.test(schema));
add("Coupon is organization scoped with unique code", /model\s+Coupon\s*{[\s\S]*organizationId\s+String/.test(schema) && /@@unique\(\[organizationId,\s*code\]\)/.test(schema));
add("Coupon stores restriction fields", /startsAt\s+DateTime\?/.test(schema) && /expiresAt\s+DateTime\?/.test(schema) && /usageLimit\s+Int\?/.test(schema) && /perCustomerLimit\s+Int\?/.test(schema) && /segmentKey\s+String\?/.test(schema));
add("CouponRedemption stores customer and order", /model\s+CouponRedemption\s*{[\s\S]*customerId\s+String[\s\S]*orderId\s+String\?/.test(schema));
add("Organization relations include loyalty and coupons", /loyaltyLedgers\s+LoyaltyLedger\[\]/.test(schema) && /loyaltyRules\s+LoyaltyRule\[\]/.test(schema) && /coupons\s+Coupon\[\]/.test(schema));
add("User relations include loyalty and coupon redemptions", /loyaltyLedgers\s+LoyaltyLedger\[\]/.test(schema) && /couponRedemptions\s+CouponRedemption\[\]/.test(schema));
add("P46 migration exists", exists("prisma/migrations/20260625000500_loyalty_coupons/migration.sql"));

add("loyalty/coupons service exists", exists("lib/services/loyalty-coupons.service.ts"));
add("service lists loyalty program", /listLoyaltyProgram/.test(service) && /loyaltyLedger\.groupBy/.test(service));
add("service creates loyalty rules", /createLoyaltyRule/.test(service) && /loyaltyRule\.create/.test(service));
add("service awards purchase points", /awardPurchasePoints/.test(service) && /type:\s*"EARN"/.test(service));
add("service requires active club membership for loyalty", /requireActiveClubMembership/.test(service) && /status:\s*"ACTIVE"/.test(service));
add("service prevents duplicate purchase awards", /loyaltyLedger\.findFirst/.test(service) && /orderId/.test(service) && /type:\s*"EARN"/.test(service));
add("service writes ledger rows through create only", /loyaltyLedger\.create/.test(service) && !/loyaltyLedger\.(update|updateMany|upsert|delete|deleteMany)/.test(service));
add("service writes loyalty audit logs", /writeAuditLog/.test(service) && /entityType:\s*"LoyaltyLedger"/.test(service) && /entityType:\s*"LoyaltyRule"/.test(service));
add("service creates coupons", /createCoupon/.test(service) && /coupon\.create/.test(service));
add("service normalizes coupon code", /normalizeCouponCode/.test(service) && /toUpperCase/.test(service));
add("service validates coupon date windows", /assertValidDateWindow/.test(service) && /Start date must be before expiration date/.test(service));
add("service enforces coupon active dates", /coupon\.startsAt[\s\S]*Coupon is not active yet/.test(service) && /coupon\.expiresAt[\s\S]*Coupon has expired/.test(service));
add("service enforces total usage limits atomically", /coupon\.updateMany/.test(service) && /usedCount:\s*{\s*lt:\s*coupon\.usageLimit\s*}/.test(service));
add("service enforces per-customer limits", /perCustomerLimit/.test(service) && /Customer coupon usage limit reached/.test(service));
add("service enforces segment restrictions", /customerMatchesSegment/.test(service) && /Customer is not in the coupon segment/.test(service));
add("service writes coupon audit logs", /entityType:\s*"Coupon"/.test(service) && /entityType:\s*"CouponRedemption"/.test(service));

add("loyalty dashboard API exists", exists("app/api/dashboard/customer-club/loyalty/route.ts"));
add("loyalty API supports GET", /export\s+async\s+function\s+GET/.test(loyaltyRoute));
add("loyalty API supports POST actions", /discriminatedUnion\("action"/.test(loyaltyRoute) && /awardPurchase/.test(loyaltyRoute) && /manualAdjust/.test(loyaltyRoute));
add("loyalty API requires management access", /requireOrgAccess\(session,\s*organizationId,\s*\["ADMIN",\s*"MANAGER"\]\)/.test(loyaltyRoute));
add("coupons dashboard API exists", exists("app/api/dashboard/customer-club/coupons/route.ts"));
add("coupons API supports GET and POST", /export\s+async\s+function\s+GET/.test(couponsRoute) && /export\s+async\s+function\s+POST/.test(couponsRoute));
add("coupons API requires management access", /requireOrgAccess\(session,\s*organizationId,\s*\["ADMIN",\s*"MANAGER"\]\)/.test(couponsRoute));

add("loyalty dashboard page exists", exists("app/[locale]/dashboard/customer-club/loyalty/page.tsx"));
add("coupons dashboard page exists", exists("app/[locale]/dashboard/customer-club/coupons/page.tsx"));
add("loyalty page has rule award adjustment controls", /createRule/.test(loyaltyPage) && /awardPurchase/.test(loyaltyPage) && /manualAdjustment/.test(loyaltyPage));
add("loyalty page shows append-only note", /appendOnlyNote/.test(loyaltyPage));
add("coupons page has coupon creation controls", /createCoupon/.test(couponsPage) && /discountType/.test(couponsPage) && /segmentKey/.test(couponsPage));
add("coupons page exposes restriction fields", /startsAt/.test(couponsPage) && /expiresAt/.test(couponsPage) && /usageLimit/.test(couponsPage) && /perCustomerLimit/.test(couponsPage));
add("loyalty and coupons pages cross-link", /customer-club\/coupons/.test(loyaltyPage) && /customer-club\/loyalty/.test(couponsPage));

add("route policy maps loyalty", /"\/customer-club\/loyalty":\s*ROLE_NAVIGATION_POLICY\.customerClub/.test(policy));
add("route policy maps coupons", /"\/customer-club\/coupons":\s*ROLE_NAVIGATION_POLICY\.customerClub/.test(policy));
add("legacy access-control maps loyalty and coupons", /"\/dashboard\/customer-club\/loyalty"/.test(accessControl) && /"\/dashboard\/customer-club\/coupons"/.test(accessControl));

for (const locale of ["fa", "en", "ar"]) {
  const rel = `dictionaries/${locale}.json`;
  const text = exists(rel) ? read(rel) : "";
  add(`${locale} dictionary has loyalty/coupons copy`, /"loyaltyCoupons"\s*:/.test(text) && /"discountTypes"\s*:/.test(text) && /"segments"\s*:/.test(text));
}

add("P46 phase doc exists", exists("docs/PHASE_46_LOYALTY_COUPONS.md"));
add("P46 overlay manifest exists", exists("docs/PHASE_46_OVERLAY_MANIFEST.md"));
add("package script exposes P46 validator", /"quality:loyalty-coupons":\s*"node scripts\/quality\/validate-loyalty-coupons\.mjs"/.test(packageJson));
add("validate-project references P46 validator", /validate-loyalty-coupons\.mjs/.test(validateProject));
add("README references P46 loyalty/coupons", /P46/.test(readme) && /Loyalty Points and Coupons/i.test(readme));
add("source of truth references P46 loyalty/coupons", /P46/.test(sourceOfTruth) && /Loyalty Points and Coupons/i.test(sourceOfTruth));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Loyalty/coupons validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}
console.log("Loyalty/coupons validation passed.");
