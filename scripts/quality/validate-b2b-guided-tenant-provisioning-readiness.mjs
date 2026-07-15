#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(file) {
  const fullPath = path.join(root, file);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function add(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
}

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260715000100_tenant_provisioning_readiness/migration.sql");
const service = read("lib/tenant-provisioning/tenant-provisioning-plan.service.ts");
const listApi = read("app/api/dashboard/tenant-provisioning-plans/route.ts");
const detailApi = read("app/api/dashboard/tenant-provisioning-plans/[planId]/route.ts");
const validateApi = read("app/api/dashboard/tenant-provisioning-plans/[planId]/validate/route.ts");
const approveApi = read("app/api/dashboard/tenant-provisioning-plans/[planId]/approve/route.ts");
const markReadyApi = read("app/api/dashboard/tenant-provisioning-plans/[planId]/mark-ready/route.ts");
const cancelApi = read("app/api/dashboard/tenant-provisioning-plans/[planId]/cancel/route.ts");
const returnApi = read("app/api/dashboard/tenant-provisioning-plans/[planId]/return-for-review/route.ts");
const executionApi = exists("app/api/dashboard/tenant-provisioning-plans/[planId]/execute/route.ts");
const listPage = read("app/[locale]/dashboard/tenant-provisioning/page.tsx");
const listClient = read("app/[locale]/dashboard/tenant-provisioning/tenant-provisioning-client.tsx");
const detailPage = read("app/[locale]/dashboard/tenant-provisioning/[planId]/page.tsx");
const detailClient = read("app/[locale]/dashboard/tenant-provisioning/[planId]/tenant-provisioning-plan-editor.tsx");
const leadLauncher = read("app/[locale]/dashboard/request-demo-leads/[leadId]/provisioning/provisioning-launcher.tsx");
const navPolicy = read("lib/dashboard/navigation-policy.ts");
const sidebar = read("components/dashboard/dashboard-sidebar.tsx");
const sourceOfTruth = read("docs/CURRENT_SOURCE_OF_TRUTH.md");
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");
const completionRoadmap = read("docs/completion/MASTER_PROJECT_COMPLETION_ROADMAP.md");
const packageJson = read("package.json");

add("TenantProvisioningPlan model exists", /model TenantProvisioningPlan\s*\{[\s\S]*idempotencyKey[\s\S]*requestDemoLeadId/.test(schema));
add("Tenant provisioning lifecycle statuses exist", /enum TenantProvisioningPlanStatus\s*\{[\s\S]*DRAFT[\s\S]*VALIDATING[\s\S]*NEEDS_REVIEW[\s\S]*READY[\s\S]*APPROVED[\s\S]*EXECUTING[\s\S]*COMPLETED[\s\S]*FAILED[\s\S]*CANCELLED/.test(schema));
add("Tenant provisioning source types exist", /enum TenantProvisioningSourceType\s*\{[\s\S]*REQUEST_DEMO_LEAD[\s\S]*ONBOARDING_WIZARD[\s\S]*MANUAL/.test(schema));
add("idempotency is unique", /idempotencyKey\s+String\s+@unique/.test(schema) && /CREATE UNIQUE INDEX "TenantProvisioningPlan_idempotencyKey_key"/.test(migration));
add("source-lead linkage exists", /requestDemoLead\s+RequestDemoLead\?/.test(schema) && /RequestDemoLead[\s\S]*tenantProvisioningPlans/.test(schema));
add("migration is additive", /CREATE TABLE "TenantProvisioningPlan"/.test(migration) && !/DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i.test(migration));
add("passwords and invitation tokens are not stored", !/password|passwordHash|invitationToken/i.test(schema.match(/model TenantProvisioningPlan\s*\{[\s\S]*?\n\}/)?.[0] || ""));

add("service exists", service.length > 0);
add("service maps SHOP recommendations", /SHOP_BUSINESS_TYPES/.test(service) && /return "SHOP"/.test(service));
add("service maps APPOINTMENT recommendations", /APPOINTMENT_BUSINESS_TYPES/.test(service) && /return "APPOINTMENT"/.test(service));
add("mixed input requires review", /recommendation === null/.test(service) && /NEEDS_REVIEW/.test(service));
add("slug normalization exists", /normalizeProvisioningSlug/.test(service) && /RESERVED_SLUGS/.test(service));
add("slug conflict checks exist", /SLUG_AVAILABLE/.test(service) && /prisma\.organization\.findFirst/.test(service));
add("owner conflict checks exist", /OWNER_IDENTITY_CONFLICT/.test(service) && /prisma\.user\.findFirst/.test(service));
add("module and package validation exists", /MODULES_VALID/.test(service) && /PACKAGE_VALID/.test(service) && /SUPPORTED_PACKAGE_IDS/.test(service));
add("dry run stores safe validation structure", /ProvisioningValidationResult/.test(service) && /checks: ProvisioningValidationCheck/.test(service) && /validationResult/.test(service));
add("dry run declares no side effects", /NO_ORGANIZATION_CREATED/.test(service) && /NO_USER_CREATED/.test(service) && /NO_MEMBERSHIP_CREATED/.test(service) && /NO_SUBSCRIPTION_CREATED/.test(service) && /NO_NOTIFICATION_SENT/.test(service) && /NO_DOMAIN_PROVIDER_ACTION/.test(service));
add("service has no tenant execution creation calls", !/organization\.create|user\.create|organizationMember\.create|subscription\.create|sendText|sendEmail|vercel.*add|charge|payment/i.test(service));
add("execution states are rejected in service", /EXECUTING/.test(service) && /Provisioning execution is not implemented in P13/.test(service));
add("audit events are written", /writeAuditLog/.test(service) && /TenantProvisioningPlan/.test(service));
add("audit history is returned by detail service", /listPlanAuditEvents/.test(service) && /auditEvents/.test(service) && /prisma\.auditLog\.findMany/.test(service));

add("list/create API exists", /export async function GET/.test(listApi) && /export async function POST/.test(listApi));
add("detail/update API exists", /export async function GET/.test(detailApi) && /export async function PATCH/.test(detailApi));
add("validate endpoint exists", /validateTenantProvisioningPlan/.test(validateApi));
add("approve endpoint exists", /approveTenantProvisioningPlan/.test(approveApi));
add("mark-ready endpoint exists", /markTenantProvisioningPlanReady/.test(markReadyApi));
add("return/cancel endpoints exist", /returnTenantProvisioningPlanForReview/.test(returnApi) && /cancelTenantProvisioningPlan/.test(cancelApi));
add("no execution endpoint added", !executionApi);
for (const [name, content] of Object.entries({ listApi, detailApi, validateApi, approveApi, markReadyApi, cancelApi, returnApi })) {
  add(`${name} enforces SUPER_ADMIN server-side`, /requireAuthSession/.test(content) && /requireRole\(session,\s*\["SUPER_ADMIN"\]\)/.test(content));
}
add("PATCH rejects status manipulation by schema", !/status:/.test(detailApi.match(/const updatePlanSchema[\s\S]*?\}\);/)?.[0] || ""));

add("tenant provisioning list page exists", listPage.length > 0 && listClient.length > 0);
add("tenant provisioning detail/editor exists", detailPage.length > 0 && detailClient.length > 0);
add("lead provisioning launcher exists", leadLauncher.length > 0);
add("UI clearly says tenant is not yet created", /هنوز هیچ سازمان، حساب کاربری یا اشتراکی ایجاد نشده است/.test(listClient + detailClient + leadLauncher));
add("UI includes lead summary and validation checklist", /درخواست منبع/.test(detailClient) && /چک‌لیست اعتبارسنجی/.test(detailClient));
add("UI includes approve return cancel actions", /approve/.test(detailClient) && /return-for-review/.test(detailClient) && /cancel/.test(detailClient));
add("UI displays audit history", /auditEvents/.test(detailClient) && /تاریخچه audit/.test(detailClient));
add("Persian-first RTL layout exists", /dir=\{locale === "en" \? "ltr" : "rtl"\}/.test(listClient + detailClient));
add("navigation exposes SUPER_ADMIN provisioning route", /tenantProvisioning/.test(navPolicy) && /"SUPER_ADMIN"/.test(navPolicy) && /tenantProvisioning/.test(sidebar));

add("P13 implementation doc exists", exists("docs/b2b-public-repositioning/P13_GUIDED_TENANT_PROVISIONING_READINESS.md"));
add("state model doc exists", exists("docs/b2b-public-repositioning/TENANT_PROVISIONING_STATE_MODEL.md"));
add("security policy doc exists", exists("docs/b2b-public-repositioning/TENANT_PROVISIONING_SECURITY_POLICY.md"));
add("dry-run policy doc exists", exists("docs/b2b-public-repositioning/TENANT_PROVISIONING_DRY_RUN_POLICY.md"));
add("production execution boundary doc exists", exists("docs/b2b-public-repositioning/TENANT_PROVISIONING_PRODUCTION_EXECUTION_BOUNDARY.md"));
add("validation report exists", exists("docs/b2b-public-repositioning/P13_VALIDATION_REPORT.md"));
add("source of truth updated", /BB-B2B-P13/.test(sourceOfTruth) && /Guided Tenant Provisioning Readiness/.test(sourceOfTruth));
add("roadmap updated", /BB-B2B-P13/.test(roadmap) && /BB-B2B-P14/.test(roadmap));
add("completion roadmap updated", /BB-B2B-P13/.test(completionRoadmap) && /BB-B2B-P14/.test(completionRoadmap));
add("package exposes P13 validator", /"quality:b2b-guided-tenant-provisioning-readiness":\s*"node scripts\/quality\/validate-b2b-guided-tenant-provisioning-readiness\.mjs"/.test(packageJson));

console.table(checks);
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`B2B guided tenant provisioning readiness validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("B2B guided tenant provisioning readiness validation passed.");
