import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { requireRetailMerchantContext, assertRetailMutationOrigin } from "@/lib/retail/merchant-context.server";
import { getRetailFulfillmentSettings, updateRetailFulfillmentSettings } from "@/lib/retail/fulfillment-settings.server";
import { fulfillmentUpdateSchema } from "@/lib/retail/fulfillment";
export async function GET(request: NextRequest) {try {const {context}=await requireRetailMerchantContext(request.nextUrl.searchParams.get("organizationId") || undefined);return NextResponse.json(await getRetailFulfillmentSettings(context),{headers:{"Cache-Control":"private, no-store"}});}catch(error){return jsonError(error,"دریافت تنظیمات دریافت سفارش ناموفق بود.");}}
export async function PATCH(request: NextRequest) {try {assertRetailMutationOrigin(request);const {context}=await requireRetailMerchantContext(request.nextUrl.searchParams.get("organizationId") || undefined);return NextResponse.json(await updateRetailFulfillmentSettings(context,fulfillmentUpdateSchema.parse(await request.json())),{headers:{"Cache-Control":"private, no-store"}});}catch(error){return jsonError(error,"ذخیره تنظیمات دریافت سفارش ناموفق بود.");}}
