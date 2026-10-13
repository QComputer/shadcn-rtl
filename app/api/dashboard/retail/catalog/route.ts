import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { createMerchantRetailProduct, listMerchantRetailProducts, retailProductCreateSchema } from "@/lib/retail/merchant-catalog.server";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  query: z.string().trim().max(100).optional(),
  state: z.enum(["all", "published", "draft"]).default("all"),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const { context } = await requireRetailMerchantContext();
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json(await listMerchantRetailProducts({ context, ...query }));
  } catch (error) {
    return jsonError(error, "Could not load this store's retail catalog.");
  }
}

export async function POST(request: NextRequest) {
  try {
    assertRetailMutationOrigin(request);
    const { context, session } = await requireRetailMerchantContext();
    const data = retailProductCreateSchema.parse(await request.json());
    const product = await createMerchantRetailProduct(context, session.user.id, data);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Could not save the product.");
  }
}
