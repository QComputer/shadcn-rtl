import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireRole, requireSameOriginMutation } from "@/lib/api-guards";
import { activateHotelBookingCapability, HotelBookingCapabilityActivationError } from "@/lib/hotel/management/hotel-booking-capability-activation.service";

const bodySchema = z.object({ organizationSlug: z.string().min(1).max(100), propertyId: z.string().cuid() }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ organizationId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireSameOriginMutation(request);
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    if (!/^[a-z0-9]{20,32}$/.test(organizationId)) throw new ApiError(400, "Invalid organization ID");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Confirm the exact Hotel organization and active property");
    const result = await activateHotelBookingCapability({ actorUserId: session.user.id, organizationId, expectedOrganizationSlug: parsed.data.organizationSlug, expectedPropertyId: parsed.data.propertyId });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = error instanceof HotelBookingCapabilityActivationError
      ? NextResponse.json({ error: error.message }, { status: error.status })
      : jsonError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
