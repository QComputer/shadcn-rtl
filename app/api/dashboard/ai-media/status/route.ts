import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import {
  checkAiMediaServiceReadiness,
  getAiMediaServiceConfigStatus,
} from "@/lib/services/ai-media-service-client";

export async function GET(request: NextRequest) {
  try {
    await requireAuthSession();

    const status = getAiMediaServiceConfigStatus();
    const shouldCheckRemote = request.nextUrl.searchParams.get("check") === "1";
    const remote = shouldCheckRemote ? await checkAiMediaServiceReadiness() : null;

    return NextResponse.json({
      enabled: status.ready,
      configured: status.configured,
      ready: status.ready,
      checks: {
        urlConfigured: status.urlConfigured,
        internalKeyConfigured: status.internalKeyConfigured,
        timeoutMs: status.timeoutMs,
      },
      remote: remote
        ? {
            ok: remote.ok,
            checked: remote.checked,
            checks: remote.checks,
          }
        : null,
    });
  } catch (error) {
    return jsonError(error, "Failed to load AI media status");
  }
}
