import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementAction } from "@/lib/hotel/management/route-support";
export async function POST(request: NextRequest, { params }: { params: Promise<{ organizationId: string; propertyId: string; roomId: string }> }) { const { organizationId, propertyId, roomId } = await params; return managementAction(request, organizationId, async p => { const row = await prisma.hotelRoom.findFirst({ where: { id: roomId, propertyId, organizationId }, select: { id: true } }); if (!row) throw new ApiError(404, "Room not found"); return { room: await new HotelManagementService().archivePhysicalRoom(p, { organizationId }, roomId) }; }); }
