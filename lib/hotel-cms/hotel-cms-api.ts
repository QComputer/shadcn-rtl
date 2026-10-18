/** Authenticated browser adapter for the committed C1B1 management routes.
 * The platform SERVER must establish scope and authorization before rendering this UI.
 * Never use this module to derive tenant authority from editable browser state.
 */
import type { HotelWebsiteContent, HotelWebsiteMediaAssociationInput } from "@/lib/hotel/content/hotel-website-contract";

export type HotelCmsLocale = "fa" | "en" | "ar";
export type HotelCmsRevisionStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
export type HotelCmsScope = Readonly<{ organizationId: string; propertyId: string }>;
export type HotelCmsMedia = HotelWebsiteMediaAssociationInput;
export type HotelCmsDraft = { content: HotelWebsiteContent; media: HotelCmsMedia[] };
export type HotelCmsRevision = {
  revisionId: string;
  pageId: string;
  revisionNumber: number;
  status: HotelCmsRevisionStatus;
  content: HotelWebsiteContent;
  contentSha256: string;
  createdAt: string;
  reviews: Array<{ action: string; note: string | null; createdAt: string; actorUserId: string }>;
  publications: Array<{ id: string; publishedAt: string; revokedAt: string | null; revocationReason: string | null }>;
};
export type HotelCmsPreview = {
  mode: "PREVIEW";
  locale: HotelCmsLocale;
  revisionId: string;
  revisionNumber: number;
  status: HotelCmsRevisionStatus;
  pageKey: string;
  content: HotelWebsiteContent;
  media: Array<{ imageId: string; src: string; scope: "PROPERTY" | "ROOM_CATEGORY"; roomTypeId: string | null; slot: string; sortOrder: number; altText: Record<string, string> }>;
};
export type HotelCmsAvailableMedia = { imageId: string; src: string; filename: string; mimeType: string; createdAt: string };
export type HotelCmsHistory = {
  reviews: Array<{ id: string; pageId: string; revisionId: string; action: string; note: string | null; actorUserId: string; createdAt: string }>;
  publications: Array<{ id: string; pageId: string; revisionId: string; publishedAt: string; publishedByUserId: string; revokedAt: string | null; revokedByUserId: string | null; revocationReason: string | null }>;
};
export type HotelCmsMutation<T> = { result: T; replayed: boolean };
export type HotelCmsWriteResult = { revisionId: string; status: HotelCmsRevisionStatus; reviewId: string };
export type HotelCmsPublishResult = { publicationId: string; revisionId: string; publishedAt: string };
export type HotelCmsRevokeResult = { publicationId: string; revisionId: string; revoked: boolean };
export type HotelCmsCreateResult = { id: string; pageId: string; revisionNumber: number; status: "DRAFT"; contentSha256: string; createdAt: string; mediaCount: number };

export class HotelCmsRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; this.name = "HotelCmsRequestError"; }
}

const errorMessages: Record<number, string> = {
  400: "درخواست معتبر نیست. اطلاعات فرم را بررسی کنید.",
  401: "نشست شما پایان یافته است. دوباره وارد حساب شوید.",
  403: "برای انجام این کار دسترسی ندارید یا وب‌سایت هتل غیرفعال است.",
  404: "این نسخه یا هتل پیدا نشد.",
  409: "این محتوا هم‌زمان تغییر کرده یا درخواست قبلاً انجام شده است. فهرست را تازه کنید.",
  422: "اطلاعات واردشده با قوانین ثبت محتوا سازگار نیست.",
};

function assertScope(scope: HotelCmsScope): string {
  if (!scope.organizationId?.trim() || !scope.propertyId?.trim()) throw new Error("Trusted Hotel scope is required");
  return `/api/organizations/${encodeURIComponent(scope.organizationId)}/hotels/${encodeURIComponent(scope.propertyId)}/website`;
}
function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Unexpected Hotel CMS response");
  return value as Record<string, unknown>;
}
function isContent(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const content = value as Record<string, unknown>;
  return Boolean(content.title && content.hero && content.introduction && Array.isArray(content.sections) && content.contact);
}
function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Unexpected Hotel CMS list response");
  return value;
}
function newKey(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error("Secure request identifier is unavailable");
  return `cms-${globalThis.crypto.randomUUID()}`;
}

/** Same payload and operation reuse the key after transport errors; a confirmed
 * HTTP response clears it. Keys are per client instance and never persisted. */
export function createHotelCmsApi(
  scope: HotelCmsScope,
  deps: { fetchImpl?: typeof fetch; keyFactory?: () => string } = {},
) {
  const base = assertScope(scope);
  const doFetch = deps.fetchImpl ?? fetch;
  const keyFactory = deps.keyFactory ?? newKey;
  const pending = new Map<string, string>();

  async function request<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
    const method = options.method ?? "GET";
    const fingerprint = `${method}|${path}|${JSON.stringify(options.body ?? null)}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      const key = pending.get(fingerprint) ?? keyFactory();
      if (key.length < 8 || key.length > 128) throw new Error("Invalid generated idempotency key");
      pending.set(fingerprint, key);
      headers["Idempotency-Key"] = key;
    }
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method,
        headers,
        body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
        credentials: "same-origin",
        cache: "no-store",
        signal: options.signal,
      });
    } catch (error) {
      // Transport failures are ambiguous: retain the original key for retry.
      throw error;
    }
    if (!response.ok) throw new HotelCmsRequestError(response.status, errorMessages[response.status] ?? "ارتباط با بخش مدیریت هتل با مشکل روبه‌رو شد.");
    const payload: unknown = await response.json();
    // Keep the key until a successful response body is readable. A lost or
    // malformed response can follow a committed server transaction, so the
    // next identical request must retain the actor-bound idempotency key.
    if (method === "POST") pending.delete(fingerprint);
    return payload as T;
  }

  return {
    listAvailableMedia: async (signal?: AbortSignal): Promise<HotelCmsAvailableMedia[]> => {
      const data = await request<unknown>("/media", { signal });
      return asArray(data).map((item) => {
        const row = asObject(item);
        if (typeof row.imageId !== "string" || typeof row.src !== "string" || typeof row.filename !== "string" || typeof row.mimeType !== "string" || typeof row.createdAt !== "string") throw new Error("Invalid approved media response");
        return row as HotelCmsAvailableMedia;
      });
    },
    listRevisions: async (signal?: AbortSignal): Promise<HotelCmsRevision[]> => {
      const data = await request<unknown>("/revisions", { signal });
      return asArray(data).map((item) => {
        const row = asObject(item);
        if (typeof row.revisionId !== "string" || typeof row.revisionNumber !== "number" || typeof row.status !== "string" || !["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"].includes(row.status) || !isContent(row.content) || !Array.isArray(row.reviews) || !Array.isArray(row.publications)) throw new Error("Invalid revision response");
        return item as HotelCmsRevision;
      });
    },
    createDraft: (draft: HotelCmsDraft) => request<HotelCmsMutation<HotelCmsCreateResult>>("/revisions", { method: "POST", body: draft }),
    preview: async (revisionId: string, locale: HotelCmsLocale, signal?: AbortSignal): Promise<HotelCmsPreview> => {
      const data = asObject(await request<unknown>(`/revisions/${encodeURIComponent(revisionId)}/preview?locale=${locale}`, { signal }));
      if (data.mode !== "PREVIEW" || data.revisionId !== revisionId || data.locale !== locale || !Array.isArray(data.media) || !isContent(data.content)) throw new Error("Invalid preview response");
      return data as HotelCmsPreview;
    },
    submit: (revisionId: string, note?: string) => request<HotelCmsMutation<HotelCmsWriteResult>>(`/revisions/${encodeURIComponent(revisionId)}/submit`, { method: "POST", body: note ? { note } : {} }),
    decide: (revisionId: string, decision: "APPROVED" | "REJECTED", note?: string) => request<HotelCmsMutation<HotelCmsWriteResult>>(`/revisions/${encodeURIComponent(revisionId)}/review`, { method: "POST", body: { decision, ...(note ? { note } : {}) } }),
    publish: (revisionId: string) => request<HotelCmsMutation<HotelCmsPublishResult>>(`/revisions/${encodeURIComponent(revisionId)}/publish`, { method: "POST", body: {} }),
    revoke: (publicationId: string, reason?: string) => request<HotelCmsMutation<HotelCmsRevokeResult>>(`/publications/${encodeURIComponent(publicationId)}/revoke`, { method: "POST", body: reason ? { reason } : {} }),
    history: async (signal?: AbortSignal): Promise<HotelCmsHistory> => {
      const data = asObject(await request<unknown>("/history", { signal }));
      if (!Array.isArray(data.reviews) || !Array.isArray(data.publications)) throw new Error("Invalid content history response");
      return data as HotelCmsHistory;
    },
  };
}
