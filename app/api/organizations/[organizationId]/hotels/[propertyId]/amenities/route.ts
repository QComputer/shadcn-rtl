import { NextRequest } from "next/server";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { createAmenitySchema } from "@/lib/hotel/validation/management-contracts";
export async function POST(request: NextRequest, { params }: { params: Promise<{ organizationId: string; propertyId: string }> }) { const { organizationId, propertyId } = await params; return managementRequest(request, organizationId, createAmenitySchema, async (p, body) => ({ amenity: await new HotelManagementService().createAmenity(p, { organizationId }, { ...body, propertyId }) }), 201); }
