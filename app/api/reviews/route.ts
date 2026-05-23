import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { reviewService } from "@/lib/services/review.service";

const createReviewBodySchema = z.object({
  organizationSlug: z.string().trim().min(1).max(120).optional(),
  organizationId: z.string().trim().min(1).max(120).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().nullable(),
}).refine((value) => value.organizationSlug || value.organizationId, {
  message: "organizationSlug or organizationId is required",
  path: ["organizationSlug"],
});

function reviewRateLimit(request: NextRequest, userId: string) {
  const clientIp = getClientIp(request.headers);
  const result = checkRateLimit({
    key: `review:${userId}:${clientIp}`,
    limit: 10,
    windowMs: 60_000,
  });

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many review requests" },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reviews = await reviewService.list({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      organizationSlug: searchParams.get("organizationSlug"),
      organizationId: searchParams.get("organizationId"),
      minRating: searchParams.get("minRating"),
      maxRating: searchParams.get("maxRating"),
    });

    return NextResponse.json(reviews);
  } catch (error) {
    return jsonError(error, "Error listing reviews");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const limited = reviewRateLimit(request, session.user.id);
    if (limited) return limited;

    const body = createReviewBodySchema.parse(await request.json());
    const review = await reviewService.create(session.user.id, body);
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid review payload", details: error.flatten() }, { status: 400 });
    }
    return jsonError(error, "Error creating review");
  }
}
