import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelWebsiteContentAuthorizationError, HotelWebsiteContentValidationError } from "@/lib/hotel/content/hotel-website-content.service";
import { HotelWebsiteManagementConflictError, HotelWebsiteManagementNotFoundError } from "@/lib/hotel/content/hotel-website-management.service";
import { parseJsonObject } from "@/lib/hotel/management/api-adapter";

export type WebsiteManagementParams = { id: string; propertyId: string; revisionId?: string; publicationId?: string };
export type WebsiteManagementContext = {
  principal: { userId: string; role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF" | "DRIVER" | "CUSTOMER" | "GUEST"; organizationId?: string | null };
  scope: { organizationId: string; propertyId: string };
  idempotencyKey?: string;
};

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

function managementError(error: unknown) {
  if (error instanceof HotelWebsiteContentAuthorizationError) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
  if (error instanceof HotelWebsiteContentValidationError) return NextResponse.json({ error: "Invalid Hotel website request" }, { status: 422, headers: NO_STORE });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid Hotel website request" }, { status: 422, headers: NO_STORE });
  if (error instanceof HotelWebsiteManagementNotFoundError) return NextResponse.json({ error: "Hotel website resource not found" }, { status: 404, headers: NO_STORE });
  if (error instanceof HotelWebsiteManagementConflictError) return NextResponse.json({ error: "Hotel website state conflict" }, { status: 409, headers: NO_STORE });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002" || error.code === "P2034") return NextResponse.json({ error: "Hotel website state conflict" }, { status: 409, headers: NO_STORE });
    if (error.code === "P2025") return NextResponse.json({ error: "Hotel website resource not found" }, { status: 404, headers: NO_STORE });
  }
  const response = jsonError(error, "Hotel website request failed");
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function safeResponse(payload: unknown, status: number) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

export async function websiteRead(paramsPromise: Promise<WebsiteManagementParams>, handler: (context: WebsiteManagementContext, params: WebsiteManagementParams) => Promise<unknown>) {
  try {
    const session = await requireAuthSession();
    const params = await paramsPromise;
    const context: WebsiteManagementContext = { principal: { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId }, scope: { organizationId: params.id, propertyId: params.propertyId } };
    return safeResponse(await handler(context, params), 200);
  } catch (error) { return managementError(error); }
}

export async function websiteMutation(request: Request, paramsPromise: Promise<WebsiteManagementParams>, handler: (context: WebsiteManagementContext, params: WebsiteManagementParams, body: Record<string, unknown>) => Promise<unknown>, status = 200) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const params = await paramsPromise;
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key || key.length < 8 || key.length > 128) throw new ApiError(400, "A valid Idempotency-Key is required");
    let parsedBody: unknown;
    try { parsedBody = await request.json(); }
    catch { throw new ApiError(400, "A JSON request body is required"); }
    const body = parseJsonObject(parsedBody) as Record<string, unknown>;
    const context: WebsiteManagementContext = { principal: { userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId }, scope: { organizationId: params.id, propertyId: params.propertyId }, idempotencyKey: key };
    return safeResponse(await handler(context, params, body), status);
  } catch (error) { return managementError(error); }
}
