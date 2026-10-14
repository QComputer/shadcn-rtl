import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireProductAccess, ApiError, requireSameOriginMutation } from "@/lib/api-guards";
import { productTaxonomyPatchSchema, readProductTaxonomy, replaceProductTaxonomy } from "@/lib/retail/product-taxonomy.server";

const responseHeaders = { "Cache-Control": "private, no-store" };

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
    requireSameOriginMutation(request);
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
