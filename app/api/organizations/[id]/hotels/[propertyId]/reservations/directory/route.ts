import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { readBoundedJson } from "@/lib/security/bounded-json";
import { readReceptionDirectory } from "@/lib/hotel/services/reception-directory.server";

// POST keeps personal search terms out of the URL; this endpoint is read-only.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession(request);
    const { id, propertyId } = await params;
    const result = await readReceptionDirectory({ userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId }, id, propertyId, await readBoundedJson(request, { maxBytes: 4096 }));
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = jsonError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
