import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const session = await requireAuthSession();
    const organization = request.nextUrl.searchParams.get("organization")?.trim() ?? "";
    if (!organization) throw new ApiError(400, "Organization is required.");
    const { orderNumber } = await params;
    const order = await prisma.order.findFirst({ where: { orderNumber, organizationSlug: organization,
      customerId: session.user.id, retailCheckoutKey: { not: null }, deletedAt: null },
      include: { items: { orderBy: { id: "asc" } }, payment: true } });
    if (!order) throw new ApiError(404, "Order not found.");
    const metadata = order.payment?.metadata;
    const retail = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "retailR4" in metadata
      ? metadata.retailR4 : null;
    const snapshot = retail && typeof retail === "object" && !Array.isArray(retail) ? retail : null;
    return NextResponse.json({ order: { orderNumber: order.orderNumber, total: order.total.toNumber(), subtotal: order.subtotal.toNumber(),
      discount: order.discount.toNumber(), deliveryFee: order.deliveryFee.toNumber(), orderStatus: order.status, paymentStatus: order.paymentStatus,
      paymentMethod: order.payment?.method ?? order.paymentMethod, type: order.type, deliveryAddress: order.deliveryAddress,
      notes: order.notes, createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({ id: item.id, productName: item.productNameSnapshot ?? "Product",
        variantName: item.variantNameSnapshot, sku: item.skuSnapshot,
        options: Array.isArray(item.variantOptionsSnapshot) ? item.variantOptionsSnapshot : [], quantity: item.quantity,
        unitPrice: item.price.toNumber(), lineTotal: item.price.mul(item.quantity).sub(item.discount).toNumber() })),
      paymentDeadlineAt: typeof snapshot?.paymentDeadlineAt === "string" ? snapshot.paymentDeadlineAt : order.retailPaymentDeadlineAt?.toISOString() ?? null,
      bankCardNumber: typeof snapshot?.bankCardNumber === "string" ? snapshot.bankCardNumber : null,
      bankAccountOwner: typeof snapshot?.bankAccountOwner === "string" ? snapshot.bankAccountOwner : null,
      trackingToken: order.payment?.method === "INOTI_USSD" ? order.publicTrackingToken : null,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not load order."); }
}
