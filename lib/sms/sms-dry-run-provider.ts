import type { SmsProvider, SmsSendResult, SmsSendTextInput, SmsSendVerifyCodeInput } from "@/lib/sms/sms.types"

export class SmsDryRunProvider implements SmsProvider {
  async sendText(input: SmsSendTextInput): Promise<SmsSendResult> {
    return {
      ok: true,
      provider: "dry_run",
      dryRun: true,
      message: `Dry-run SMS queued for ${input.purpose}`,
      packId: input.correlationId,
    }
  }

  async sendVerifyCode(input: SmsSendVerifyCodeInput): Promise<SmsSendResult> {
    return {
      ok: true,
      provider: "dry_run",
      dryRun: true,
      message: `Dry-run SMS verification queued for template ${input.templateId}`,
      packId: input.correlationId,
    }
  }
}
