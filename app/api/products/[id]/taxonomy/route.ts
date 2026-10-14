import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireProductAccess, ApiError } from "@/lib/api-guards";
import { productTaxonomyPatchSchema, readProductTaxonomy, replaceProductTaxonomy } from "@/lib/retail/product-taxonomy.server";

const responseHeaders = { "Cache-Control": "private, no-store" };

function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null" || origin !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(403, "Forbidden origin");
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const product = await requireProductAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    return NextResponse.json(await readProductTaxonomy(id, product.organizationId), { headers: responseHeaders });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw new ApiError(415, "Expected JSON");
    }
    const session = await requireAuthSession();
    const { id } = await params;
    const product = await requireProductAccess(session, id, ["ADMIN", "MANAGER"]);
    const input = productTaxonomyPatchSchema.parse(await request.json());
    return NextResponse.json(await replaceProductTaxonomy(id, product.organizationId, input), { headers: responseHeaders });
  } catch (error) { return jsonError(error); }
}
