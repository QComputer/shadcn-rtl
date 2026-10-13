import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { updateAmenitySchema } from "@/lib/hotel/validation/management-contracts";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string; amenityId: string }> }) { const { id: organizationId, propertyId, amenityId } = await params; return managementRequest(request, organizationId, updateAmenitySchema, async (p, body) => { const row = await prisma.hotelAmenity.findFirst({ where: { id: amenityId, propertyId, organizationId }, select: { id: true } }); if (!row) throw new ApiError(404, "Amenity not found"); return { amenity: await new HotelManagementService().updateAmenity(p, { organizationId }, amenityId, body) }; }); }
