import type { NextRequest } from "next/server";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { websiteRead, type WebsiteManagementParams } from "@/lib/hotel/content/hotel-website-management-api";

const service = new HotelWebsiteManagementService();

export function GET(_request: NextRequest, { params }: { params: Promise<WebsiteManagementParams> }) {
  return websiteRead(params, ({ principal, scope }) => service.history(principal, scope));
}
