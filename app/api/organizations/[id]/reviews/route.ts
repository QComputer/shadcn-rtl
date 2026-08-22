import { NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { submitVerifiedReview } from "@/lib/customer-reputation/customer-reputation.service";
import { requireTenantContext } from "@/lib/tenant-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    const body = await request.json();
    const review = await submitVerifiedReview({
      organizationId: id,
      customerIdentityId: String(body.customerIdentityId ?? ""),
      rating: Number(body.rating),
      title: typeof body.title === "string" ? body.title : null,
      text: typeof body.text === "string" ? body.text : null,
      reviewRequestId: typeof body.reviewRequestId === "string" ? body.reviewRequestId : null,
      businessEventId: typeof body.businessEventId === "string" ? body.businessEventId : null,
      customerInteractionId: typeof body.customerInteractionId === "string" ? body.customerInteractionId : null,
      businessEntityId: typeof body.businessEntityId === "string" ? body.businessEntityId : null,
      source: "REVIEW_REQUEST",
      metadata: { source: "review-api" },
    });

    return NextResponse.json({
      review: {
        id: review.publicId,
        rating: review.rating,
        title: review.title,
        status: review.status,
        verifiedInteraction: review.verifiedInteraction,
      },
    });
  } catch (error) {
    return jsonError(error, "Failed to submit review");
  }
}
