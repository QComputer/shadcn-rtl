import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"
import { notificationPreferencesService } from "@/lib/services/notification-preferences.service"
import { SmsDryRunProvider } from "@/lib/sms/sms-dry-run-provider"
import { SmsIrProvider } from "@/lib/sms/sms-ir-provider"
import { getSmsRuntimeConfig } from "@/lib/sms/sms-provider"
import type { SmsPreferenceKind, SmsProvider, SmsPurpose, SmsSendResult } from "@/lib/sms/sms.types"
import { maskPhoneNumber } from "@/lib/sms/sms.types"

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

export function createSmsProvider(): SmsProvider {
  const config = getSmsRuntimeConfig()
  if (config.provider === "sms_ir" && !config.dryRun) return new SmsIrProvider()
  return new SmsDryRunProvider()
}

export class SmsService {
  async sendTextToCustomer(input: SendCustomerSmsInput): Promise<SmsSendResult> {
    const organization = await this.requireOrganization(input.organizationId)
    const customer = await this.requireCustomer(input.customerId)
    const to = this.normalizePhone(input.to || customer.phone || "")
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

  getConfig() {
    return getSmsRuntimeConfig()
  }

  private normalizePhone(value: string) {
    return value.trim().replace(/[\s-]/g, "")
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
export { getSmsRuntimeConfig, maskPhoneNumber }
