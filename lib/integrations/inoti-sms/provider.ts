import "server-only";

import { inotiLiveSmsAllowed } from "@/lib/integrations/inoti-runtime-safety";
import type { InotiCredentialProfile } from "@/lib/integrations/inoti-ussd/types";

export type InotiSmsMessageCategory = "TRANSACTIONAL" | "MARKETING";

export type InotiSmsValidationResult = {
  ok: boolean;
  state: "NOT_CONFIGURED" | "CREDENTIALS_AVAILABLE" | "AUTHENTICATED" | "SERVICE_DISCOVERY_UNAVAILABLE";
  smsCapability: "DETECTED" | "UNKNOWN" | "UNSUPPORTED";
  metadata: {
    provider: "INOTI_SMS";
    readOnly: true;
    realSendEnabled: false;
  };
};

export type InotiSmsActiveLinesResult =
  | {
      ok: true;
      code: "SMS_READ_ONLY_VERIFIED";
      activeLineCount: number;
      lineTypes: string[];
    }
  | {
      ok: false;
      code: "NO_SMS_TOKEN" | "INVALID_TOKEN" | "PROVIDER_UNAVAILABLE" | "CONTRACT_ERROR" | "TIMEOUT";
    };

export type InotiSmsSendInput = {
  to: string;
  message: string;
  category: InotiSmsMessageCategory;
  purpose: string;
  correlationId?: string | null;
};

export type InotiSmsSendResult = {
  ok: boolean;
  status: "QUEUED" | "SENDING" | "SENT" | "FAILED";
  providerMessageId?: string | null;
  error?: string | null;
};

export class InotiSmsProvider {
  validateConfiguration(credentialProfile: InotiCredentialProfile | null): InotiSmsValidationResult {
    if (!credentialProfile) {
      return {
        ok: false,
        state: "NOT_CONFIGURED",
        smsCapability: "UNKNOWN",
        metadata: { provider: "INOTI_SMS", readOnly: true, realSendEnabled: false },
      };
    }

    return {
      ok: true,
      state: "CREDENTIALS_AVAILABLE",
      smsCapability: "UNKNOWN",
      metadata: { provider: "INOTI_SMS", readOnly: true, realSendEnabled: false },
    };
  }

  async activeLinesReadOnly(credentialProfile: InotiCredentialProfile | null): Promise<InotiSmsActiveLinesResult> {
    const token = credentialProfile?.smsToken?.trim();
    if (!token) return { ok: false, code: "NO_SMS_TOKEN" };

    const endpoint = process.env.INOTI_SMS_ACTIVE_LINES_URL?.trim() || "https://restful.inoti.com/api/SMSAPI/ActiveLines";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ Token: token }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, code: "PROVIDER_UNAVAILABLE" };
      const payload = await response.json() as unknown;
      const lines = normalizeActiveLines(payload);
      if (!lines) return { ok: false, code: tokenFailure(payload) ? "INVALID_TOKEN" : "CONTRACT_ERROR" };
      return {
        ok: true,
        code: "SMS_READ_ONLY_VERIFIED",
        activeLineCount: lines.length,
        lineTypes: Array.from(new Set(lines.map((line) => line.lineType).filter(Boolean))).sort(),
      };
    } catch (error) {
      return { ok: false, code: error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "PROVIDER_UNAVAILABLE" };
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendMessage(_credentialProfile: InotiCredentialProfile | null, _input: InotiSmsSendInput): Promise<InotiSmsSendResult> {
    if (!inotiLiveSmsAllowed()) {
      return {
        ok: false,
        status: "FAILED",
        error: "INOTI_LIVE_SMS_DISABLED",
      };
    }
    return {
      ok: false,
      status: "FAILED",
      error: "INOTI_SMS_SEND_CONTRACT_UNVERIFIED",
    };
  }

  async getMessageStatus(_credentialProfile: InotiCredentialProfile | null, _providerMessageId: string): Promise<{
    ok: boolean;
    status: "SENT" | "DELIVERED" | "FAILED" | "UNKNOWN";
    error?: string | null;
  }> {
    return {
      ok: false,
      status: "UNKNOWN",
      error: "INOTI_SMS_STATUS_CONTRACT_UNVERIFIED",
    };
  }
}

export const inotiSmsProvider = new InotiSmsProvider();

function tokenFailure(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  const status = Number(record.Status ?? record.status ?? record.ResultCode ?? record.resultCode);
  return status === -20 || status === -21 || status === -2 || status === -6 || status === -10 || status === -11;
}

function normalizeActiveLines(payload: unknown): Array<{ lineType: string }> | null {
  const root = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
  const candidate = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.ObjActiveLinesOutput)
      ? root.ObjActiveLinesOutput
      : Array.isArray(root?.ActiveLines)
        ? root.ActiveLines
        : Array.isArray(root?.activeLines)
          ? root.activeLines
          : null;
  if (!candidate) return null;

  const lines: Array<{ lineType: string }> = [];
  for (const item of candidate) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (!("LineNumber" in record) && !("lineNumber" in record)) return null;
    lines.push({ lineType: String(record.LineType ?? record.lineType ?? "").trim() });
  }
  return lines;
}
