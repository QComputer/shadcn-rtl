import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { performance } from "node:perf_hooks";

export type InotiDiagnosticCode =
  | "RESOLVED"
  | "DNS_ERROR"
  | "TCP_CONNECTED"
  | "TCP_TIMEOUT"
  | "TCP_REFUSED"
  | "TCP_ERROR"
  | "TLS_SUCCEEDED"
  | "TLS_ERROR"
  | "HTTP_RESPONDED"
  | "HTTP_4XX"
  | "HTTP_5XX"
  | "REQUEST_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "AUTH_FAILED"
  | "CODENAME_REJECTED"
  | "SOAP_CONTRACT_ERROR"
  | "PROVIDER_VALIDATION_ERROR"
  | "PROVIDER_RESPONSE_TIMEOUT"
  | "NO_SMS_TOKEN"
  | "NO_CREDENTIALS"
  | "NO_CODE_NAME"
  | "NOT_TESTED"
  | "VERIFIED_READ_ONLY";

export type LatencyBucket = "FAST" | "NORMAL" | "SLOW" | "TIMEOUT";

export function latencyBucket(durationMs: number): LatencyBucket {
  if (durationMs >= 8_000) return "TIMEOUT";
  if (durationMs >= 3_000) return "SLOW";
  if (durationMs >= 1_000) return "NORMAL";
  return "FAST";
}

export function classifyFetchError(error: unknown): InotiDiagnosticCode {
  if (error instanceof Error && error.name === "AbortError") return "REQUEST_TIMEOUT";
  return "PROVIDER_UNAVAILABLE";
}

export function classifyProviderTimeout(input: {
  providerCode: string;
  dns: InotiDiagnosticCode;
  tcp: InotiDiagnosticCode;
  tls: InotiDiagnosticCode;
}): InotiDiagnosticCode {
  if (input.providerCode !== "TIMEOUT") return input.providerCode as InotiDiagnosticCode;
  if (input.dns !== "RESOLVED") return "DNS_ERROR";
  if (input.tcp !== "TCP_CONNECTED") return input.tcp;
  if (input.tls !== "TLS_SUCCEEDED") return "TLS_ERROR";
  return "PROVIDER_RESPONSE_TIMEOUT";
}

export function secretDiagnostics(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return {
      present: false,
      nonEmpty: false,
      length: 0,
      trimmedEqualsOriginal: true,
      containsWhitespace: false,
    };
  }
  const trimmed = value.trim();
  return {
    present: true,
    nonEmpty: trimmed.length > 0,
    length: value.length,
    trimmedEqualsOriginal: value === trimmed,
    containsWhitespace: /\s/.test(value),
  };
}

export async function diagnoseDns(hostname: string) {
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    return {
      code: addresses.length > 0 ? "RESOLVED" as const : "DNS_ERROR" as const,
      families: Array.from(new Set(addresses.map((address) => `IPv${address.family}`))).sort(),
    };
  } catch {
    return { code: "DNS_ERROR" as const, families: [] as string[] };
  }
}

export async function diagnoseTcp(hostname: string, port = 443, timeoutMs = 10_000) {
  const start = performance.now();
  return new Promise<{ code: InotiDiagnosticCode; durationMs: number }>((resolve) => {
    const socket = net.connect({ host: hostname, port });
    let settled = false;
    const finish = (code: InotiDiagnosticCode) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ code, durationMs: Math.round(performance.now() - start) });
    };
    socket.setTimeout(timeoutMs, () => finish("TCP_TIMEOUT"));
    socket.once("connect", () => finish("TCP_CONNECTED"));
    socket.once("error", (error: NodeJS.ErrnoException) => {
      finish(error.code === "ECONNREFUSED" ? "TCP_REFUSED" : "TCP_ERROR");
    });
  });
}

export async function diagnoseTls(hostname: string, port = 443, timeoutMs = 10_000) {
  const start = performance.now();
  return new Promise<{ code: InotiDiagnosticCode; durationMs: number; protocol: string | null; authorized: boolean }>((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      rejectUnauthorized: true,
      timeout: timeoutMs,
    });
    let settled = false;
    const finish = (code: InotiDiagnosticCode) => {
      if (settled) return;
      settled = true;
      const protocol = socket.getProtocol();
      const authorized = socket.authorized;
      socket.destroy();
      resolve({ code, durationMs: Math.round(performance.now() - start), protocol, authorized });
    };
    socket.once("secureConnect", () => finish("TLS_SUCCEEDED"));
    socket.once("timeout", () => finish("TLS_ERROR"));
    socket.once("error", () => finish("TLS_ERROR"));
  });
}

export async function diagnoseHttp(url: string, timeoutMs = 15_000) {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    const code = response.status >= 500
      ? "HTTP_5XX"
      : response.status >= 400
        ? "HTTP_4XX"
        : "HTTP_RESPONDED";
    return {
      code,
      status: response.status,
      durationMs: Math.round(performance.now() - start),
      contentType: response.headers.get("content-type"),
    };
  } catch (error) {
    return {
      code: classifyFetchError(error),
      status: null,
      durationMs: Math.round(performance.now() - start),
      contentType: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
