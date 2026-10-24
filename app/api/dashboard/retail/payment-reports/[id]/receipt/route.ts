import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { getRetailReceiptForMerchant } from "@/lib/retail/payment-reports.server";
import { readRetailReceipt } from "@/lib/retail/receipt-storage.server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { context, session } = await requireRetailMerchantContext();
    const { id } = await params;
    const key = await getRetailReceiptForMerchant(context.organizationId, id);
    const { buffer, contentType } = await readRetailReceipt(key, context.organizationId);
    await prisma.auditLog.create({ data: { action: "CREATE", entityType: "RetailPaymentReceiptAccess",
      entityId: id, description: "Merchant accessed private retail receipt", userId: session.user.id,
      organizationId: context.organizationId } });
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": contentType, "Cache-Control": "no-store, private",
      "Content-Disposition": "inline; filename=receipt",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return jsonError(error, "Could not load receipt."); }
}
