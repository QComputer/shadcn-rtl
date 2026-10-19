import type { NextRequest } from "next/server";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { websiteRead, type WebsiteManagementParams } from "@/lib/hotel/content/hotel-website-management-api";

type Context = { params: Promise<WebsiteManagementParams> };
const service = new HotelWebsiteManagementService();

export function GET(_request: NextRequest, { params }: Context) {
  return websiteRead(params, ({ principal, scope }) => service.listAvailableMedia(principal, scope));
}
