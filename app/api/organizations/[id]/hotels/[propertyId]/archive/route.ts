import { NextRequest } from "next/server";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementAction } from "@/lib/hotel/management/route-support";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) { const { id: organizationId, propertyId } = await params; return managementAction(request, organizationId, async p => ({ property: await new HotelManagementService().archiveProperty(p, { organizationId }, propertyId) })); }
