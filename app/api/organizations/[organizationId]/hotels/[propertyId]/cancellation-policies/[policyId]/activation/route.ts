import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementRequest } from "@/lib/hotel/management/route-support";
import { activationSchema } from "@/lib/hotel/validation/management-contracts";
export async function POST(request: NextRequest, { params }: { params: Promise<{ organizationId: string; propertyId: string; policyId: string }> }) { const { organizationId, propertyId, policyId } = await params; return managementRequest(request, organizationId, activationSchema, async (p, body) => { const row = await prisma.hotelCancellationPolicy.findFirst({ where: { id: policyId, propertyId, organizationId }, select: { id: true } }); if (!row) throw new ApiError(404, "Cancellation policy not found"); return { policy: await new HotelManagementService().setCancellationPolicyActive(p, { organizationId }, policyId, body.isActive) }; }); }
