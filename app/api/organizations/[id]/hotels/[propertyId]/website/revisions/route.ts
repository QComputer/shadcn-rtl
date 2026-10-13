import type { NextRequest } from "next/server";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { websiteMutation, websiteRead, type WebsiteManagementParams } from "@/lib/hotel/content/hotel-website-management-api";

type Context = { params: Promise<WebsiteManagementParams> };
const service = new HotelWebsiteManagementService();

export function GET(_request: NextRequest, { params }: Context) {
  return websiteRead(params, ({ principal, scope }) => service.listRevisions(principal, scope));
}

export function POST(request: NextRequest, { params }: Context) {
  return websiteMutation(request, params, ({ principal, scope, idempotencyKey }, _route, body) => service.createDraft(principal, scope, body, idempotencyKey! ), 201);
}
