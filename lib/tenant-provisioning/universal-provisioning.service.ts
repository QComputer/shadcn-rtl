import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { OrganizationOnboardingService, type OnboardingActor } from "@/lib/organization-onboarding/service";
import { initializeOrganizationTx } from "@/lib/organization-onboarding/initialize-organization";
import { onboardingIdempotencyKeySchema } from "@/lib/organization-onboarding/contract";
import { universalProvisioningConfigurationSchema, executionRequestSchema } from "./universal-provisioning-contract";

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
type Tx = Prisma.TransactionClient;
export type UniversalExecutionReceipt = {
  planId: string; key: string; actorUserId: string; approvedSha256: string; organizationId: string; organizationSlug: string;
  propertyId: string | null; capabilities: string[]; entitledCapabilities: string[]; invitationIds: string[];
  activationState: string; publicPath: string; bookingEnabled: boolean; paymentsEnabled: boolean;
};
export class UniversalProvisioningService {
  private onboarding: OrganizationOnboardingService;
  constructor(private readonly db: PrismaClient = prisma) { this.onboarding = new OrganizationOnboardingService(db); }
  private async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && (["P2002", "P2034"].includes(error.code)
          || (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))))) {
          if (attempt < 3) continue;
          throw new ApiError(409, "هم‌زمانی یا تداخل اطلاعات؛ دوباره تلاش کنید");
        }
        throw error;
      }
    }
  }
  private async plan(tx: Tx, actor: OnboardingActor, id: string) {
    await this.onboarding.assertActorTx(tx, actor, true);
    await tx.$queryRaw`SELECT "id" FROM "TenantProvisioningPlan" WHERE "id"=${id} FOR UPDATE`;
    const plan = await tx.tenantProvisioningPlan.findUnique({ where: { id } });
    if (!plan) throw new ApiError(404, "طرح پیدا نشد");
    return plan;
  }
  private async validateInput(tx: Tx, raw: unknown) {
    const config = universalProvisioningConfigurationSchema.parse(raw);
    if (await tx.organization.findUnique({ where: { slug: config.slug }, select: { id: true } })) throw new ApiError(409, "نشانی سازمان قبلاً استفاده شده است");
    for (const recipient of config.recipients) await this.onboarding.assertInvitationRecipientTx(tx, recipient);
    return config;
  }
  private async audit(tx: Tx, actor: OnboardingActor, planId: string, description: string, value: Prisma.InputJsonValue, execution = false) {
    await tx.auditLog.create({ data: { action: "UPDATE", entityType: execution ? "TenantProvisioningExecution" : "TenantProvisioningPlan", entityId: planId, userId: actor.userId, description, newValue: value } });
  }
  async create(actor: OnboardingActor, raw: unknown, key: string) {
    const config = universalProvisioningConfigurationSchema.parse(raw);
    onboardingIdempotencyKeySchema.parse(key);
    return this.transaction(async (tx) => {
      await this.onboarding.assertActorTx(tx, actor, true);
      const existing = await tx.tenantProvisioningPlan.findUnique({ where: { idempotencyKey: key } });
      if (existing) {
        if (existing.createdById !== actor.userId || hash(existing.executionConfiguration) !== hash(config)) throw new ApiError(409, "کلید درخواست با طرح دیگری مرتبط است");
        return existing;
      }
      const plan = await tx.tenantProvisioningPlan.create({ data: {
        sourceType: "MANUAL", status: "DRAFT", idempotencyKey: key, createdById: actor.userId,
        proposedOrganizationType: config.type, proposedName: config.name, proposedSlug: config.slug, proposedDefaultLocale: config.locale,
        proposedTimezone: "Asia/Tehran", proposedCurrency: "IRR", proposedModules: config.enabledCapabilities,
        executionConfiguration: json(config), proposedDemoContent: false,
      } });
      await this.audit(tx, actor, plan.id, "طرح ایجاد سازمان ثبت شد", { status: "DRAFT" });
      return plan;
    });
  }
  async configure(actor: OnboardingActor, planId: string, raw: unknown) {
    const config = universalProvisioningConfigurationSchema.parse(raw);
    return this.transaction(async (tx) => {
      const plan = await this.plan(tx, actor, planId);
      if (!["DRAFT", "NEEDS_REVIEW", "READY", "FAILED"].includes(plan.status)) throw new ApiError(409, "طرح تأییدشده یا اجراشده قابل ویرایش نیست؛ طرح تازه ایجاد کنید");
      const updated = await tx.tenantProvisioningPlan.update({ where: { id: planId }, data: {
        executionConfiguration: json(config), proposedName: config.name, proposedSlug: config.slug,
        proposedOrganizationType: config.type, proposedDefaultLocale: config.locale, proposedModules: config.enabledCapabilities,
        status: "DRAFT", validationResult: Prisma.JsonNull, validatedAt: null, readyAt: null,
        approvedExecutionSnapshot: Prisma.JsonNull, approvedExecutionSha256: null, approvedAt: null, approvedById: null,
        validationVersion: { increment: 1 }, updatedById: actor.userId,
      } });
      await this.audit(tx, actor, planId, "تنظیمات طرح به‌روز شد", { status: "DRAFT" });
      return updated;
    });
  }
  async validate(actor: OnboardingActor, planId: string) {
    return this.transaction(async (tx) => {
      const plan = await this.plan(tx, actor, planId);
      if (!["DRAFT", "NEEDS_REVIEW", "READY", "FAILED"].includes(plan.status)) throw new ApiError(409, "وضعیت طرح برای بررسی معتبر نیست");
      const config = await this.validateInput(tx, plan.executionConfiguration);
      const updated = await tx.tenantProvisioningPlan.update({ where: { id: planId }, data: {
        status: "READY", validationResult: { ok: true, status: "READY", configurationSha256: hash(config), checks: [{ code: "P14_VALIDATED", ok: true, severity: "INFO", message: "اطلاعات، نشانی و هویت گیرندگان بررسی شد" }] },
        validationErrors: Prisma.JsonNull, validatedAt: new Date(), readyAt: new Date(), updatedById: actor.userId,
      } });
      await this.audit(tx, actor, planId, "اعتبارسنجی طرح موفق بود", { status: "READY", sha256: hash(config) });
      return updated;
    });
  }
  async approve(actor: OnboardingActor, planId: string) {
    return this.transaction(async (tx) => {
      const plan = await this.plan(tx, actor, planId);
      if (plan.status !== "READY") throw new ApiError(409, "ابتدا طرح را بررسی کنید");
      const config = await this.validateInput(tx, plan.executionConfiguration);
      if ((plan.validationResult as Prisma.JsonObject | null)?.configurationSha256 !== hash(config)) throw new ApiError(409, "نتیجه بررسی مربوط به تنظیمات کنونی نیست");
      const updated = await tx.tenantProvisioningPlan.update({ where: { id: planId }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: actor.userId, approvedExecutionSnapshot: json(config), approvedExecutionSha256: hash(config) } });
      await this.audit(tx, actor, planId, "نسخه مشخص طرح برای اجرا تأیید شد", { sha256: hash(config) });
      return updated;
    });
  }
  async execute(actor: OnboardingActor, planId: string, raw: unknown, key: string) {
    const request = executionRequestSchema.parse(raw);
    onboardingIdempotencyKeySchema.parse(key);
    return this.transaction(async (tx) => {
      const plan = await this.plan(tx, actor, planId);
      if (plan.executionReceipt) {
        const receipt = plan.executionReceipt as unknown as UniversalExecutionReceipt;
        if (receipt.key !== key || receipt.actorUserId !== actor.userId || receipt.approvedSha256 !== request.approvedSha256) throw new ApiError(409, "درخواست تکراری با رسید اجرا سازگار نیست");
        return { receipt, invitations: [], replayed: true };
      }
      if (plan.status !== "APPROVED" || plan.approvedExecutionSha256 !== request.approvedSha256 || hash(plan.approvedExecutionSnapshot) !== request.approvedSha256 || hash(plan.executionConfiguration) !== request.approvedSha256) throw new ApiError(409, "فقط نسخه دقیق تأییدشده قابل اجرا است");
      if (await tx.tenantProvisioningPlan.findFirst({ where: { executionReceipt: { path: ["key"], equals: key } }, select: { id: true } })) throw new ApiError(409, "کلید اجرا قبلاً استفاده شده است");
      const config = await this.validateInput(tx, plan.approvedExecutionSnapshot);
      if (plan.proposedName !== config.name || plan.proposedSlug !== config.slug || plan.proposedOrganizationType !== config.type || plan.proposedDefaultLocale !== config.locale) throw new ApiError(409, "اطلاعات طرح با نسخه تأییدشده متفاوت است");
      const { organization, property } = await initializeOrganizationTx(tx, { ...config, vertical: config.vertical ?? null, capabilities: config.enabledCapabilities });
      await tx.organizationAcquisition.create({ data: { organizationId: organization.id, sourceType: "BAZARBAAZ_TEAM", industryKey: "OTHER", createdByUserId: actor.userId,
        metadata: { workflow: "UNIVERSAL_PROVISIONING_V1", planId, key, approvedSha256: request.approvedSha256, entitledCapabilities: config.entitledCapabilities, operationalActivation: false } } });
      for (const capability of config.entitledCapabilities.filter((item) => !config.enabledCapabilities.includes(item))) await tx.organizationCapability.create({ data: { organizationId: organization.id, key: capability, status: "INACTIVE", disabledAt: new Date() } });
      const invitations = [];
      for (const [index, recipient] of config.recipients.entries()) invitations.push(await this.onboarding.issueInvitationTx(tx, actor, { ...recipient, organizationId: organization.id }, hash({ key, planId, index })));
      const receipt = { planId, key, actorUserId: actor.userId, approvedSha256: request.approvedSha256, organizationId: organization.id, organizationSlug: organization.slug,
        propertyId: property?.id ?? null, capabilities: config.enabledCapabilities, entitledCapabilities: config.entitledCapabilities,
        invitationIds: invitations.map((invitation) => invitation.invitationId), activationState: "AWAITING_ADMIN_ACTIVATION", publicPath: `/${config.locale}/${organization.slug}`, bookingEnabled: false, paymentsEnabled: false };
      await tx.tenantProvisioningPlan.update({ where: { id: planId }, data: { status: "COMPLETED", executionReceipt: json(receipt), executedAt: new Date() } });
      await this.audit(tx, actor, planId, "سازمان و دعوت‌نامه‌ها به‌صورت یکپارچه ایجاد شدند", json(receipt), true);
      return { receipt, invitations, replayed: false };
    });
  }
  async detail(actor: OnboardingActor, planId: string) {
    return this.transaction(async (tx) => {
      const plan = await this.plan(tx, actor, planId);
      const receipt = plan.executionReceipt as Prisma.JsonObject | null;
      const invitations = receipt?.organizationId && typeof receipt.organizationId === "string" ? await tx.organizationInvitation.findMany({ where: { organizationId: receipt.organizationId, recipientUserId: { not: null } }, select: { id: true, status: true, invitedRole: true, recipientUserId: true, recipientUsername: true, recipientEmail: true, expiresAt: true } }) : [];
      return { id: plan.id, status: plan.status, executionConfiguration: plan.executionConfiguration,
        approvedExecutionSha256: plan.approvedExecutionSha256, executionReceipt: plan.executionReceipt,
        executedAt: plan.executedAt, invitations };
    });
  }
}
export const universalProvisioningService = new UniversalProvisioningService();
