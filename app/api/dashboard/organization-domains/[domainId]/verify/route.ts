import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";

const schema = z.object({
  providerVerified: z.boolean(),
  dnsConfigured: z.boolean(),
  sslReady: z.boolean(),
  evidenceReference: z.string().trim().min(8).max(500),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  try {
    const session = await requireAuthSession();
    const role = (session.user as { role?: string } | undefined)?.role;
    if (role !== "SUPER_ADMIN") throw new ApiError(403, "Super admin required");
    const { domainId } = await params;
    const body = schema.parse(await request.json());
    const existing = await prisma.organizationDomain.findUnique({ where: { id: domainId }, select: { id: true, organizationId: true, normalizedDomain: true } });
    if (!existing) throw new ApiError(404, "Domain not found");
    const updated = await prisma.organizationDomain.update({
      where: { id: domainId },
      data: {
        providerVerified: body.providerVerified,
        dnsConfigured: body.dnsConfigured,
        sslReady: body.sslReady,
        verifiedAt: body.providerVerified && body.dnsConfigured && body.sslReady ? new Date() : null,
        lastCheckedAt: new Date(),
        failureReason: body.providerVerified && body.dnsConfigured && body.sslReady ? null : "Incomplete verification evidence",
      },
    });
    await writeAuditLog({
      action: "UPDATE",
      entityType: "OrganizationDomain",
      entityId: updated.id,
      description: `Domain verification attested for ${updated.normalizedDomain}.`,
      newValue: { providerVerified: body.providerVerified, dnsConfigured: body.dnsConfigured, sslReady: body.sslReady, evidenceReference: body.evidenceReference },
      userId: session.user.id,
      organizationId: updated.organizationId,
    });
    return NextResponse.json({ domain: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    return jsonError(error, "Failed to attest domain verification");
  }
}
