import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"
import { notificationPreferencesService } from "@/lib/services/notification-preferences.service"
import { SmsDryRunProvider } from "@/lib/sms/sms-dry-run-provider"
import { SmsIrProvider } from "@/lib/sms/sms-ir-provider"
import { getSmsRuntimeConfig } from "@/lib/sms/sms-provider"
import { maskPhoneNumber, normalizeIranianMobile } from "@/lib/sms/phone-normalization"
import type { SmsPreferenceKind, SmsProvider, SmsPurpose, SmsSendResult } from "@/lib/sms/sms.types"
import { deliveryAttemptRecorder } from "@/lib/notifications/delivery-attempt-recorder"

type SendCustomerSmsInput = {
  organizationId: string
  customerId: string
  actorUserId?: string | null
  to: string
  message: string
  purpose: SmsPurpose
  preferenceKind?: SmsPreferenceKind
  correlationId?: string
}

type SendBulkInput = {
  organizationId: string
  actorUserId?: string | null
  to: string[]
  message: string
  purpose: SmsPurpose
  preferenceKind?: SmsPreferenceKind
  correlationId?: string
}

type SendLikeToLikeInput = {
  organizationId: string
  actorUserId?: string | null
  to: string[]
  messages: string[]
  purpose: SmsPurpose
  preferenceKind?: SmsPreferenceKind
  correlationId?: string
}

type SendToPhoneInput = {
  organizationId: string
  actorUserId?: string | null
  to: string
  message: string
  purpose: SmsPurpose
  dryRun?: boolean
  guestCustomerId?: string | null
  orderId?: string | null
  correlationId?: string
}

export function createSmsProvider(): SmsProvider {
  const config = getSmsRuntimeConfig()
  if (config.provider === "sms_ir" && !config.dryRun) return new SmsIrProvider()
  return new SmsDryRunProvider()
}

export class SmsService {
  async sendTextToCustomer(input: SendCustomerSmsInput): Promise<SmsSendResult> {
    const organization = await this.requireOrganization(input.organizationId)
    const customer = await this.requireCustomer(input.customerId)
    const to = normalizeIranianMobile(input.to || customer.phone || "")
    const message = input.message.trim()
    const preferenceKind = input.preferenceKind || "transactional"

    if (!to) throw new ApiError(400, "SMS recipient phone number is required")
    if (!message) throw new ApiError(400, "SMS message is required")

    const config = getSmsRuntimeConfig()
    const allowed = await notificationPreferencesService.isCustomerDeliveryAllowed({
      organizationId: organization.id,
      customerId: customer.id,
      channel: "SMS",
      kind: preferenceKind,
    })

    if (!allowed) {
      const delivery = await prisma.smsDelivery.create({
        data: {
          organizationId: organization.id,
          customerId: customer.id,
          actorUserId: input.actorUserId || null,
          phoneMasked: maskPhoneNumber(to),
          purpose: input.purpose,
          message,
          provider: config.provider,
          dryRun: config.dryRun,
          status: "SKIPPED",
          error: `SMS ${preferenceKind} preference is disabled`,
        },
        select: { id: true },
      })

      return {
        ok: false,
        provider: config.provider,
        dryRun: config.dryRun,
        skipped: true,
        deliveryId: delivery.id,
        error: `SMS ${preferenceKind} preference is disabled`,
      }
    }

    if (config.realSendEnabled && !config.configured) {
      throw new ApiError(409, "SMS.ir is not configured")
    }

    const delivery = await prisma.smsDelivery.create({
      data: {
        organizationId: organization.id,
        customerId: customer.id,
        actorUserId: input.actorUserId || null,
        phoneMasked: maskPhoneNumber(to),
        purpose: input.purpose,
        message,
        provider: config.provider,
        dryRun: config.dryRun,
        status: "PENDING",
      },
      select: { id: true },
    })

    const provider = createSmsProvider()
    const result = await provider.sendText({
      to,
      message,
      purpose: input.purpose,
      correlationId: input.correlationId || delivery.id,
    })

    await prisma.smsDelivery.update({
      where: { id: delivery.id },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        externalMessageId: result.messageId != null ? String(result.messageId) : null,
        externalPackId: result.packId != null ? String(result.packId) : null,
        providerStatus: result.status ?? null,
        providerMessage: result.message ?? null,
        error: result.error ?? null,
        sentAt: result.ok ? new Date() : null,
      },
    })

    await deliveryAttemptRecorder.record({
      organizationId: organization.id,
      targetUserId: customer.id,
      orderId: null,
      guestCustomerId: null,
      notificationId: null,
      channel: "SMS",
      purpose: input.purpose,
      status: result.ok ? "SENT" : "FAILED",
      dryRun: config.dryRun,
      retryable: !result.ok && !config.dryRun,
      lastErrorText: result.error || null,
      providerMessageId: result.messageId != null ? String(result.messageId) : null,
      actorUserId: input.actorUserId || null,
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "SmsDelivery",
      entityId: delivery.id,
      description: config.dryRun ? "SMS dry-run delivery recorded" : "SMS delivery attempted",
      newValue: {
        provider: config.provider,
        dryRun: config.dryRun,
        purpose: input.purpose,
        preferenceKind,
        phoneMasked: maskPhoneNumber(to),
        ok: result.ok,
        status: result.status ?? null,
      },
      userId: input.actorUserId || undefined,
      organizationId: organization.id,
    })

    return { ...result, deliveryId: delivery.id }
  }

  async sendBulk(input: SendBulkInput): Promise<SmsSendResult> {
    const organization = await this.requireOrganization(input.organizationId)
    const message = input.message.trim()
    const config = getSmsRuntimeConfig()

    if (input.to.length === 0) throw new ApiError(400, "SMS recipient list is empty")
    if (!message) throw new ApiError(400, "SMS message is required")

    const normalized = input.to.map((phone) => normalizeIranianMobile(phone)).filter((phone): phone is string => phone !== null)
    if (normalized.length === 0) throw new ApiError(400, "No valid Iranian mobile numbers provided")

    if (config.realSendEnabled && !config.configured) {
      throw new ApiError(409, "SMS.ir is not configured")
    }

    const maskedPhones = normalized.map((phone) => maskPhoneNumber(phone))

    const provider = createSmsProvider()
    const result = await provider.sendBulk?.({
      to: normalized,
      message,
      purpose: input.purpose,
      correlationId: input.correlationId,
    }) || {
      ok: true,
      provider: config.provider,
      dryRun: config.dryRun,
      message: "Dry-run bulk send queued",
      packId: input.correlationId,
    }

    for (const masked of maskedPhones) {
      await prisma.smsDelivery.create({
        data: {
          organizationId: organization.id,
          actorUserId: input.actorUserId || null,
          phoneMasked: masked,
          purpose: input.purpose,
          message,
          provider: config.provider,
          dryRun: config.dryRun,
          status: result.ok ? "SENT" : "FAILED",
          externalMessageId: result.messageId != null ? String(result.messageId) : null,
          externalPackId: result.packId != null ? String(result.packId) : null,
          providerStatus: result.status ?? null,
          providerMessage: result.message ?? null,
          error: result.error ?? null,
          sentAt: result.ok ? new Date() : null,
        },
        select: { id: true },
      })
    }

    return result
  }

  async sendLikeToLike(input: SendLikeToLikeInput): Promise<SmsSendResult> {
    const organization = await this.requireOrganization(input.organizationId)
    const config = getSmsRuntimeConfig()

    if (input.to.length === 0) throw new ApiError(400, "SMS recipient list is empty")
    if (input.messages.length !== input.to.length) throw new ApiError(400, "messages and mobiles length mismatch")

    const normalized = input.to.map((phone) => normalizeIranianMobile(phone)).filter((phone): phone is string => phone !== null)
    if (normalized.length === 0) throw new ApiError(400, "No valid Iranian mobile numbers provided")

    if (config.realSendEnabled && !config.configured) {
      throw new ApiError(409, "SMS.ir is not configured")
    }

    const maskedPhones = normalized.map((phone) => maskPhoneNumber(phone))

    const provider = createSmsProvider()
    const result = await provider.sendLikeToLike?.({
      to: normalized,
      messages: input.messages.slice(0, normalized.length),
      purpose: input.purpose,
      correlationId: input.correlationId,
    }) || {
      ok: true,
      provider: config.provider,
      dryRun: config.dryRun,
      message: "Dry-run likeToLike send queued",
      packId: input.correlationId,
    }

    for (const masked of maskedPhones) {
      await prisma.smsDelivery.create({
        data: {
          organizationId: organization.id,
          actorUserId: input.actorUserId || null,
          phoneMasked: masked,
          purpose: input.purpose,
          message: "",
          provider: config.provider,
          dryRun: config.dryRun,
          status: result.ok ? "SENT" : "FAILED",
          externalMessageId: result.messageId != null ? String(result.messageId) : null,
          externalPackId: result.packId != null ? String(result.packId) : null,
          providerStatus: result.status ?? null,
          providerMessage: result.message ?? null,
          error: result.error ?? null,
          sentAt: result.ok ? new Date() : null,
        },
        select: { id: true },
      })
    }

    return result
  }

  async sendTextToPhone(input: SendToPhoneInput): Promise<SmsSendResult> {
    const organization = await this.requireOrganization(input.organizationId)
    const to = normalizeIranianMobile(input.to)
    const message = input.message.trim()
    const config = getSmsRuntimeConfig()
    const dryRun = input.dryRun ?? config.dryRun

    if (!to) throw new ApiError(400, "SMS recipient phone number is required")
    if (!message) throw new ApiError(400, "SMS message is required")

    if (dryRun) {
      const delivery = await prisma.smsDelivery.create({
        data: {
          organizationId: organization.id,
          actorUserId: input.actorUserId || null,
          phoneMasked: maskPhoneNumber(to),
          purpose: input.purpose,
          message,
          provider: config.provider,
          dryRun: true,
          status: "PENDING",
        },
        select: { id: true },
      })

      const result: SmsSendResult = {
        ok: true,
        provider: config.provider,
        dryRun: true,
        message: `Dry-run SMS queued for ${input.purpose}`,
        packId: input.correlationId || delivery.id,
      }

      await prisma.smsDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          providerMessage: result.message,
          sentAt: new Date(),
        },
      })

      await deliveryAttemptRecorder.record({
        organizationId: organization.id,
        targetUserId: null,
        orderId: input.orderId || null,
        guestCustomerId: input.guestCustomerId || null,
        notificationId: null,
        channel: "SMS",
        purpose: input.purpose,
        status: "DRY_RUN",
        dryRun: true,
        retryable: false,
        providerMessageId: null,
        actorUserId: input.actorUserId || null,
      })

      await writeAuditLog({
        action: "CREATE",
        entityType: "SmsDelivery",
        entityId: delivery.id,
        description: "SMS dry-run delivery recorded",
        newValue: {
          provider: config.provider,
          dryRun: true,
          purpose: input.purpose,
          phoneMasked: maskPhoneNumber(to),
          ok: true,
          status: "DRY_RUN",
        },
        userId: input.actorUserId || undefined,
        organizationId: organization.id,
      })

      return { ...result, deliveryId: delivery.id }
    }

    if (config.realSendEnabled && !config.configured) {
      throw new ApiError(409, "SMS.ir is not configured")
    }

    const delivery = await prisma.smsDelivery.create({
      data: {
        organizationId: organization.id,
        actorUserId: input.actorUserId || null,
        phoneMasked: maskPhoneNumber(to),
        purpose: input.purpose,
        message,
        provider: config.provider,
        dryRun: false,
        status: "PENDING",
      },
      select: { id: true },
    })

    const provider = createSmsProvider()
    const result = await provider.sendText({
      to,
      message,
      purpose: input.purpose,
      correlationId: input.correlationId || delivery.id,
    })

    await prisma.smsDelivery.update({
      where: { id: delivery.id },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        externalMessageId: result.messageId != null ? String(result.messageId) : null,
        externalPackId: result.packId != null ? String(result.packId) : null,
        providerStatus: result.status ?? null,
        providerMessage: result.message ?? null,
        error: result.error ?? null,
        sentAt: result.ok ? new Date() : null,
      },
    })

    await deliveryAttemptRecorder.record({
      organizationId: organization.id,
      targetUserId: null,
      orderId: input.orderId || null,
      guestCustomerId: input.guestCustomerId || null,
      notificationId: null,
      channel: "SMS",
      purpose: input.purpose,
      status: result.ok ? "SENT" : "FAILED",
      dryRun: false,
      retryable: !result.ok,
      lastErrorText: result.error || null,
      providerMessageId: result.messageId != null ? String(result.messageId) : null,
      actorUserId: input.actorUserId || null,
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "SmsDelivery",
      entityId: delivery.id,
      description: config.dryRun ? "SMS dry-run delivery recorded" : "SMS delivery attempted",
      newValue: {
        provider: config.provider,
        dryRun: config.dryRun,
        purpose: input.purpose,
        phoneMasked: maskPhoneNumber(to),
        ok: result.ok,
        status: result.status ?? null,
      },
      userId: input.actorUserId || undefined,
      organizationId: organization.id,
    })

    return { ...result, deliveryId: delivery.id }
  }

  async getProviderLines(input?: { pageSize?: number }): Promise<{ ok: boolean; lines?: number[]; error?: string }> {
    const config = getSmsRuntimeConfig()
    if (config.provider !== "sms_ir") {
      return { ok: false, error: "SMS provider is not sms_ir" }
    }
    const provider = createSmsProvider()
    if (!provider) {
      return { ok: false, error: "sms.ir client is not configured" }
    }
    return provider.getLines?.(input) || { ok: false, error: "getLines not supported" }
  }

  getConfig() {
    return getSmsRuntimeConfig()
  }

  private normalizePhone(value: string) {
    return normalizeIranianMobile(value) || value.trim().replace(/[\s-]/g, "")
  }

  private async requireOrganization(id: string) {
    const organization = await prisma.organization.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true },
    })
    if (!organization) throw new ApiError(404, "Organization not found")
    return organization
  }

  private async requireCustomer(id: string) {
    const customer = await prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true, phone: true },
    })
    if (!customer) throw new ApiError(404, "Customer not found")
    return customer
  }
}

export const smsService = new SmsService()

export type { SmsPreferenceKind, SmsProvider, SmsPurpose, SmsSendResult }
export { getSmsRuntimeConfig, maskPhoneNumber, normalizeIranianMobile }
