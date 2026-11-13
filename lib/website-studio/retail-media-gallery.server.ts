import "server-only";
import { ApiError } from "@/lib/api-guards";

export const RETAIL_MEDIA_PAGE_SIZE = 24;
const MAX_SEARCH_LENGTH = 100;

type GalleryCursor = { createdAt: string; id: string };

function encodeCursor(cursor: GalleryCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string | null): GalleryCursor | null {
  if (!value) return null;
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new ApiError(400, "نشانگر صفحه معتبر نیست.");
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<GalleryCursor>;
    if (typeof decoded.createdAt !== "string" || !Number.isFinite(Date.parse(decoded.createdAt)) ||
        typeof decoded.id !== "string" || decoded.id.length < 1 || decoded.id.length > 128) {
      throw new Error("invalid cursor");
    }
    return { createdAt: new Date(decoded.createdAt).toISOString(), id: decoded.id };
  } catch {
    throw new ApiError(400, "نشانگر صفحه معتبر نیست.");
  }
}

export function parseRetailMediaGalleryRequest(requestUrl: string) {
  const url = new URL(requestUrl);
  const rawSearch = url.searchParams.get("q") ?? "";
  if (rawSearch.length > MAX_SEARCH_LENGTH) throw new ApiError(400, "عبارت جست‌وجو بیش از حد طولانی است.");
  const search = rawSearch.trim();
  return { search, cursor: decodeCursor(url.searchParams.get("cursor")) };
}

export function retailMediaGalleryWhere(organizationId: string, search: string, cursor: GalleryCursor | null) {
  return {
    organizationId,
    access: "PUBLIC" as const,
    mimeType: { in: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
    ...(search ? { filename: { contains: search, mode: "insensitive" as const } } : {}),
    ...(cursor ? { OR: [
      { createdAt: { lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), id: { gt: cursor.id } },
    ] } : {}),
  };
}

export function retailMediaGalleryResponse<T extends { id: string; createdAt: Date }>(rows: T[]) {
  const hasMore = rows.length > RETAIL_MEDIA_PAGE_SIZE;
  const page = rows.slice(0, RETAIL_MEDIA_PAGE_SIZE);
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null,
  };
}
