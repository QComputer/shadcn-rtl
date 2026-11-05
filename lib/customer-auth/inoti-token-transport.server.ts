import "server-only";

import type { CustomerAuthSmsTransport } from "./sms-outbox.server";

const ENDPOINT = "https://restful.inoti.com/api/SMSAPI/SendSMS";
const DEFINITIVE_REJECTIONS = new Set([-1, -2, -4, -5, -6, -20, -21]);
const ACCEPTED_DELIVERY_STATES = new Set([1, 2, 4, 7]);
const DEFINITIVE_DELIVERY_FAILURES = new Set([3, 5, 6]);

type Fetcher = typeof fetch;
type SendResult = "REJECTED" | "RETRYABLE" | { status: "ACCEPTED"; providerMessageId: string };
type Options = {
  token: string;
  lineNo: string;
  /** Injected fetch is intended for controlled local tests. */
  fetcher?: Fetcher;
  /** Must be set by the production composition root in addition to live env gates. */
  allowNetwork?: boolean;
};
type SendInput = { phone: string; url: string; idempotencyKey: string; signal: AbortSignal; organizationName?: string };

/** Dedicated authentication transport. ACCEPTED is provider queue acceptance, not handset delivery. */
export class InotiTokenSmsTransport implements CustomerAuthSmsTransport {
  readonly reviewedForAuthentication = true as const;
  private readonly token: string;
  private readonly lineNo: string;
  private readonly fetcher?: Fetcher;
  private readonly allowNetwork: boolean;

  constructor(options: Options) {
    this.token = options.token;
    this.lineNo = options.lineNo;
    this.fetcher = options.fetcher;
    this.allowNetwork = options.allowNetwork === true;
  }

  available(): boolean {
    return validConfiguration(this.token, this.lineNo) &&
      (this.fetcher !== undefined || (this.allowNetwork && liveGatesOpen()));
  }

  async send(input: SendInput): Promise<SendResult> {
    if (!this.available()) return "REJECTED";
    if (!/^09\d{9}$/.test(input.phone) || !validAuthUrl(input.url)) return "REJECTED";
    const fetcher = this.fetcher ?? (this.allowNetwork && liveGatesOpen() ? globalThis.fetch : undefined);
    if (!fetcher) return "REJECTED";

    const message = makeMessage(input.organizationName, input.url);
    const endpoint = new URL(ENDPOINT);
    endpoint.searchParams.set("Token", this.token);
    endpoint.searchParams.set("LineNo", this.lineNo);
    endpoint.searchParams.set("MobileNumbers", input.phone);
    endpoint.searchParams.set("Message", message);

    let response: Response;
    try {
      response = await fetcher(endpoint, {
        method: "GET",
        cache: "no-store",
        redirect: "error",
        signal: input.signal,
        headers: { accept: "application/json" },
      });
    } catch {
      throw new Error("INOTI_SEND_UNCERTAIN");
    }
    let responseOrigin: string | null = null;
    try { if (response.url) responseOrigin = new URL(response.url).origin; } catch { throw new Error("INOTI_SEND_UNCERTAIN"); }
    if (!response.ok || response.redirected || (responseOrigin && responseOrigin !== new URL(ENDPOINT).origin)) {
      throw new Error("INOTI_SEND_UNCERTAIN");
    }

    let payload: unknown;
    try { payload = await response.json(); } catch { throw new Error("INOTI_SEND_UNCERTAIN"); }
    if (!isRecord(payload) || !Number.isInteger(payload.ResultCode)) throw new Error("INOTI_SEND_UNCERTAIN");
    if (DEFINITIVE_REJECTIONS.has(payload.ResultCode as number)) return "REJECTED";
    if (payload.ResultCode !== 1 || !validBatchId(payload.BatchID)) throw new Error("INOTI_SEND_UNCERTAIN");

    const deliveries = payload.deliveryLists;
    if (!Array.isArray(deliveries) || deliveries.length !== 1 || !isRecord(deliveries[0])) throw new Error("INOTI_SEND_UNCERTAIN");
    const delivery = deliveries[0];
    if (delivery.Mobile !== input.phone || !Number.isInteger(delivery.Status) ||
      (!ACCEPTED_DELIVERY_STATES.has(delivery.Status as number) && !DEFINITIVE_DELIVERY_FAILURES.has(delivery.Status as number))) {
      throw new Error("INOTI_SEND_UNCERTAIN");
    }
    if (DEFINITIVE_DELIVERY_FAILURES.has(delivery.Status as number)) return "REJECTED";
    // ACCEPTED means the provider accepted the batch; it does not mean handset delivery.
    return { status: "ACCEPTED", providerMessageId: String(payload.BatchID) };
  }
}

function validConfiguration(token: string, lineNo: string): boolean {
  return token.length > 0 && token.length <= 2048 && !/[\u0000-\u0020\u007f]/.test(token) &&
    /^(?:0|[1-9]\d{0,19})$/.test(lineNo);
}

function liveGatesOpen(): boolean {
  return process.env.INOTI_ALLOW_LIVE_SMS === "true" &&
    process.env.INOTI_RUNTIME_MUTATIONS_APPROVED === "true" &&
    process.env.CUSTOMER_PHONE_AUTH_ENABLED === "1";
}

function validAuthUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const localHttp = process.env.NODE_ENV !== "production" && url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".localhost"));
    const path = url.pathname.replace(/\/$/, "");
    const expectedPath = /^(?:\/app)?\/(?:fa|en|ar)\/login\/phone$/;
    const organization = url.searchParams.getAll("organization");
    const fragment = url.hash.slice(1);
    return (url.protocol === "https:" || localHttp) && !url.username && !url.password && (!url.port || localHttp) &&
      expectedPath.test(path) && url.searchParams.size === 1 && organization.length === 1 &&
      organization[0].length > 0 && organization[0].length <= 128 &&
      /^token=[A-Za-z0-9_-]{43}$/.test(fragment);
  } catch { return false; }
}

function validBatchId(value: unknown): boolean {
  return (typeof value === "string" && /^[1-9]\d{0,19}$/.test(value)) ||
    (typeof value === "number" && Number.isSafeInteger(value) && value > 0);
}

function makeMessage(organizationName: string | undefined, url: string): string {
  const name = (organizationName ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${name ? `${name} | ` : ""}برای ورود امن به حساب خود، این پیوند را باز کنید: ${url}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
