import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit-log";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, vercelShopDomainActionSchema } from "@/lib/shop-domain-admin";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";
import {
  addProjectDomainToVercel,
  removeProjectDomainFromVercel,
  verifyProjectDomainOnVercel,
  type VercelDomainAutomationResult,
} from "@/lib/vercel-domain-automation";

function parseError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
  }

  return jsonError(error, "Failed to sync shop domain with Vercel");
}

function getClientMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent"),
  };
}

function domainUpdateFromVercelResult(result: VercelDomainAutomationResult) {
  if (result.dryRun) {
    return {
      lastCheckedAt: new Date(),
      failureReason: result.message,
    };
  }

  return {
    vercelProjectDomainId: result.action === "remove" ? null : result.projectId || null,
    verificationToken: result.action === "remove" ? null : result.verificationToken || null,
    status: result.status,
    verifiedAt: result.verified ? new Date() : null,
    lastCheckedAt: new Date(),
    failureReason: result.ok ? null : result.message,
  };
}

async function runVercelAction(action: "add" | "check" | "remove", domain: string) {
  if (action === "add") return addProjectDomainToVercel(domain);
  if (action === "check") return verifyProjectDomainOnVercel(domain);
  return removeProjectDomainFromVercel(domain);
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

    const vercel = await runVercelAction(body.action, existing.normalizedDomain);
    const domain = await prisma.organizationDomain.update({
      where: { id: existing.id },
      data: domainUpdateFromVercelResult(vercel),
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
      description: `Vercel domain ${body.action} requested for ${domain.normalizedDomain}.`,
      newValue: { action: body.action, vercel },
      userId: session.user.id,
      organizationId: domain.organizationId,
      ...getClientMeta(request),
    });

    return NextResponse.json({ domain, vercel });
  } catch (error) {
    return parseError(error);
  }
}
