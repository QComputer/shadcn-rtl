import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { createMerchantRetailDefinition, listMerchantRetailDefinitions, retailDefinitionSchema } from "@/lib/retail/merchant-catalog.server";

export async function GET() {
  try {
    const { context } = await requireRetailMerchantContext();
    return NextResponse.json({ definitions: await listMerchantRetailDefinitions(context) });
  } catch (error) {
    return jsonError(error, "Could not load store attributes.");
  }
}

export async function POST(request: NextRequest) {
  try {
    assertRetailMutationOrigin(request);
    const { context } = await requireRetailMerchantContext();
    const definition = retailDefinitionSchema.parse(await request.json());
    return NextResponse.json({ definition: await createMerchantRetailDefinition(context, definition) }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Could not save this attribute definition.");
  }
}
