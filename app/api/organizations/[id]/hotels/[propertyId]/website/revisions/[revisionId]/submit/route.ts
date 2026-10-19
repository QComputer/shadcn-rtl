import type { NextRequest } from "next/server";
import { hotelWebsiteReviewNoteSchema } from "@/lib/hotel/content/hotel-website-management-contract";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { websiteMutation, type WebsiteManagementParams } from "@/lib/hotel/content/hotel-website-management-api";

type Context = { params: Promise<WebsiteManagementParams> };
const service = new HotelWebsiteManagementService();

export function POST(request: NextRequest, { params }: Context) {
  return websiteMutation(request, params, ({ principal, scope, idempotencyKey }, route, body) => {
    const { note } = hotelWebsiteReviewNoteSchema.parse(body);
    return service.submit(principal, scope, route.revisionId!, note, idempotencyKey!);
  });
}
