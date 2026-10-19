import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { createRatePlanSchema } from "@/lib/hotel/validation/management-contracts";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) { const { id: organizationId, propertyId } = await params; return managementRequest(request, organizationId, createRatePlanSchema, async (p, body) => { if (body.baseNightlyRate === undefined) throw new ApiError(422, "baseNightlyRate is required"); return { ratePlan: await new HotelManagementService().createRatePlan(p, { organizationId }, { ...body, propertyId, baseNightlyRate: body.baseNightlyRate }) }; }, 201); }
