import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { roomTypeAmenitiesSchema } from "@/lib/hotel/validation/management-contracts";
export async function PUT(request: NextRequest, { params }: { params: Promise<{ organizationId: string; propertyId: string; roomTypeId: string }> }) { const { organizationId, propertyId, roomTypeId } = await params; return managementRequest(request, organizationId, roomTypeAmenitiesSchema, async (p, body) => { const row = await prisma.hotelRoomType.findFirst({ where: { id: roomTypeId, propertyId, organizationId }, select: { id: true } }); if (!row) throw new ApiError(404, "Room type not found"); return { amenities: await new HotelManagementService().setRoomTypeAmenities(p, { organizationId }, roomTypeId, body.amenityIds) }; }); }
