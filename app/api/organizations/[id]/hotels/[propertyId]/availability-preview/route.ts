import { NextRequest } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import { HotelManagementService } from "@/lib/hotel/management/hotel-management.service";
import { managementAction } from "@/lib/hotel/management/route-support";

export const dynamic = "force-dynamic";

function dateOnly(value: string | null, name: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, `${name} must be a YYYY-MM-DD date`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ApiError(400, `${name} must be a valid calendar date`);
  return value;
}

function positiveCount(value: string | null, fallback: number, minimum: number, maximum: number, name: string) {
  if (value === null) return fallback;
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new ApiError(400, `${name} must be a whole number`);
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < minimum || count > maximum) throw new ApiError(400, `${name} is outside the supported range`);
  return count;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    const { id: organizationId, propertyId } = await params;
    const query = new URL(request.url).searchParams;
    const checkIn = dateOnly(query.get("checkIn"), "checkIn");
    const checkOut = dateOnly(query.get("checkOut"), "checkOut");
    const adults = positiveCount(query.get("adults"), 2, 1, 12, "adults");
    const children = positiveCount(query.get("children"), 0, 0, 8, "children");
    const agesText = query.get("childAges") ?? "";
    const childAges = agesText ? agesText.split(",").map((age) => positiveCount(age, 0, 0, 17, "childAges")) : [];
    if (childAges.length !== children) throw new ApiError(400, "childAges must contain one age for each child");
    const response = await managementAction(request, organizationId, (principal) => new HotelManagementService().previewAvailability(
      principal,
      { organizationId },
      propertyId,
      { propertyId, window: { checkIn, checkOut }, occupancy: { adults, children, childAges } },
    ));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const response = jsonError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
