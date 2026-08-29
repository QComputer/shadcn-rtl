import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api-guards";

export const PUBLIC_CATALOG_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

const publicHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
  "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL,
  Vary: "Accept-Encoding",
} as const;

export function publicCatalogResponse(request: NextRequest, payload: unknown, options: { head?: boolean } = {}) {
  const body = JSON.stringify({ version: "v1", data: payload });
  const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
  const headers = { ...publicHeaders, ETag: etag, "Content-Type": "application/json; charset=utf-8" };
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(options.head ? null : body, { status: 200, headers });
}

export function publicCatalogError(error: unknown) {
  const status = error instanceof ApiError ? error.status : error instanceof Error && error.name === "ZodError" ? 400 : 500;
  const message = status === 500 ? "Internal server error" : error instanceof Error ? error.message : "Invalid request";
  return NextResponse.json({ version: "v1", error: { code: status === 404 ? "NOT_FOUND" : status === 400 ? "INVALID_REQUEST" : "INTERNAL_ERROR", message } }, {
    status,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD", "Cache-Control": "no-store" },
  });
}
