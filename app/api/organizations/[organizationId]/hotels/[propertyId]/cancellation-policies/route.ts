import { NextRequest } from "next/server";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { createCancellationPolicySchema } from "@/lib/hotel/validation/management-contracts";
export async function POST(request: NextRequest, { params }: { params: Promise<{ organizationId: string; propertyId: string }> }) { const { organizationId, propertyId } = await params; return managementRequest(request, organizationId, createCancellationPolicySchema, async (p, body) => ({ policy: await new HotelManagementService().createCancellationPolicy(p, { organizationId }, { ...body, propertyId }) }), 201); }
