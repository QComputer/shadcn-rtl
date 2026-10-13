import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementAction } from "@/lib/hotel/management/route-support";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string; roomTypeId: string }> }) { const { id: organizationId, propertyId, roomTypeId } = await params; return managementAction(request, organizationId, async p => { const row = await prisma.hotelRoomType.findFirst({ where: { id: roomTypeId, propertyId, organizationId }, select: { id: true } }); if (!row) throw new ApiError(404, "Room type not found"); return { roomType: await new HotelManagementService().archiveRoomType(p, { organizationId }, roomTypeId) }; }); }
