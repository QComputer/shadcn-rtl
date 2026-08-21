import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { resolveCustomerIdentity } from "@/lib/customer-identity/customer-identity.service";
import { requireTenantContext } from "@/lib/tenant-context";
import { resolveCustomerIdentitySchema } from "@/lib/validators/customer-identity";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    const body = resolveCustomerIdentitySchema.parse(await request.json());
    const customerIdentity = await resolveCustomerIdentity({
      organizationId: id,
      ...body,
    });

    return NextResponse.json({
      customerIdentity: {
        id: customerIdentity.id,
        publicId: customerIdentity.publicId,
        organizationId: customerIdentity.organizationId,
        userId: customerIdentity.userId,
        guestCustomerId: customerIdentity.guestCustomerId,
        phone: customerIdentity.phone,
        email: customerIdentity.email,
        status: customerIdentity.status,
        createdAt: customerIdentity.createdAt,
        updatedAt: customerIdentity.updatedAt,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
