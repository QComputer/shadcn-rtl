import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession, requireServiceAccess } from "@/lib/api-guards";
import {
  attachAiMediaAssetToService,
  detachAiMediaAssetFromService,
} from "@/lib/services/ai-media-entity-attachment-service";

const attachSchema = z.object({
  aiMediaAssetId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { serviceId } = await params;
    await requireServiceAccess(session, serviceId, ["ADMIN", "MANAGER"]);
    const body = attachSchema.parse(await request.json());

    const result = await attachAiMediaAssetToService({
      serviceId,
      aiMediaAssetId: body.aiMediaAssetId,
      actorRole: session.user.role,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to attach AI media asset to service");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { serviceId } = await params;
    await requireServiceAccess(session, serviceId, ["ADMIN", "MANAGER"]);

    const result = await detachAiMediaAssetFromService({
      serviceId,
      actorRole: session.user.role,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to detach AI media asset from service");
  }
}
