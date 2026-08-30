import "server-only";

import { normalizeIranianMobile } from "@/lib/integrations/inoti-ussd/parser";
import type {
  InotiCredentialProfile,
  InotiPaymentRecord,
  InotiPaymentVerificationQuery,
  InotiProviderReadiness,
  InotiVerificationResult,
  UssdProvider,
} from "@/lib/integrations/inoti-ussd/types";

const DEFAULT_ENDPOINT = "https://login.inoti.com/_services/ExternalUssdPay.asmx";
const DEFAULT_TIMEOUT_MS = 8_000;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function textValue(record: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(record);
  for (const name of names) {
    const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (match && match[1] !== null && match[1] !== undefined) return String(match[1]).trim();
  }
  return "";
}

function successValue(value: unknown) {
  if (value === true) return true;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true";
}

export function parseProviderRialAmount(value: unknown): bigint | null {
  const normalized = String(value ?? "").trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match || (match[2] && !/^0+$/.test(match[2]))) return null;
  try {
    const amount = BigInt(match[1] ?? "");
    return amount > BigInt(0) && amount <= BigInt("999999999999999999") ? amount : null;
  } catch {
    return null;
  }
}

function normalizeProviderRecord(raw: unknown): InotiPaymentRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const amountRial = parseProviderRialAmount(record.Price ?? record.price);
  const mobile = normalizeIranianMobile(textValue(record, ["Mobile"]));
  const sessionId = textValue(record, ["SessionID", "SessionId"]);
  const merchantFactorId = textValue(record, ["YourFactorID", "YourFactorId"]);
  const providerFactorId = textValue(record, ["iNotiFactorID", "InotiFactorID", "iNotiFactorId"]);
  const rrn = textValue(record, ["RRN"]);
  const result = textValue(record, ["Result", "Status"]);
  if (!amountRial || !mobile || !sessionId || !merchantFactorId || !providerFactorId || !rrn || !result) return null;
  return {
    amountRial,
    mobile,
    sessionId,
    merchantFactorId,
    providerFactorId,
    rrn,
    result,
    successful: successValue(record.Result ?? record.result ?? record.Status ?? record.status),
  };
}

function parseSoapRecords(xml: string): InotiPaymentRecord[] | null {
  const match = /<GetPaymentsResult[^>]*>([\s\S]*?)<\/GetPaymentsResult>/i.exec(xml);
  if (!match) return null;
  const decoded = decodeXml(match[1] ?? "").trim();
  if (!decoded || decoded.toLowerCase() === "null") return [];
  try {
    const moneySafeJson = decoded.replace(/("Price"\s*:\s*)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/gi, '$1"$2"');
    const parsed = JSON.parse(moneySafeJson) as unknown;
    const records = Array.isArray(parsed) ? parsed : [parsed];
    const normalized = records.map(normalizeProviderRecord);
    if (normalized.some((record) => !record)) return null;
    return normalized as InotiPaymentRecord[];
  } catch {
    return null;
  }
}

function recordMatchesQuery(record: InotiPaymentRecord, query: InotiPaymentVerificationQuery) {
  return record.successful &&
    record.sessionId === query.sessionId &&
    record.mobile === query.mobile &&
    record.amountRial === query.amountRial &&
    record.merchantFactorId === query.merchantFactorId &&
    record.providerFactorId === query.providerFactorId &&
    record.rrn === query.rrn;
}

export function selectVerifiedPaymentRecord(
  records: readonly InotiPaymentRecord[],
  query: InotiPaymentVerificationQuery,
): InotiVerificationResult {
  if (records.length === 0) return { ok: false, code: "NOT_FOUND" };
  const matches = records.filter((record) => recordMatchesQuery(record, query));
  if (matches.length === 1) return { ok: true, record: matches[0] };
  if (matches.length > 1) return { ok: false, code: "AMBIGUOUS_MATCH" };
  return { ok: false, code: "CORRELATION_MISMATCH" };
}

function timeoutFromEnvironment() {
  const parsed = Number(process.env.INOTI_USSD_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isInteger(parsed) && parsed >= 1_000 && parsed <= 30_000 ? parsed : DEFAULT_TIMEOUT_MS;
}

export class InotiUssdProvider implements UssdProvider {
  getReadiness(credentialProfile: InotiCredentialProfile | null): InotiProviderReadiness {
    if (!credentialProfile) {
      return { ready: false, transportSecure: true, code: "CREDENTIAL_PROFILE_NOT_CONFIGURED" };
    }
    const endpoint = credentialProfile.endpoint;
    let transportSecure = false;
    try {
      transportSecure = new URL(endpoint).protocol === "https:";
    } catch {
      transportSecure = false;
    }
    if (!transportSecure) {
      return { ready: false, transportSecure: false, code: "BLOCKED_INSECURE_PROVIDER_TRANSPORT" };
    }
    if (process.env.INOTI_USSD_LIVE_VERIFICATION_ENABLED !== "true") {
      return { ready: false, transportSecure: true, code: "CONFIG_DISABLED" };
    }
    if (!credentialProfile.username || !credentialProfile.password) {
      return { ready: false, transportSecure: true, code: "MISSING_CREDENTIALS" };
    }
    if (process.env.NODE_ENV === "production" && !process.env.INOTI_USSD_HASH_PEPPER) {
      return { ready: false, transportSecure: true, code: "MISSING_HASH_PEPPER" };
    }
    return { ready: true, transportSecure: true, code: "READY" };
  }

  async verifyPayment(
    credentialProfile: InotiCredentialProfile | null,
    query: InotiPaymentVerificationQuery,
  ): Promise<InotiVerificationResult> {
    const readiness = this.getReadiness(credentialProfile);
    if (!readiness.ready) return { ok: false, code: "NOT_READY" };

    const endpoint = credentialProfile!.endpoint;
    const fields: Record<string, string> = {
      Username: credentialProfile!.username,
      Password: credentialProfile!.password,
      CodeName: query.codeName,
      IsAll: "false",
      DateFrom: "",
      DateTo: "",
      SessionID: query.sessionId,
      PriceFrom: query.amountRial.toString(),
      PriceTo: query.amountRial.toString(),
      Mobile: query.mobile,
      RefKey: "",
      iNotiFactorID: query.providerFactorId,
      YourFactorID: query.merchantFactorId,
      RRN: query.rrn,
      NullResult: "",
    };
    const body = `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
      `<soap:Body><GetPayments xmlns="http://tempuri.org/">` +
      Object.entries(fields).map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`).join("") +
      `</GetPayments></soap:Body></soap:Envelope>`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutFromEnvironment());
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "text/xml; charset=utf-8",
          soapaction: '"http://tempuri.org/GetPayments"',
        },
        body,
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, code: "PROVIDER_ERROR" };
      const records = parseSoapRecords(await response.text());
      if (!records) return { ok: false, code: "MALFORMED_RESPONSE" };
      return selectVerifiedPaymentRecord(records, query);
    } catch (error) {
      return { ok: false, code: error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "PROVIDER_ERROR" };
    } finally {
      clearTimeout(timeout);
    }
  }

  async probeReadOnlyPayments(input: {
    credentialProfile: InotiCredentialProfile | null;
    codeName: string | null | undefined;
    merchantFactorId: string;
  }): Promise<{
    ok: boolean;
    code: "VERIFIED_READ_ONLY" | "NO_CREDENTIALS" | "NO_CODE_NAME" | "CODENAME_REJECTED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_VALIDATION_ERROR" | "CONTRACT_ERROR" | "AUTHENTICATION_FAILED" | "TIMEOUT";
  }> {
    const credentialProfile = input.credentialProfile;
    if (!credentialProfile?.username || !credentialProfile.password) return { ok: false, code: "NO_CREDENTIALS" };
    const codeName = input.codeName?.trim();
    if (!codeName) return { ok: false, code: "NO_CODE_NAME" };

    const endpoint = credentialProfile.endpoint;
    let transportSecure = false;
    try {
      transportSecure = new URL(endpoint).protocol === "https:";
    } catch {
      transportSecure = false;
    }
    if (!transportSecure) return { ok: false, code: "PROVIDER_UNAVAILABLE" };

    const fields: Record<string, string> = {
      Username: credentialProfile.username,
      Password: credentialProfile.password,
      CodeName: codeName,
      IsAll: "false",
      DateFrom: "",
      DateTo: "",
      SessionID: "",
      PriceFrom: "",
      PriceTo: "",
      Mobile: "",
      RefKey: "",
      iNotiFactorID: "",
      YourFactorID: input.merchantFactorId,
      RRN: "",
      NullResult: "",
    };
    const body = `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
      `<soap:Body><GetPayments xmlns="http://tempuri.org/">` +
      Object.entries(fields).map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`).join("") +
      `</GetPayments></soap:Body></soap:Envelope>`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutFromEnvironment());
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "text/xml; charset=utf-8",
          soapaction: '"http://tempuri.org/GetPayments"',
        },
        body,
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, code: response.status === 401 || response.status === 403 ? "AUTHENTICATION_FAILED" : "PROVIDER_UNAVAILABLE" };
      const text = await response.text();
      const records = parseSoapRecords(text);
      if (!records) {
        const normalized = text.toLowerCase();
        if (normalized.includes("yourfactorid error")) return { ok: false, code: "PROVIDER_VALIDATION_ERROR" };
        if (normalized.includes("codename") || normalized.includes("code name")) return { ok: false, code: "CODENAME_REJECTED" };
        if (normalized.includes("username") || normalized.includes("password") || normalized.includes("unauthorized")) return { ok: false, code: "AUTHENTICATION_FAILED" };
        return { ok: false, code: "CONTRACT_ERROR" };
      }
      return { ok: true, code: "VERIFIED_READ_ONLY" };
    } catch (error) {
      return { ok: false, code: error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "PROVIDER_UNAVAILABLE" };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const inotiUssdProvider = new InotiUssdProvider();

