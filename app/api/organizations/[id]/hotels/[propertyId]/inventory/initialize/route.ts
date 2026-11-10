import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { z } from "zod";

const initializationSchema = z.object({ roomTypeId: z.string().trim().min(1).max(128), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), allotment: z.number().int().safe().min(0), reason: z.string().trim().min(1).max(500) }).strict();
function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ApiError(400, "from and to must be valid calendar dates");
  return date;
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  const { id: organizationId, propertyId } = await params;
  return managementRequest(request, organizationId, initializationSchema, async (principal, body) => {
    if (process.env.HOTEL_INVENTORY_IDEMPOTENCY_ENABLED !== "1") throw new ApiError(503, "Inventory idempotency is not enabled");
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) throw new ApiError(400, "Idempotency-Key is required");
    const from = dateOnly(body.from); const to = dateOnly(body.to);
    const requestFingerprint = createHash("sha256").update(JSON.stringify({ organizationId, propertyId, ...body, actorUserId: principal.userId, operation: "HOTEL_INVENTORY_INITIALIZE" })).digest("hex");
    const inventoryInitialization = await new HotelManagementService().initializeInventoryIdempotent(principal, { organizationId }, { ...body, propertyId, from, to, idempotencyKey, requestFingerprint });
    return { inventoryInitialization };
  }, 201);
}
