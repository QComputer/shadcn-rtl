import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";

export async function GET() {
  try {
    const { context } = await requireRetailMerchantContext();
    return NextResponse.json({ organizationSlug: context.organizationSlug });
  } catch (error) {
    return jsonError(error, "Could not load the store context.");
  }
}
