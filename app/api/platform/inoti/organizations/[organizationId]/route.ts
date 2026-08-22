import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import {
  connectInotiServices,
  createInotiConnectionDraft,
  getInotiAccountReadModel,
  normalizeServiceKeys,
} from "@/lib/integrations/inoti-account-management";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    return NextResponse.json({ inoti: await getInotiAccountReadModel(organizationId) });
  } catch (error) {
    return jsonError(error, "Failed to load iNoti account");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const { organizationId } = await params;
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "draft";
    const services = normalizeServiceKeys(body?.services);
    const externalAccountId = typeof body?.externalAccountId === "string" ? body.externalAccountId.trim() : null;
    const accountLabel = typeof body?.accountLabel === "string" ? body.accountLabel.trim() : null;
    const credentialProfileKey = typeof body?.credentialProfileKey === "string" ? body.credentialProfileKey.trim() : null;

    if (action === "draft") {
      return NextResponse.json({
        inoti: await createInotiConnectionDraft({
          organizationId,
          externalAccountId,
          accountLabel,
          credentialProfileKey,
          services,
          actorUserId: session.user.id,
        }),
      });
    }

    if (action === "connect") {
      if (!credentialProfileKey) throw new ApiError(400, "credentialProfileKey is required");
      return NextResponse.json({
        inoti: await connectInotiServices({
          organizationId,
          externalAccountId,
          accountLabel,
          credentialProfileKey,
          services,
          actorUserId: session.user.id,
        }),
      });
    }

    throw new ApiError(400, "Unsupported iNoti action");
  } catch (error) {
    return jsonError(error, "Failed to update iNoti account");
  }
}
