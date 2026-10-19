import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementError, managementPrincipal, parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { inventoryAdjustmentSchema } from "@/lib/hotel/validation/management-contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    if (process.env.HOTEL_INVENTORY_IDEMPOTENCY_ENABLED !== "1") throw new ApiError(503, "Inventory idempotency is not enabled");
    const session = await requireAuthSession();
    const { id: organizationId, propertyId } = await params;
    if (session.user.role !== "SUPER_ADMIN" && session.user.organizationId !== organizationId) throw new ApiError(403, "Forbidden");
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key) throw new ApiError(400, "Idempotency-Key is required");
    const body = inventoryAdjustmentSchema.parse(parseJsonObject(await request.json()));
    const principal = managementPrincipal(session);
    const fingerprint = createHash("sha256").update(JSON.stringify({ organizationId, propertyId, body, actorUserId: principal.userId, operation: "HOTEL_INVENTORY_ADJUSTMENT" })).digest("hex");
    const inventory = await new HotelManagementService().adjustInventoryIdempotent(principal, { organizationId }, { ...body, propertyId, idempotencyKey: key, requestFingerprint: fingerprint });
    return NextResponse.json({ inventory });
  } catch (error) { return managementError(error); }
}
