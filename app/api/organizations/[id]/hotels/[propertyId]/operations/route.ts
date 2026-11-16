import { NextRequest, NextResponse } from "next/server";
import { ApiError, requireAuthSession } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementError, managementPrincipal } from "@/lib/hotel/management/api-adapter";

function dateOnly(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, "from and to must be YYYY-MM-DD dates");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ApiError(400, "from and to must be valid calendar dates");
  return date;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id: organizationId, propertyId } = await params;
    const query = new URL(request.url).searchParams;
    const result = await new HotelManagementService().getOperations(managementPrincipal(session), { organizationId }, propertyId, { from: dateOnly(query.get("from")), to: dateOnly(query.get("to")) });
    return NextResponse.json(result);
  } catch (error) { return managementError(error); }
}
