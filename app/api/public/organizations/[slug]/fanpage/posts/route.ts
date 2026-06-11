import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession, requireOrgManageAccessBySlug } from "@/lib/api-guards";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { fanpageService } from "@/lib/services/fanpage.service";

const createFanpagePostSchema = z.object({
  title: z.string().trim().max(120).optional().nullable(),
  body: z.string().trim().min(1).max(4000),
  image: z.string().trim().max(500).optional().nullable(),
  video: z.string().trim().max(500).optional().nullable(),
});

function postRateLimit(request: NextRequest, userId: string, slug: string) {
  const clientIp = getClientIp(request.headers);
  const result = checkRateLimit({
    key: `fanpage-post:${userId}:${slug}:${clientIp}`,
    limit: 12,
    windowMs: 60_000,
  });

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many fanpage post requests" },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
    );
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const result = await fanpageService.listPublic(slug, {
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Error loading fanpage posts");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { slug } = await params;
    await requireOrgManageAccessBySlug(session, slug, ["ADMIN", "MANAGER"]);

    const limited = postRateLimit(request, session.user.id, slug);
    if (limited) return limited;

    const body = createFanpagePostSchema.parse(await request.json());
    const post = await fanpageService.create(slug, session.user.id, body);
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid fanpage post payload", details: error.flatten() }, { status: 400 });
    }
    return jsonError(error, "Error creating fanpage post");
  }
}
