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
const service = exists("lib/services/campaign-builder.service.ts") ? read("lib/services/campaign-builder.service.ts") : "";
const collectionRoute = exists("app/api/dashboard/customer-club/campaigns/route.ts") ? read("app/api/dashboard/customer-club/campaigns/route.ts") : "";
const detailRoute = exists("app/api/dashboard/customer-club/campaigns/[id]/route.ts") ? read("app/api/dashboard/customer-club/campaigns/[id]/route.ts") : "";
const sendRoute = exists("app/api/dashboard/customer-club/campaigns/[id]/send/route.ts") ? read("app/api/dashboard/customer-club/campaigns/[id]/send/route.ts") : "";
const listPage = exists("app/[locale]/dashboard/customer-club/campaigns/page.tsx") ? read("app/[locale]/dashboard/customer-club/campaigns/page.tsx") : "";
const newPage = exists("app/[locale]/dashboard/customer-club/campaigns/new/page.tsx") ? read("app/[locale]/dashboard/customer-club/campaigns/new/page.tsx") : "";
const detailPage = exists("app/[locale]/dashboard/customer-club/campaigns/[id]/page.tsx") ? read("app/[locale]/dashboard/customer-club/campaigns/[id]/page.tsx") : "";
const segmentPage = exists("app/[locale]/dashboard/customer-club/segments/page.tsx") ? read("app/[locale]/dashboard/customer-club/segments/page.tsx") : "";
const policy = exists("lib/dashboard/navigation-policy.ts") ? read("lib/dashboard/navigation-policy.ts") : "";
const accessControl = exists("lib/access-control.ts") ? read("lib/access-control.ts") : "";
const validateProject = exists("scripts/quality/validate-project.mjs") ? read("scripts/quality/validate-project.mjs") : "";
const packageJson = exists("package.json") ? read("package.json") : "";
const readme = exists("README.md") ? read("README.md") : "";
const sourceOfTruth = exists("docs/CURRENT_SOURCE_OF_TRUTH.md") ? read("docs/CURRENT_SOURCE_OF_TRUTH.md") : "";

add("CampaignStatus enum exists", /enum\s+CampaignStatus\s*{[\s\S]*DRAFT[\s\S]*SCHEDULED[\s\S]*SENDING[\s\S]*SENT[\s\S]*CANCELED/.test(schema));
add("CampaignChannel enum is in-app only", /enum\s+CampaignChannel\s*{[\s\S]*IN_APP[\s\S]*}/.test(schema));
add("CampaignDeliveryStatus enum exists", /enum\s+CampaignDeliveryStatus\s*{[\s\S]*PENDING[\s\S]*SENT[\s\S]*FAILED[\s\S]*CANCELED/.test(schema));
add("Campaign model exists", /model\s+Campaign\s*{/.test(schema));
add("CampaignAudience model exists", /model\s+CampaignAudience\s*{/.test(schema));
add("CampaignMessage model exists", /model\s+CampaignMessage\s*{/.test(schema));
add("CampaignDelivery model exists", /model\s+CampaignDelivery\s*{/.test(schema));
add("Campaign is organization scoped", /model\s+Campaign\s*{[\s\S]*organizationId\s+String/.test(schema) && /@@index\(\[organizationId,\s*status,\s*createdAt\]\)/.test(schema));
add("Campaign audience can target segment snapshot", /segmentSnapshotId\s+String\?/.test(schema) && /segmentSnapshot\s+CustomerSegmentSnapshot\?/.test(schema));
add("Campaign delivery stores recipient and notification", /targetUserId\s+String/.test(schema) && /notificationId\s+String\?/.test(schema));
add("Campaign delivery is unique per campaign recipient channel", /@@unique\(\[campaignId,\s*targetUserId,\s*channel\]\)/.test(schema));
add("P45 campaign migration exists", exists("prisma/migrations/20260625000400_campaign_builder_mvp/migration.sql"));

add("campaign builder service exists", exists("lib/services/campaign-builder.service.ts"));
add("service creates campaign drafts", /createCampaign/.test(service) && /status\s*=\s*input\.scheduledAt\s*\?\s*"SCHEDULED"\s*:\s*"DRAFT"/.test(service));
add("service updates draft campaigns", /updateCampaign/.test(service) && /Only draft or scheduled campaigns can be updated/.test(service));
add("service previews dry-run delivery", /previewCampaign/.test(service) && /dryRun:\s*true/.test(service));
add("service sends in-app notifications", /notification\.create/.test(service) && /CUSTOMER_CLUB_CAMPAIGN_IN_APP/.test(service));
add("service saves delivery rows per recipient", /campaignDelivery\.upsert/.test(service) && /targetUserId/.test(service));
add("service supports cancellation before send", /cancelCampaign/.test(service) && /Only draft or scheduled campaigns can be canceled/.test(service));
add("service writes campaign audit logs", /writeAuditLog/.test(service) && /entityType:\s*"Campaign"/.test(service));
add("service uses customer segment definitions", /CUSTOMER_SEGMENT_DEFINITIONS/.test(service));
add("service scopes recipients by organization id", /customerClubMembership\.findMany/.test(service) && /organizationId:\s*organization\.id/.test(service));
add("service scopes order recipients by organization slug", /order\.findMany/.test(service) && /organizationSlug:\s*organization\.slug/.test(service));
add("service scopes cart recipients by organization slug", /shopCart\.findMany/.test(service) && /organizationSlug:\s*organization\.slug/.test(service));
add("service excludes canceled/refunded orders", /notIn:\s*\["CANCELLED",\s*"REFUNDED"\]/.test(service));
add("service has no external delivery call", !/(sendEmail|sendSMS|webpush|telegram|kavenegar|twilio|fetch\(["']https?:)/i.test(service));

add("campaign collection API exists", exists("app/api/dashboard/customer-club/campaigns/route.ts"));
add("campaign collection API supports GET", /export\s+async\s+function\s+GET/.test(collectionRoute));
add("campaign collection API supports POST", /export\s+async\s+function\s+POST/.test(collectionRoute));
add("campaign collection API requires management access", /requireOrgAccess\(session,\s*organizationId,\s*\["ADMIN",\s*"MANAGER"\]\)/.test(collectionRoute));
add("campaign detail API exists", exists("app/api/dashboard/customer-club/campaigns/[id]/route.ts"));
add("campaign detail API supports GET", /export\s+async\s+function\s+GET/.test(detailRoute));
add("campaign detail API supports PATCH", /export\s+async\s+function\s+PATCH/.test(detailRoute));
add("campaign detail API supports DELETE cancel", /export\s+async\s+function\s+DELETE/.test(detailRoute) && /cancelCampaign/.test(detailRoute));
add("campaign send API exists", exists("app/api/dashboard/customer-club/campaigns/[id]/send/route.ts"));
add("campaign send API supports dry run", /dryRun/.test(sendRoute));
add("campaign send API calls send service", /sendCampaign/.test(sendRoute));
add("campaign APIs have no external delivery call", !/(sendEmail|sendSMS|webpush|telegram|kavenegar|twilio|fetch\(["']https?:)/i.test(collectionRoute + detailRoute + sendRoute));

add("campaign list page exists", exists("app/[locale]/dashboard/customer-club/campaigns/page.tsx"));
add("campaign new page exists", exists("app/[locale]/dashboard/customer-club/campaigns/new/page.tsx"));
add("campaign detail page exists", exists("app/[locale]/dashboard/customer-club/campaigns/[id]/page.tsx"));
add("campaign list page has loading error empty states", /loading/.test(listPage) && /errorTitle/.test(listPage) && /emptyTitle/.test(listPage));
add("campaign new page chooses segment", /\/api\/dashboard\/customer-club\/segments/.test(newPage) && /SelectItem/.test(newPage));
add("campaign new page writes message", /Textarea/.test(newPage) && /message/.test(newPage));
add("campaign detail page can dry-run send and cancel", /dryRun/.test(detailPage) && /sendCampaign/.test(detailPage) && /cancelCampaign/.test(detailPage));
add("campaign UI states in-app only", /inAppOnly/.test(listPage + newPage + detailPage));
add("segments page links campaigns", /customer-club\/campaigns/.test(segmentPage));

add("route policy maps campaign list", /"\/customer-club\/campaigns":\s*ROLE_NAVIGATION_POLICY\.customerClub/.test(policy));
add("route policy maps campaign new", /"\/customer-club\/campaigns\/new":\s*ROLE_NAVIGATION_POLICY\.customerClub/.test(policy));
add("route policy maps campaign detail", /"\/customer-club\/campaigns\/\[id\]":\s*ROLE_NAVIGATION_POLICY\.customerClub/.test(policy));
add("legacy access-control maps campaign routes", /"\/dashboard\/customer-club\/campaigns"/.test(accessControl) && /"\/dashboard\/customer-club\/campaigns\/new"/.test(accessControl) && /"\/dashboard\/customer-club\/campaigns\/\[id\]"/.test(accessControl));

for (const locale of ["fa", "en", "ar"]) {
  const rel = `dictionaries/${locale}.json`;
  const text = exists(rel) ? read(rel) : "";
  add(`${locale} dictionary has campaign builder copy`, /"campaignBuilder"\s*:/.test(text) && /"statuses"\s*:/.test(text) && /"dryRun"\s*:/.test(text));
  add(`${locale} customer segment copy links campaigns`, /"customerSegments"\s*:/.test(text) && /"campaigns"\s*:/.test(text));
}

add("P45 phase doc exists", exists("docs/PHASE_45_CAMPAIGN_BUILDER_MVP.md"));
add("P45 overlay manifest exists", exists("docs/PHASE_45_OVERLAY_MANIFEST.md"));
add("package script exposes P45 validator", /"quality:campaign-builder":\s*"node scripts\/quality\/validate-campaign-builder\.mjs"/.test(packageJson));
add("validate-project references P45 validator", /validate-campaign-builder\.mjs/.test(validateProject));
add("README references P45 campaign builder", /P45/.test(readme) && /Campaign Builder/i.test(readme));
add("source of truth references P45 campaign builder", /P45/.test(sourceOfTruth) && /Campaign Builder/i.test(sourceOfTruth));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Campaign builder validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}
console.log("Campaign builder validation passed.");
