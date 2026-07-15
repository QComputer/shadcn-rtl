import { Prisma, type OrganizationType, type TenantProvisioningPlanStatus, type TenantProvisioningSourceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { supportedLocales } from "@/lib/i18n";
import { writeAuditLog } from "@/lib/audit-log";

const SUPPORTED_TIMEZONES = new Set(["Asia/Tehran"]);
const SUPPORTED_PACKAGE_IDS = new Set(["starter", "growth", "pro"]);
const RESERVED_SLUGS = new Set([
  "api",
  "admin",
  "dashboard",
  "login",
  "register",
  "request-demo",
  "onboarding",
  "pricing",
  "contact",
  "features",
  "demo",
  "trust",
  "privacy",
  "terms",
  "shop",
  "appointment",
  "uploads",
]);

const SHOP_BUSINESS_TYPES = new Set(["shop", "restaurant", "pharmacy", "repair", "education"]);
const APPOINTMENT_BUSINESS_TYPES = new Set(["clinic", "beauty", "service"]);

type PlanCheckSeverity = "ERROR" | "WARNING" | "INFO";

export type ProvisioningValidationCheck = {
  code: string;
  ok: boolean;
  severity: PlanCheckSeverity;
  message: string;
};

export type ProvisioningValidationResult = {
  ok: boolean;
  status: "READY" | "NEEDS_REVIEW";
  checks: ProvisioningValidationCheck[];
};

export type TenantProvisioningPlanDto = {
  id: string;
  requestDemoLeadId: string | null;
  sourceType: TenantProvisioningSourceType;
  sourceReference: string | null;
  status: TenantProvisioningPlanStatus;
  idempotencyKey: string;
  proposedOrganizationType: OrganizationType;
  proposedName: string;
  proposedSlug: string;
  proposedDefaultLocale: string;
  proposedTimezone: string;
  proposedCurrency: string | null;
  proposedOwnerName: string | null;
  proposedOwnerPhoneMasked: string | null;
  proposedOwnerEmail: string | null;
  proposedPackageId: string | null;
  proposedModules: Prisma.JsonValue | null;
  proposedFeatureFlags: Prisma.JsonValue | null;
  proposedSettings: Prisma.JsonValue | null;
  proposedDemoContent: boolean;
  proposedCustomDomain: string | null;
  validationVersion: number;
  validationResult: Prisma.JsonValue | null;
  validationErrors: Prisma.JsonValue | null;
  validatedAt: string | null;
  readyAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  requestDemoLead: {
    id: string;
    status: string;
    source: string | null;
    locale: string;
    fullName: string;
    businessName: string;
    businessType: string;
    phoneMasked: string;
    city: string | null;
    needSummary: string | null;
    consentAccepted: boolean;
    createdAt: string;
  } | null;
  auditEvents?: {
    id: string;
    action: string;
    description: string | null;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  }[];
};

type EditablePlanFields = {
  proposedOrganizationType?: OrganizationType;
  proposedName?: string;
  proposedSlug?: string;
  proposedDefaultLocale?: string;
  proposedTimezone?: string;
  proposedCurrency?: string | null;
  proposedOwnerName?: string | null;
  proposedOwnerPhone?: string | null;
  proposedOwnerEmail?: string | null;
  proposedPackageId?: string | null;
  proposedModules?: string[];
  proposedFeatureFlags?: Record<string, boolean>;
  proposedSettings?: Record<string, string | boolean | number | null>;
  proposedDemoContent?: boolean;
  proposedCustomDomain?: string | null;
};

function normalizePhone(input: string | null | undefined) {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("0098") && digits.length === 14) return `0${digits.slice(4)}`;
  if (digits.startsWith("0") && digits.length === 11) return digits;
  return digits || null;
}

function maskPhone(phone: string | null | undefined) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return normalized.length <= 4 ? "****" : `******${normalized.slice(-4)}`;
}

export function normalizeProvisioningSlug(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized.slice(0, 48);
}

function nameToSlug(name: string) {
  const ascii = normalizeProvisioningSlug(name);
  if (ascii.length >= 3) return ascii;
  return `tenant-${Date.now().toString(36)}`;
}

function parseNeedSummary(summary: string | null | undefined) {
  return {
    hasOrders: /orders|catalog|storefront|سفارش|محصول|کاتالوگ|فروشگاه/i.test(summary || ""),
    hasAppointments: /appointments|booking|نوبت|خدمت|زمان‌بندی/i.test(summary || ""),
    wantsDomain: /domain|دامنه/i.test(summary || ""),
  };
}

function recommendOrganizationType(businessType: string, needSummary?: string | null) {
  const normalized = businessType.trim().toLowerCase();
  const summary = parseNeedSummary(needSummary);
  if (SHOP_BUSINESS_TYPES.has(normalized) && summary.hasAppointments) return null;
  if (APPOINTMENT_BUSINESS_TYPES.has(normalized) && summary.hasOrders) return null;
  if (SHOP_BUSINESS_TYPES.has(normalized)) return "SHOP" as const;
  if (APPOINTMENT_BUSINESS_TYPES.has(normalized)) return "APPOINTMENT" as const;
  if (summary.hasOrders && !summary.hasAppointments) return "SHOP" as const;
  if (summary.hasAppointments && !summary.hasOrders) return "APPOINTMENT" as const;
  return null;
}

function modulesFor(type: OrganizationType, mixed = false) {
  const common = ["dashboard", "customer-club", "notifications", "reports"];
  if (mixed) return [...common, "storefront", "catalog", "orders", "appointments", "staff-scheduling"];
  if (type === "APPOINTMENT") return [...common, "appointments", "services", "staff-scheduling"];
  return [...common, "storefront", "catalog", "orders", "inventory"];
}

function featureFlagsFor(type: OrganizationType, mixed = false) {
  return {
    commerce: type === "SHOP" || mixed,
    appointments: type === "APPOINTMENT" || mixed,
    customerClub: true,
    smsDryRunOnly: true,
    customDomainIntentOnly: true,
  };
}

function sanitizeCustomDomain(input: string | null | undefined) {
  const value = input?.trim().toLowerCase();
  if (!value) return null;
  return value.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").slice(0, 253);
}

function isValidEmail(input: string | null | undefined) {
  if (!input) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function toDto(plan: Prisma.TenantProvisioningPlanGetPayload<{ include: { requestDemoLead: true } }>): TenantProvisioningPlanDto {
  return {
    id: plan.id,
    requestDemoLeadId: plan.requestDemoLeadId,
    sourceType: plan.sourceType,
    sourceReference: plan.sourceReference,
    status: plan.status,
    idempotencyKey: plan.idempotencyKey,
    proposedOrganizationType: plan.proposedOrganizationType,
    proposedName: plan.proposedName,
    proposedSlug: plan.proposedSlug,
    proposedDefaultLocale: plan.proposedDefaultLocale,
    proposedTimezone: plan.proposedTimezone,
    proposedCurrency: plan.proposedCurrency,
    proposedOwnerName: plan.proposedOwnerName,
    proposedOwnerPhoneMasked: maskPhone(plan.proposedOwnerPhone),
    proposedOwnerEmail: plan.proposedOwnerEmail,
    proposedPackageId: plan.proposedPackageId,
    proposedModules: plan.proposedModules,
    proposedFeatureFlags: plan.proposedFeatureFlags,
    proposedSettings: plan.proposedSettings,
    proposedDemoContent: plan.proposedDemoContent,
    proposedCustomDomain: plan.proposedCustomDomain,
    validationVersion: plan.validationVersion,
    validationResult: plan.validationResult,
    validationErrors: plan.validationErrors,
    validatedAt: plan.validatedAt?.toISOString() ?? null,
    readyAt: plan.readyAt?.toISOString() ?? null,
    approvedAt: plan.approvedAt?.toISOString() ?? null,
    cancelledAt: plan.cancelledAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    requestDemoLead: plan.requestDemoLead
      ? {
          id: plan.requestDemoLead.id,
          status: plan.requestDemoLead.status,
          source: plan.requestDemoLead.source,
          locale: plan.requestDemoLead.locale,
          fullName: plan.requestDemoLead.fullName,
          businessName: plan.requestDemoLead.businessName,
          businessType: plan.requestDemoLead.businessType,
          phoneMasked: maskPhone(plan.requestDemoLead.phone) || "****",
          city: plan.requestDemoLead.city,
          needSummary: plan.requestDemoLead.needSummary,
          consentAccepted: plan.requestDemoLead.consentAccepted,
          createdAt: plan.requestDemoLead.createdAt.toISOString(),
        }
      : null,
  };
}

async function auditPlan(action: "CREATE" | "UPDATE" | "CHANGE_STATUS", planId: string, userId: string, description: string, newValue?: unknown) {
  await writeAuditLog({
    action,
    entityType: "TenantProvisioningPlan",
    entityId: planId,
    description,
    newValue,
    userId,
  });
}

async function listPlanAuditEvents(planId: string) {
  const events = await prisma.auditLog.findMany({
    where: { entityType: "TenantProvisioningPlan", entityId: planId },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      action: true,
      description: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
  return events.map((event) => ({
    ...event,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function listTenantProvisioningPlans() {
  const plans = await prisma.tenantProvisioningPlan.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { requestDemoLead: true },
  });
  return plans.map(toDto);
}

export async function getTenantProvisioningPlan(planId: string) {
  const plan = await prisma.tenantProvisioningPlan.findUnique({
    where: { id: planId },
    include: { requestDemoLead: true },
  });
  if (!plan) throw new ApiError(404, "Provisioning plan not found");
  return {
    ...toDto(plan),
    auditEvents: await listPlanAuditEvents(plan.id),
  };
}

export async function createTenantProvisioningPlan(input: { requestDemoLeadId: string; createdById: string; idempotencyKey?: string }) {
  const lead = await prisma.requestDemoLead.findUnique({ where: { id: input.requestDemoLeadId } });
  if (!lead) throw new ApiError(404, "Lead not found");
  if (!lead.consentAccepted || lead.status === "REJECTED" || lead.status === "ARCHIVED") {
    throw new ApiError(400, "Lead is not eligible for provisioning readiness");
  }

  const existing = await prisma.tenantProvisioningPlan.findFirst({
    where: { requestDemoLeadId: lead.id, sourceType: lead.source === "business-onboarding-wizard" ? "ONBOARDING_WIZARD" : "REQUEST_DEMO_LEAD" },
    include: { requestDemoLead: true },
  });
  if (existing) return toDto(existing);

  const recommendation = recommendOrganizationType(lead.businessType, lead.needSummary);
  const proposedOrganizationType: OrganizationType = recommendation || "SHOP";
  const mixed = recommendation === null;
  const sourceType: TenantProvisioningSourceType = lead.source === "business-onboarding-wizard" ? "ONBOARDING_WIZARD" : "REQUEST_DEMO_LEAD";
  const idempotencyKey = input.idempotencyKey?.trim() || `${sourceType}:${lead.id}`;
  const customDomainIntent = parseNeedSummary(lead.needSummary).wantsDomain ? "" : null;

  const plan = await prisma.tenantProvisioningPlan.upsert({
    where: { idempotencyKey },
    create: {
      requestDemoLeadId: lead.id,
      sourceType,
      sourceReference: lead.id,
      status: mixed ? "NEEDS_REVIEW" : "DRAFT",
      idempotencyKey,
      proposedOrganizationType,
      proposedName: lead.businessName.trim(),
      proposedSlug: nameToSlug(lead.businessName),
      proposedDefaultLocale: supportedLocales.includes(lead.locale as (typeof supportedLocales)[number]) ? lead.locale : "fa",
      proposedTimezone: "Asia/Tehran",
      proposedCurrency: "IRR",
      proposedOwnerName: lead.fullName.trim(),
      proposedOwnerPhone: normalizePhone(lead.phone),
      proposedOwnerEmail: null,
      proposedPackageId: null,
      proposedModules: modulesFor(proposedOrganizationType, mixed) as Prisma.InputJsonValue,
      proposedFeatureFlags: featureFlagsFor(proposedOrganizationType, mixed) as Prisma.InputJsonValue,
      proposedSettings: {
        sourceLeadStatus: lead.status,
        needsAdminDecision: mixed,
        executionImplemented: false,
      } as Prisma.InputJsonValue,
      proposedDemoContent: false,
      proposedCustomDomain: customDomainIntent,
      createdById: input.createdById,
      updatedById: input.createdById,
    },
    update: {},
    include: { requestDemoLead: true },
  });

  await auditPlan("CREATE", plan.id, input.createdById, "Tenant provisioning readiness plan created", {
    requestDemoLeadId: lead.id,
    status: plan.status,
  });

  return toDto(plan);
}

export async function updateTenantProvisioningPlan(planId: string, input: EditablePlanFields, userId: string) {
  const existing = await prisma.tenantProvisioningPlan.findUnique({ where: { id: planId } });
  if (!existing) throw new ApiError(404, "Provisioning plan not found");
  if (existing.status === "APPROVED" || existing.status === "CANCELLED") {
    throw new ApiError(400, "Approved or cancelled plans cannot be edited");
  }

  const data: Prisma.TenantProvisioningPlanUpdateInput = {
    updatedBy: { connect: { id: userId } },
    status: existing.status === "READY" ? "NEEDS_REVIEW" : existing.status,
    validationResult: Prisma.JsonNull,
    validationErrors: Prisma.JsonNull,
    validatedAt: null,
    readyAt: null,
    validationVersion: { increment: 1 },
  };

  if (input.proposedOrganizationType) data.proposedOrganizationType = input.proposedOrganizationType;
  if (typeof input.proposedName === "string") data.proposedName = input.proposedName.trim().slice(0, 200);
  if (typeof input.proposedSlug === "string") data.proposedSlug = normalizeProvisioningSlug(input.proposedSlug);
  if (typeof input.proposedDefaultLocale === "string") data.proposedDefaultLocale = input.proposedDefaultLocale.trim();
  if (typeof input.proposedTimezone === "string") data.proposedTimezone = input.proposedTimezone.trim();
  if ("proposedCurrency" in input) data.proposedCurrency = input.proposedCurrency?.trim() || null;
  if ("proposedOwnerName" in input) data.proposedOwnerName = input.proposedOwnerName?.trim() || null;
  if ("proposedOwnerPhone" in input) data.proposedOwnerPhone = normalizePhone(input.proposedOwnerPhone);
  if ("proposedOwnerEmail" in input) data.proposedOwnerEmail = input.proposedOwnerEmail?.trim().toLowerCase() || null;
  if ("proposedPackageId" in input) data.proposedPackageId = input.proposedPackageId?.trim() || null;
  if (input.proposedModules) data.proposedModules = input.proposedModules as Prisma.InputJsonValue;
  if (input.proposedFeatureFlags) data.proposedFeatureFlags = input.proposedFeatureFlags as Prisma.InputJsonValue;
  if (input.proposedSettings) data.proposedSettings = input.proposedSettings as Prisma.InputJsonValue;
  if (typeof input.proposedDemoContent === "boolean") data.proposedDemoContent = input.proposedDemoContent;
  if ("proposedCustomDomain" in input) data.proposedCustomDomain = sanitizeCustomDomain(input.proposedCustomDomain);

  const plan = await prisma.tenantProvisioningPlan.update({
    where: { id: planId },
    data,
    include: { requestDemoLead: true },
  });
  await auditPlan("UPDATE", plan.id, userId, "Tenant provisioning readiness plan edited");
  return toDto(plan);
}

function addCheck(checks: ProvisioningValidationCheck[], code: string, ok: boolean, severity: PlanCheckSeverity, message: string) {
  checks.push({ code, ok, severity, message });
}

export async function validateTenantProvisioningPlan(planId: string, userId: string) {
  const plan = await prisma.tenantProvisioningPlan.findUnique({
    where: { id: planId },
    include: { requestDemoLead: true },
  });
  if (!plan) throw new ApiError(404, "Provisioning plan not found");
  if (plan.status === "CANCELLED") throw new ApiError(400, "Cancelled plans cannot be validated");

  await prisma.tenantProvisioningPlan.update({
    where: { id: planId },
    data: { status: "VALIDATING", updatedById: userId },
  });
  await auditPlan("CHANGE_STATUS", plan.id, userId, "Tenant provisioning dry-run validation started", { status: "VALIDATING" });

  const checks: ProvisioningValidationCheck[] = [];
  addCheck(checks, "SOURCE_LEAD_EXISTS", Boolean(plan.requestDemoLead), "ERROR", "Source lead exists.");
  addCheck(checks, "SOURCE_LEAD_ELIGIBLE", Boolean(plan.requestDemoLead?.consentAccepted) && !["REJECTED", "ARCHIVED"].includes(plan.requestDemoLead?.status || ""), "ERROR", "Source lead is eligible and has consent.");
  addCheck(checks, "ORGANIZATION_NAME_PRESENT", plan.proposedName.trim().length >= 2, "ERROR", "Organization name is present.");
  addCheck(checks, "ORGANIZATION_TYPE_VALID", ["SHOP", "APPOINTMENT"].includes(plan.proposedOrganizationType), "ERROR", "Organization type is supported.");
  addCheck(checks, "SLUG_SYNTAX_VALID", /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plan.proposedSlug) && plan.proposedSlug.length >= 3, "ERROR", "Slug syntax is valid.");
  addCheck(checks, "SLUG_NOT_RESERVED", !RESERVED_SLUGS.has(plan.proposedSlug), "ERROR", "Slug is not reserved by platform routes.");

  const [slugOrg, slugPlan, ownerEmail, ownerPhone] = await Promise.all([
    prisma.organization.findFirst({ where: { slug: plan.proposedSlug, deletedAt: null }, select: { id: true } }),
    prisma.tenantProvisioningPlan.findFirst({
      where: { id: { not: plan.id }, proposedSlug: plan.proposedSlug, status: { notIn: ["CANCELLED", "FAILED"] } },
      select: { id: true },
    }),
    plan.proposedOwnerEmail ? prisma.user.findFirst({ where: { email: plan.proposedOwnerEmail, deletedAt: null }, select: { id: true } }) : null,
    plan.proposedOwnerPhone ? prisma.user.findFirst({ where: { phone: plan.proposedOwnerPhone, deletedAt: null }, select: { id: true } }) : null,
  ]);

  addCheck(checks, "SLUG_AVAILABLE", !slugOrg && !slugPlan, "ERROR", "Slug is available.");
  addCheck(checks, "OWNER_IDENTIFIER_PRESENT", Boolean(plan.proposedOwnerPhone || plan.proposedOwnerEmail), "ERROR", "Owner phone or email is present.");
  addCheck(checks, "OWNER_PHONE_NORMALIZED", !plan.proposedOwnerPhone || /^09\d{9}$/.test(plan.proposedOwnerPhone), "ERROR", "Owner phone is normalized Iranian mobile format when present.");
  addCheck(checks, "OWNER_EMAIL_VALID", !plan.proposedOwnerEmail || isValidEmail(plan.proposedOwnerEmail), "ERROR", "Owner email is valid when present.");
  addCheck(checks, "OWNER_IDENTITY_CONFLICT", !ownerEmail && !ownerPhone, "WARNING", "Existing owner identity conflict is classified for admin review.");
  addCheck(checks, "PACKAGE_VALID", !plan.proposedPackageId || SUPPORTED_PACKAGE_IDS.has(plan.proposedPackageId), "ERROR", "Package intent is supported when supplied.");
  addCheck(checks, "MODULES_VALID", Array.isArray(plan.proposedModules) && (plan.proposedModules as Prisma.JsonArray).length > 0, "ERROR", "Module list is present.");
  addCheck(checks, "LOCALE_SUPPORTED", supportedLocales.includes(plan.proposedDefaultLocale as (typeof supportedLocales)[number]), "ERROR", "Locale is supported.");
  addCheck(checks, "TIMEZONE_SUPPORTED", SUPPORTED_TIMEZONES.has(plan.proposedTimezone), "ERROR", "Timezone is supported.");
  addCheck(checks, "CUSTOM_DOMAIN_INTENT_ONLY", true, "INFO", "Custom-domain value is informational only; no provider action is performed.");
  addCheck(checks, "NO_ORGANIZATION_CREATED", true, "INFO", "Dry run does not create organizations.");
  addCheck(checks, "NO_USER_CREATED", true, "INFO", "Dry run does not create users.");
  addCheck(checks, "NO_MEMBERSHIP_CREATED", true, "INFO", "Dry run does not create memberships.");
  addCheck(checks, "NO_SUBSCRIPTION_CREATED", true, "INFO", "Dry run does not create package/subscription records.");
  addCheck(checks, "NO_INVITATION_CREATED", true, "INFO", "Dry run does not create invitations.");
  addCheck(checks, "NO_NOTIFICATION_SENT", true, "INFO", "Dry run does not send SMS, email, Web Push, or in-app notifications.");
  addCheck(checks, "NO_DOMAIN_PROVIDER_ACTION", true, "INFO", "Dry run does not mutate custom-domain providers.");

  const hasBlockingErrors = checks.some((check) => check.severity === "ERROR" && !check.ok);
  const hasWarning = checks.some((check) => check.severity === "WARNING" && !check.ok);
  const result: ProvisioningValidationResult = {
    ok: !hasBlockingErrors,
    status: hasBlockingErrors || hasWarning ? "NEEDS_REVIEW" : "READY",
    checks,
  };

  const updated = await prisma.tenantProvisioningPlan.update({
    where: { id: plan.id },
    data: {
      status: result.status,
      validationResult: result as unknown as Prisma.InputJsonValue,
      validationErrors: checks.filter((check) => !check.ok) as unknown as Prisma.InputJsonValue,
      validationVersion: { increment: 1 },
      validatedAt: new Date(),
      readyAt: result.status === "READY" ? new Date() : null,
      updatedById: userId,
    },
    include: { requestDemoLead: true },
  });
  await auditPlan(result.ok ? "UPDATE" : "CHANGE_STATUS", plan.id, userId, result.ok ? "Tenant provisioning dry-run validation completed" : "Tenant provisioning dry-run validation needs review", {
    status: result.status,
    failedChecks: checks.filter((check) => !check.ok).map((check) => check.code),
  });
  return toDto(updated);
}

async function transitionPlan(planId: string, userId: string, target: TenantProvisioningPlanStatus, allowedFrom: TenantProvisioningPlanStatus[], description: string) {
  if (target === "EXECUTING" || target === "COMPLETED") {
    throw new ApiError(400, "Provisioning execution is not implemented in P13");
  }
  const existing = await prisma.tenantProvisioningPlan.findUnique({ where: { id: planId } });
  if (!existing) throw new ApiError(404, "Provisioning plan not found");
  if (!allowedFrom.includes(existing.status)) throw new ApiError(400, "Invalid provisioning plan transition");
  if (target === "READY") {
    const result = existing.validationResult as ProvisioningValidationResult | null;
    if (!result?.ok || result.status !== "READY") throw new ApiError(400, "Plan must pass dry-run validation before READY");
  }
  if (target === "APPROVED" && existing.status !== "READY") throw new ApiError(400, "Only READY plans can be approved");

  const now = new Date();
  const updated = await prisma.tenantProvisioningPlan.update({
    where: { id: planId },
    data: {
      status: target,
      updatedById: userId,
      ...(target === "READY" ? { readyAt: now } : {}),
      ...(target === "APPROVED" ? { approvedAt: now, approvedById: userId } : {}),
      ...(target === "CANCELLED" ? { cancelledAt: now } : {}),
    },
    include: { requestDemoLead: true },
  });
  await auditPlan("CHANGE_STATUS", updated.id, userId, description, { status: target });
  return toDto(updated);
}

export function markTenantProvisioningPlanReady(planId: string, userId: string) {
  return transitionPlan(planId, userId, "READY", ["READY"], "Tenant provisioning plan marked READY");
}

export function approveTenantProvisioningPlan(planId: string, userId: string) {
  return transitionPlan(planId, userId, "APPROVED", ["READY"], "Tenant provisioning plan approved without execution");
}

export function returnTenantProvisioningPlanForReview(planId: string, userId: string) {
  return transitionPlan(planId, userId, "NEEDS_REVIEW", ["READY", "APPROVED"], "Tenant provisioning plan returned for review");
}

export function cancelTenantProvisioningPlan(planId: string, userId: string) {
  return transitionPlan(planId, userId, "CANCELLED", ["DRAFT", "NEEDS_REVIEW", "READY"], "Tenant provisioning plan cancelled");
}
