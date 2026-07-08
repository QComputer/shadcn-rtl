import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { ApiError, jsonError, requireAuthSession, requireOrgAccess } from "@/lib/api-guards";
import {
  addProjectDomainToVercel,
  removeProjectDomainFromVercel,
  verifyProjectDomainOnVercel,
  type VercelDomainAutomationResult,
} from "@/lib/vercel-domain-automation";

const organizationDomainActionSchema = z.object({
  action: z.enum(["add", "check", "remove"]),
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

function domainUpdateFromVercelResult(result: VercelDomainAutomationResult) {
  return {
    vercelProjectDomainId: result.action === "remove" ? null : result.projectId || null,
    verificationToken: result.action === "remove" ? null : result.verificationToken || null,
    status: result.status,
    verifiedAt: result.verified ? new Date() : null,
    lastCheckedAt: new Date(),
    failureReason: result.ok ? null : result.message,
  };
}

async function assertDomainOwnership(
  sessionUserId: string,
  organizationDomainId: string,
) {
  const domain = await prisma.organizationDomain.findUnique({
    where: { id: organizationDomainId },
    select: { id: true, organizationId: true, deletedAt: true, domain: true },
  });

  if (!domain || domain.deletedAt) {
    throw new ApiError(404, "Organization domain not found");
  }

  if (sessionUserId) {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: sessionUserId,
        organizationId: domain.organizationId,
        isActive: true,
        organization: { isActive: true, deletedAt: null },
      },
      select: { id: true },
    });

    if (!membership) {
      const user = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { role: true },
      });

      if (user?.role !== "SUPER_ADMIN") {
        throw new ApiError(403, "Forbidden");
      }
    }
  }

  return domain;
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
    const { domainId } = await params;
    const body = organizationDomainActionSchema.parse(await request.json());

    const domain = await assertDomainOwnership(session.user.id, domainId);

    const vercel = await runVercelAction(body.action, domain.domain);
    const updated = await prisma.organizationDomain.update({
      where: { id: domainId },
      data: domainUpdateFromVercelResult(vercel),
      include: {
        organization: {
          select: { id: true, name: true, slug: true, type: true, isActive: true },
        },
      },
    });

    await writeAuditLog({
      action: body.action === "remove" ? "DELETE" : "UPDATE",
      entityType: "OrganizationDomain",
      entityId: updated.id,
      description: `Vercel domain ${body.action} requested for ${updated.normalizedDomain}.`,
      newValue: { action: body.action, vercel },
      userId: session.user.id,
      organizationId: updated.organizationId,
      ...getClientMeta(request),
    });

    return NextResponse.json({ domain: updated, vercel });
  } catch (error) {
    return parseError(error);
  }
}
