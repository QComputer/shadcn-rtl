import { NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { getAiMediaServiceContractSummary } from "@/lib/services/ai-media-service-client";

export async function GET() {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const contract = await getAiMediaServiceContractSummary();

    return NextResponse.json({
      contract,
      security: {
        secretValuesReturned: false,
        rawBodyReturned: false,
        browserDirectAccess: false,
      },
    });
  } catch (error) {
    return jsonError(error, "Failed to load AI media service contract");
  }
}
