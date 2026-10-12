import { NextRequest } from "next/server";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementAction } from "@/lib/hotel/management/route-support";
export async function POST(request: NextRequest, { params }: { params: Promise<{ organizationId: string; propertyId: string }> }) { const { organizationId, propertyId } = await params; return managementAction(request, organizationId, async p => ({ property: await new HotelManagementService().archiveProperty(p, { organizationId }, propertyId) })); }
