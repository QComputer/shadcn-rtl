import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";

const schema = z.object({
  providerVerified: z.boolean(),
  dnsConfigured: z.boolean(),
  sslReady: z.boolean(),
  providerEvidenceReference: z.string().trim().min(8).max(500),
  dnsEvidenceReference: z.string().trim().min(8).max(500),
  tlsEvidenceReference: z.string().trim().min(8).max(500),
  revoke: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  try {
    await requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const role = (session.user as { role?: string } | undefined)?.role;
    if (role !== "SUPER_ADMIN") throw new ApiError(403, "Super admin required");
    const { domainId } = await params;
    const body = schema.parse(await request.json());

    const existing = await prisma.organizationDomain.findUnique({
      where: { id: domainId },
      select: { id: true, organizationId: true, normalizedDomain: true, status: true, deletedAt: true, removedAt: true, disabledAt: true, providerVerified: true, dnsConfigured: true, sslReady: true },
    });
    if (!existing) throw new ApiError(404, "Domain not found");
    if (existing.deletedAt || existing.removedAt || existing.disabledAt) throw new ApiError(400, "Domain is not active");
    const org = await prisma.organization.findUnique({ where: { id: existing.organizationId }, select: { id: true, isActive: true, deletedAt: true } });
    if (!org || !org.isActive || org.deletedAt) throw new ApiError(400, "Organization is not active");

    const revoke = Boolean(body.revoke);
    const newProvider = revoke ? false : body.providerVerified;
    const newDns = revoke ? false : body.dnsConfigured;
    const newSsl = revoke ? false : body.sslReady;
    const allVerified = newProvider && newDns && newSsl;

    const updated = await prisma.$transaction(async (tx) => {
      const domain = await tx.organizationDomain.update({
        where: { id: domainId },
        data: {
          providerVerified: newProvider,
          dnsConfigured: newDns,
          sslReady: newSsl,
          verifiedAt: allVerified ? new Date() : null,
          lastCheckedAt: new Date(),
          failureReason: allVerified ? null : (revoke ? "Verification revoked" : "Incomplete verification evidence"),
        },
      });
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "OrganizationDomain",
          entityId: domain.id,
          description: revoke ? `Domain verification revoked for ${domain.normalizedDomain}.` : `Domain verification attested for ${domain.normalizedDomain}.`,
          previousValue: { providerVerified: existing.providerVerified, dnsConfigured: existing.dnsConfigured, sslReady: existing.sslReady },
          newValue: { providerVerified: newProvider, dnsConfigured: newDns, sslReady: newSsl, providerEvidenceReference: body.providerEvidenceReference, dnsEvidenceReference: body.dnsEvidenceReference, tlsEvidenceReference: body.tlsEvidenceReference, revoked: revoke },
          userId: session.user.id,
          organizationId: domain.organizationId,
        },
      });
      return domain;
    });

    return NextResponse.json({ domain: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    return jsonError(error, "Failed to attest domain verification");
  }
}
