import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { assertDomainOwnership } from "@/lib/domains/domain-authorization.server";
import {
  addProjectDomain,
  inspectProjectDomain,
  removeProjectDomain,
  verifyProjectDomain,
  domainUpdateFromResult,
} from "@/lib/domain-automation.server";
import { customDomainLocales } from "@/lib/custom-domain-routing";
import { revalidatePath } from "next/cache";
import { organizationPublicRouteCapabilities, type CapabilityRecord } from "@/lib/organization-capabilities";
import { getApexDomainInfo, getDomainPresentationKind } from "@/lib/domains/domain-normalization.server";

const organizationDomainActionSchema = z.object({
  action: z.enum(["add", "check", "verify", "remove"]),
});

function getClientMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent"),
  };
}

function parseError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
  }

  return jsonError(error, "Failed to manage organization domain");
}

function revalidateOrganizationPublicPaths(organization: { slug: string; type: "SHOP" | "APPOINTMENT"; capabilitiesInitializedAt: Date | null; capabilities: CapabilityRecord[] }) {
  const capabilities = organizationPublicRouteCapabilities({ legacyType: organization.type, capabilitiesInitializedAt: organization.capabilitiesInitializedAt, capabilities: organization.capabilities });
  revalidatePath(`/organization/${organization.slug}`);
  for (const capability of capabilities) revalidatePath(`/${capability === "SHOP" ? "shop" : "appointment"}/${organization.slug}`);

  for (const locale of customDomainLocales) {
    revalidatePath(`/${locale}/organization/${organization.slug}`);
    for (const capability of capabilities) revalidatePath(`/${locale}/${capability === "SHOP" ? "shop" : "appointment"}/${organization.slug}`);
  }
}

async function runDomainAction(action: "add" | "check" | "verify" | "remove", domain: string) {
  if (action === "add") return addProjectDomain(domain);
  if (action === "check") return inspectProjectDomain(domain);
  if (action === "verify") return verifyProjectDomain(domain);
  return removeProjectDomain(domain);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { domainId } = await params;
    const body = organizationDomainActionSchema.parse(await request.json());

    const domain = await assertDomainOwnership(prisma, session.user.id, domainId);

    const domainAutomation = await runDomainAction(body.action, domain.domain);
    const updated = await prisma.organizationDomain.update({
      where: { id: domainId },
      data: domainUpdateFromResult(domainAutomation),
      include: {
        organization: {
          select: { id: true, name: true, slug: true, type: true, capabilitiesInitializedAt: true, capabilities: { select: { key: true, status: true } }, isActive: true },
        },
      },
    });

    await writeAuditLog({
      action: body.action === "remove" ? "DELETE" : "UPDATE",
      entityType: "OrganizationDomain",
      entityId: updated.id,
      description: `Domain ${body.action} requested for ${updated.normalizedDomain}.`,
      newValue: { action: body.action, domainAutomation },
      userId: session.user.id,
      organizationId: updated.organizationId,
      ...getClientMeta(request),
    });

    try {
      revalidateOrganizationPublicPaths(updated.organization);
    } catch {
      // Cache revalidation must not break domain mutations.
    }

    return NextResponse.json({
      domain: {
        ...updated,
        displayKind: getDomainPresentationKind(updated.domain),
        apexInfo: getApexDomainInfo(updated.domain),
      },
      domainAutomation,
    });
  } catch (error) {
    return parseError(error);
  }
}
