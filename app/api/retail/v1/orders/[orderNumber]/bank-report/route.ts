import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { bankTimeInput, submitBankReceiptReport, submitBankTimeReport } from "@/lib/retail/payment-reports.server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const { orderNumber } = await params;
    const organizationSlug = request.nextUrl.searchParams.get("organization")?.trim();
    if (!organizationSlug) throw new ApiError(400, "Store is required.");
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.startsWith("application/json")) {
      const parsed = bankTimeInput.safeParse(await request.json());
      if (!parsed.success) throw new ApiError(400, "Select a valid payment time only.");
      const report = await submitBankTimeReport({
        organizationSlug, orderNumber, customerId: session.user.id,
        reportedAt: parsed.data.reportedAt, submittedLocalTime: parsed.data.submittedLocalTime,
      });
      return NextResponse.json({ report }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (!contentType.startsWith("multipart/form-data")) throw new ApiError(415, "Unsupported payment report.");
    const form = await request.formData();
    if (form.get("method") !== "RECEIPT" || [...form.keys()].some((key) => !["method", "receipt"].includes(key))) {
      throw new ApiError(400, "Select a receipt image only.");
    }
    const receipt = form.get("receipt");
    if (!(receipt instanceof File) || receipt.size < 1 || receipt.size > 5 * 1024 * 1024) {
      throw new ApiError(413, "Receipt must be an image under 5 MB.");
    }
    const report = await submitBankReceiptReport({ organizationSlug, orderNumber, customerId: session.user.id,
      buffer: Buffer.from(await receipt.arrayBuffer()), mimeType: receipt.type });
    return NextResponse.json({ report }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not submit payment report."); }
}
