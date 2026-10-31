import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit-log";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, vercelShopDomainActionSchema } from "@/lib/shop-domain-admin";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";
import {
  addProjectDomain,
  removeProjectDomain,
  verifyProjectDomain,
  domainUpdateFromResult,
} from "@/lib/domain-automation.server";

function parseError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
  }

  return jsonError(error, "Failed to sync shop domain with provider");
}

function getClientMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent"),
  };
}

async function runDomainAction(action: "add" | "check" | "remove", domain: string) {
  if (action === "add") return addProjectDomain(domain);
  if (action === "check") return verifyProjectDomain(domain);
  return removeProjectDomain(domain);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireSuperAdmin(session);

    const { domainId } = await params;
    const body = vercelShopDomainActionSchema.parse(await request.json());

    const existing = await prisma.organizationDomain.findUnique({
      where: { id: domainId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            capabilitiesInitializedAt: true,
            capabilities: { select: { key: true, status: true } },
            isActive: true,
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError(404, "Custom domain not found");
    }

    if (!hasOrganizationCapability({ legacyType: existing.organization.type, capabilitiesInitializedAt: existing.organization.capabilitiesInitializedAt, capabilities: existing.organization.capabilities }, "SHOP")) {
      throw new ApiError(400, "Only shop domains can be synced with Vercel from this tool");
    }

    const domainAutomation = await runDomainAction(body.action, existing.normalizedDomain);
    const domain = await prisma.organizationDomain.update({
      where: { id: existing.id },
      data: domainUpdateFromResult(domainAutomation),
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            isActive: true,
          },
        },
      },
    });

    await writeAuditLog({
      action: body.action === "remove" ? "DELETE" : "UPDATE",
      entityType: "OrganizationDomain",
      entityId: domain.id,
      description: `Domain ${body.action} requested for ${domain.normalizedDomain}.`,
      newValue: { action: body.action, domainAutomation },
      userId: session.user.id,
      organizationId: domain.organizationId,
      ...getClientMeta(request),
    });

    return NextResponse.json({ domain, domainAutomation });
  } catch (error) {
    return parseError(error);
  }
}
