import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { jsonError, requireAuthSession, requireOrgAccess } from "@/lib/api-guards";
import { assertDomainOwnership } from "@/lib/domains/domain-authorization.server";
import {
  addProjectDomainToVercel,
  removeProjectDomainFromVercel,
  verifyProjectDomainOnVercel,
  type VercelDomainAutomationResult,
} from "@/lib/vercel-domain-automation";
import { customDomainLocales } from "@/lib/custom-domain-routing";
import { revalidatePath } from "next/cache";

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

function revalidateOrganizationPublicPaths(organization: { slug: string; type: string }) {
  const section = organization.type === "APPOINTMENT" ? "appointment" : "shop";
  revalidatePath(`/${section}/${organization.slug}`);

  for (const locale of customDomainLocales) {
    revalidatePath(`/${locale}/${section}/${organization.slug}`);
  }
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

    const domain = await assertDomainOwnership(prisma, session.user.id, domainId);

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

    try {
      revalidateOrganizationPublicPaths(updated.organization);
    } catch {
      // Cache revalidation must not break Vercel mutations.
    }

    return NextResponse.json({ domain: updated, vercel });
  } catch (error) {
    return parseError(error);
  }
}
