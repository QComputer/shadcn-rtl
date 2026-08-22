import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import {
  getPublicReviewRequestByToken,
  submitPublicReviewByToken,
} from "@/lib/customer-reputation/customer-reputation.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    return NextResponse.json(await getPublicReviewRequestByToken(token));
  } catch (error) {
    return jsonError(error, "Failed to load review request");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = await request.json();
    return NextResponse.json(await submitPublicReviewByToken({
      token,
      rating: Number(body.rating),
      serviceQualityRating: body.serviceQualityRating == null ? null : Number(body.serviceQualityRating),
      title: typeof body.title === "string" ? body.title : null,
      text: typeof body.text === "string" ? body.text : null,
      imageMetadata: body.imageMetadata ?? null,
    }));
  } catch (error) {
    return jsonError(error, "Failed to submit review");
  }
}
