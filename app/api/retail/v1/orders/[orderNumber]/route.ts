import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { getRetailCustomerOrder } from "@/lib/retail/customer-order.server";
export async function GET(request: NextRequest, {params}: {params: Promise<{orderNumber: string}>}) {
  try {const session=await requireAuthSession();const organization=request.nextUrl.searchParams.get("organization")?.trim();
    if(!organization)throw new ApiError(400,"Organization is required.");
    return NextResponse.json({order:await getRetailCustomerOrder(session.user.id,organization,(await params).orderNumber)},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return jsonError(error,"Could not load order.");}
}
