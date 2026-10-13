import type { NextRequest } from "next/server";
import { hotelWebsiteRevokeSchema } from "@/lib/hotel/content/hotel-website-management-contract";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { websiteMutation, type WebsiteManagementParams } from "@/lib/hotel/content/hotel-website-management-api";

const service = new HotelWebsiteManagementService();

export function POST(request: NextRequest, { params }: { params: Promise<WebsiteManagementParams> }) {
  return websiteMutation(request, params, ({ principal, scope, idempotencyKey }, route, body) => {
    const { reason } = hotelWebsiteRevokeSchema.parse(body);
    return service.revoke(principal, scope, route.publicationId!, reason, idempotencyKey!);
  });
}
