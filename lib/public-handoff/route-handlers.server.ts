import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { publicHandoffQuerySchema } from "./contracts";
import { ApiError } from "@/lib/api-guards";
import { publicCatalogResponse, publicCatalogError } from "@/lib/public-catalog/http";
import { listPublicProductHandoffs, getPublicProductHandoff } from "./service.server";

type OrganizationParams = { params: Promise<{ organizationIdentifier: string }> };
type HandoffNestedParams = { params: Promise<{ organizationIdentifier: string; externalId: string }> };

async function respond(request: NextRequest, load: () => Promise<unknown>) {
  try { return publicCatalogResponse(request, await load()); } catch (error) { return publicCatalogError(error); }
}

export async function productHandoffsHandler(request: NextRequest, context: OrganizationParams) {
  const { organizationIdentifier } = await context.params;
  return respond(request, async () => {
    const query = publicHandoffQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return listPublicProductHandoffs({
      organizationIdentifier,
      externalSource: query.externalSource,
      page: query.page,
      limit: query.limit,
    });
  });
}

export async function productHandoffHandler(request: NextRequest, context: HandoffNestedParams) {
  const { organizationIdentifier, externalId } = await context.params;
  return respond(request, async () => {
    const query = publicHandoffQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await getPublicProductHandoff({
      organizationIdentifier,
      externalSource: query.externalSource,
      externalId,
    });
    if (!result) throw new ApiError(404, "Handoff not found");
    return result;
  });
}
