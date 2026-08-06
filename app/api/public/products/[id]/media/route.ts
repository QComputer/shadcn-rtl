import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { streamPublicProductAiMedia } from "@/lib/services/ai-media-entity-attachment-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await streamPublicProductAiMedia({ productId: id });
    if (!result) return NextResponse.json({ error: "Media not found" }, { status: 404 });

    return new NextResponse(result.stream as any, {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `inline; filename="${result.filename}"`,
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error, "Failed to stream product media");
  }
}
