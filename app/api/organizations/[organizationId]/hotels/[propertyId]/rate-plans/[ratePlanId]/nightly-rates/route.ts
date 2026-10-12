import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { nightlyRateSchema } from "@/lib/hotel/validation/management-contracts";
export async function PUT(request: NextRequest, { params }: { params: Promise<{ organizationId: string; propertyId: string; ratePlanId: string }> }) { const { organizationId, propertyId, ratePlanId } = await params; return managementRequest(request, organizationId, nightlyRateSchema, async (p, body) => { const row = await prisma.hotelRatePlan.findFirst({ where: { id: ratePlanId, propertyId, organizationId }, select: { id: true } }); if (!row) throw new ApiError(404, "Rate plan not found"); return { nightlyRate: await new HotelManagementService().upsertNightlyRate(p, { organizationId }, { ...body, ratePlanId }) }; }); }
