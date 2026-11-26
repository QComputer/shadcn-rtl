import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import { requireCheckoutOwner } from "@/lib/retail/checkout-owner.server";
import { getRetailCustomerOrder } from "@/lib/retail/customer-order.server";
export async function GET(request: NextRequest, {params}: {params: Promise<{orderNumber: string}>}) {
  try {const organization=request.nextUrl.searchParams.get("organization")?.trim();
    if(!organization)throw new ApiError(400,"Organization is required.");
    const { owner } = await requireCheckoutOwner(request, organization);
    return NextResponse.json({order:await getRetailCustomerOrder(owner,organization,(await params).orderNumber)},{headers:{"Cache-Control":"private, no-store", Vary: "Cookie"}});
  }catch(error){return jsonError(error,"Could not load order.");}
}
