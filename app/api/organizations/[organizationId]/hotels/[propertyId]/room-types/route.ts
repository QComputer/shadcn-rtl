import { NextRequest, NextResponse } from "next/server";
import { requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementError, managementPrincipal, parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { createRoomTypeSchema } from "@/lib/hotel/validation/management-contracts";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest, { params }: { params: Promise<{ organizationId: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const { organizationId, propertyId } = await params;
    const body = createRoomTypeSchema.parse(parseJsonObject(await request.json()));
    const roomType = await new HotelManagementService().createRoomType(managementPrincipal(session), { organizationId }, { ...body, propertyId, beds: body.beds as Prisma.InputJsonValue });
    return NextResponse.json({ roomType }, { status: 201 });
  } catch (error) {
    return managementError(error);
  }
}
