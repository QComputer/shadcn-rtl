import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { listRetailPaymentReports } from "@/lib/retail/payment-reports.server";

export async function GET() {
  try {
    const { context } = await requireRetailMerchantContext();
    return NextResponse.json({ reports: await listRetailPaymentReports(context.organizationId) },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not load payment reports."); }
}
