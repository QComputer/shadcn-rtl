import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import { runSeoContentRequestDryRun } from "@/lib/seo-content/seo-content.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id, requestId } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    return NextResponse.json({ request: await runSeoContentRequestDryRun({ organizationId: id, requestId }) });
  } catch (error) {
    return jsonError(error);
  }
}
