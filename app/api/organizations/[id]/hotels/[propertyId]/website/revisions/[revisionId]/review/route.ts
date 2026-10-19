import { z } from "zod";
import type { NextRequest } from "next/server";
import { HotelWebsiteManagementService } from "@/lib/hotel/content/hotel-website-management.service";
import { websiteMutation, type WebsiteManagementParams } from "@/lib/hotel/content/hotel-website-management-api";

type Context = { params: Promise<WebsiteManagementParams> };
const service = new HotelWebsiteManagementService();
const decisionSchema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(1000).optional() }).strict();

export function POST(request: NextRequest, { params }: Context) {
  return websiteMutation(request, params, ({ principal, scope, idempotencyKey }, route, body) => {
    const { decision, note } = decisionSchema.parse(body);
    return service.decide(principal, scope, route.revisionId!, decision, note, idempotencyKey!);
  });
}
