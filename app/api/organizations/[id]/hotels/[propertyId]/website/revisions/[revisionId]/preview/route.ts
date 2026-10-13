import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-guards";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { websiteRead, type WebsiteManagementParams } from "@/lib/hotel/content/hotel-website-management-api";

type Context = { params: Promise<WebsiteManagementParams> };
const service = new HotelWebsiteManagementService();

export function GET(request: NextRequest, { params }: Context) {
  return websiteRead(params, async ({ principal, scope }, route) => {
    const locale = request.nextUrl.searchParams.get("locale") ?? "fa";
    if (locale !== "fa" && locale !== "en" && locale !== "ar") throw new ApiError(400, "Unsupported locale");
    return service.preview(principal, scope, route.revisionId!, locale);
  });
}
