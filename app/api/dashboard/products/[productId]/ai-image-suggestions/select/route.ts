import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireProductAccess } from "@/lib/api-guards";
import { aiMediaService } from "@/lib/services/ai-media.service";
import { selectAiMediaImageSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { productId } = await params;

    const product = await requireProductAccess(session, productId, ["ADMIN", "MANAGER"]);

    const body = await request.json();
    const data = selectAiMediaImageSchema.parse(body);

    const result = await aiMediaService.selectImage(
      product.organizationId,
      product.id,
      data.job_id,
      data.image_url,
      data.output_index,
    );

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      storedDurably: result.storedDurably,
      storageStatus: result.storageStatus,
    });
  } catch (error) {
    return jsonError(error, "Failed to select AI image");
  }
}
