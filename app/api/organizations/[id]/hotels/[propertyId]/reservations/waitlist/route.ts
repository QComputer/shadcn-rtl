import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { readBoundedJson } from "@/lib/security/bounded-json";
import { receptionWaitlist } from "@/lib/hotel/services/reception-waitlist.server";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; propertyId: string }> }) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession(request);
    const { id, propertyId } = await params;
    return NextResponse.json(await receptionWaitlist({ userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId }, id, propertyId, await readBoundedJson(request, { maxBytes: 8192 })), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = jsonError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
