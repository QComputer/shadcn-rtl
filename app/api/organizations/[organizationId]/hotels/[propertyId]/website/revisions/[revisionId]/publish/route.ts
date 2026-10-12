import type { NextRequest } from "next/server";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { websiteMutation, type WebsiteManagementParams } from "@/lib/hotel/content/hotel-website-management-api";

type Context = { params: Promise<WebsiteManagementParams> };
const service = new HotelWebsiteManagementService();

export function POST(request: NextRequest, { params }: Context) {
  return websiteMutation(request, params, ({ principal, scope, idempotencyKey }, route) => service.publish(principal, scope, route.revisionId!, idempotencyKey!));
}
