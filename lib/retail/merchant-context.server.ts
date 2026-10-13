import "server-only";

import { ApiError, requireAuthSession, requireSameOriginMutation, type SessionWithUser } from "@/lib/api-guards";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { requireTenantContext, type TenantContext } from "@/lib/tenant-context";

export async function requireRetailMerchantContext(): Promise<{ session: SessionWithUser; context: TenantContext }> {
  const session = await requireAuthSession();
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new ApiError(403, "Select an active store before managing its catalog.");
  const context = await requireTenantContext(session, organizationId, ["ADMIN", "MANAGER"]);
  await requireActiveOrganizationCapability({ organizationId: context.organizationId, capability: "SHOP" });
  return { session, context };
}

export function assertRetailMutationOrigin(request: Request) {
  requireSameOriginMutation(request);
}
