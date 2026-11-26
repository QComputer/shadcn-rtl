import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { checkoutOrderOwner, requireCheckoutOwner } from "@/lib/retail/checkout-owner.server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { store, owner } = await requireCheckoutOwner(request, request.nextUrl.searchParams.get("organization")?.trim() ?? "");
    const orders = await prisma.order.findMany({ where: { organizationSlug: store.slug, ...checkoutOrderOwner(owner, store.slug),
      retailCheckoutKey: { not: null }, deletedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20,
      select: { orderNumber: true, total: true, status: true, paymentStatus: true, type: true, createdAt: true } });
    return NextResponse.json({ orders: orders.map(o => ({ ...o, total: o.total.toString(), createdAt: o.createdAt.toISOString() })) },
      { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (error) { return jsonError(error, "Could not load orders."); }
}
