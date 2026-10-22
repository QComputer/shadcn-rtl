import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { listMerchantRetailOrders, merchantOrderQuerySchema } from "@/lib/retail/merchant-orders.server";
export async function GET(request: NextRequest) {
  try {
    const {context} = await requireRetailMerchantContext();
    return NextResponse.json(await listMerchantRetailOrders(context, merchantOrderQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams))), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error) {return jsonError(error, "بارگذاری سفارش‌ها ناموفق بود.");}
}
