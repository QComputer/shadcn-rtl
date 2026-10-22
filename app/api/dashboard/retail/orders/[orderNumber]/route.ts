import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { assertRetailMutationOrigin, requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { changeMerchantRetailOrder, getMerchantRetailOrder, merchantOrderActionSchema } from "@/lib/retail/merchant-orders.server";
type Params = {params: Promise<{orderNumber: string}>};
export async function GET(_request: NextRequest, {params}: Params) {
  try {const {context} = await requireRetailMerchantContext(); return NextResponse.json({order: await getMerchantRetailOrder(context, (await params).orderNumber)}, {headers: {"Cache-Control": "private, no-store"}});}
  catch (error) {return jsonError(error, "بارگذاری سفارش ناموفق بود.");}
}
export async function POST(request: NextRequest, {params}: Params) {
  try {assertRetailMutationOrigin(request); const {context} = await requireRetailMerchantContext();
    return NextResponse.json({order: await changeMerchantRetailOrder(context, (await params).orderNumber, merchantOrderActionSchema.parse(await request.json()))});}
  catch (error) {return jsonError(error, "تغییر وضعیت سفارش ناموفق بود.");}
}
