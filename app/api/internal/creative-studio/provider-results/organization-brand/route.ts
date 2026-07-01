import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";

function getResultIngestionSecret() {
  return process.env.CREATIVE_STUDIO_PROVIDER_RESULTS_INTERNAL_KEY
    || process.env.AI_MEDIA_SERVICE_INTERNAL_KEY
    || process.env.INTERNAL_API_SECRET
    || "";
}

function isAuthorized(request: NextRequest, secret: string) {
  const headerSecret = request.headers.get("x-creative-studio-provider-key")
    || request.headers.get("x-bazarbaz-ai-key")
    || request.headers.get("x-internal-secret");
  return Boolean(secret) && headerSecret === secret;
}

export async function POST(request: NextRequest) {
  try {
    const secret = getResultIngestionSecret();
    if (process.env.NODE_ENV === "production" && !secret) {
      return NextResponse.json({ error: "Provider result ingestion is not configured" }, { status: 503 });
    }
    if (!isAuthorized(request, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = await creativeStudioService.ingestOrganizationBrandProviderResult({
      organizationId: body.organizationId,
      creativeStudioJobId: body.creativeStudioJobId,
      providerJobId: body.providerJobId,
      targetType: body.targetType,
      result: {
        providerJobId: body.providerJobId,
        status: body.status,
        outputs: body.outputs,
        error: body.error,
        metadata: body.metadata,
      },
      requestedByUserId: null,
      source: "internal-webhook",
    });

    return NextResponse.json({
      ok: true,
      createdAssets: result.createdAssets,
      updatedJobStatus: result.updatedJobStatus,
      publicAutoApply: false,
    });
  } catch (error) {
    return jsonError(error, "Failed to ingest Creative Studio provider result");
  }
}
