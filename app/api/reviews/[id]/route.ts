import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { reviewService } from "@/lib/services/review.service";

const updateReviewBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(2000).optional().nullable(),
}).refine((value) => value.rating !== undefined || value.comment !== undefined, {
  message: "rating or comment is required",
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const review = await reviewService.getById(id);
    return NextResponse.json(review);
  } catch (error) {
    return jsonError(error, "Error getting review");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const body = updateReviewBodySchema.parse(await request.json());
    const review = await reviewService.update(id, session.user.id, body);
    return NextResponse.json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid review payload", details: error.flatten() }, { status: 400 });
    }
    return jsonError(error, "Error updating review");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await reviewService.delete(id, session.user.id, session.user.role);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Error deleting review");
  }
}
