import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementError, managementPrincipal, parseJsonObject } from "@/lib/hotel/management/api-adapter";
import { updateRoomTypeSchema } from "@/lib/hotel/validation/management-contracts";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string; roomTypeId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const { id: organizationId, propertyId, roomTypeId } = await params;
    const scopedRoomType = await prisma.hotelRoomType.findFirst({ where: { id: roomTypeId, propertyId, organizationId }, select: { id: true } });
    if (!scopedRoomType) throw new ApiError(404, "Room type not found");
    const body = updateRoomTypeSchema.parse(parseJsonObject(await request.json()));
    const roomType = await new HotelManagementService().updateRoomType(managementPrincipal(session), { organizationId }, roomTypeId, { ...body, beds: body.beds as Prisma.InputJsonValue | undefined });
    return NextResponse.json({ roomType });
  } catch (error) {
    return managementError(error);
  }
}
