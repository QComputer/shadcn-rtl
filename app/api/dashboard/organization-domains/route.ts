import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { ApiError, jsonError, requireAuthSession, requireOrgAccess } from "@/lib/api-guards";
import { normalizeDomainHost, validateRawDomain, normalizeDomainInput, getApexDomainInfo, mapVercelStatusToDomainStatus, getDefaultDomainStatus, isEditableDomainStatus } from "@/lib/domains/domain-normalization.server";

const createOrganizationDomainSchema = z.object({
  organizationId: z.string().min(1).optional(),
  domain: z.string().trim().min(3).max(255),
  kind: z.enum(["APEX", "SUBDOMAIN"]).optional(),
  isPrimary: z.boolean().optional().default(false),
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

  return jsonError(error, "Failed to manage organization domains");
}

function domainForResponse(domain: {
  id: string
  organizationId: string
  domain: string
  normalizedDomain: string
  kind: string
  provider: string
  type: string
  status: string
  isPrimary: boolean
  providerVerified: boolean
  dnsConfigured: boolean
  sslReady: boolean
  vercelProjectDomainId: string | null
  verificationType: string | null
  verificationDomain: string | null
  verificationValue: string | null
  lastCheckedAt: Date | null
  verifiedAt: Date | null
  activatedAt: Date | null
  disabledAt: Date | null
  removedAt: Date | null
  reviewedAt: Date | null
  failureReason: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  organization: { id: string; name: string; slug: string; type: string; isActive: boolean } | null
}) {
  return {
    ...domain,
    apexInfo: getApexDomainInfo(domain.normalizedDomain || domain.domain),
  };
}

function buildDomainCreateData(input: {
  organizationId: string
  domain: string
  normalizedDomain: string
  kind: "APEX" | "SUBDOMAIN"
  provider: "VERCEL"
  isPrimary: boolean
  userId: string
}) {
  return {
    organizationId: input.organizationId,
    domain: input.domain.trim().toLowerCase(),
    normalizedDomain: input.normalizedDomain,
    kind: input.kind,
    provider: input.provider,
    type: "CUSTOM" as const,
    status: getDefaultDomainStatus(input.kind, false),
    isPrimary: input.isPrimary,
    createdById: input.userId,
    updatedById: input.userId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const { searchParams } = new URL(request.url);
    const requestedOrganizationId = searchParams.get("organizationId");

    let organizationId: string;
    if (session.user.role === "SUPER_ADMIN" && requestedOrganizationId) {
      organizationId = requestedOrganizationId;
    } else {
      const membership = await requireOrgAccess(session, requestedOrganizationId || session.user.organizationId || "", ["ADMIN", "MANAGER"]);
      organizationId = membership?.organizationId || session.user.organizationId || "";
    }

    const domains = await prisma.organizationDomain.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      include: {
        organization: {
          select: { id: true, name: true, slug: true, type: true, isActive: true },
        },
      },
    });

    return NextResponse.json({ domains: domains.map(domainForResponse) });
  } catch (error) {
    return parseError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = createOrganizationDomainSchema.parse(await request.json());

    const normalizedHost = validateRawDomain(body.domain);
    const normalized = normalizeDomainInput({
      rawDomain: body.domain,
      organizationId: body.organizationId || session.user.organizationId || "",
      kind: body.kind,
    });

    let organizationId: string;
    if (session.user.role === "SUPER_ADMIN" && body.organizationId) {
      organizationId = body.organizationId;
    } else {
      const membership = await requireOrgAccess(session, body.organizationId || session.user.organizationId || "", ["ADMIN", "MANAGER"]);
      organizationId = membership?.organizationId || session.user.organizationId || "";
    }

    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, type: true, isActive: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    const existing = await prisma.organizationDomain.findUnique({
      where: { normalizedDomain: normalized.normalizedDomain },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(409, "Custom domain already exists");
    }

    const domain = await prisma.$transaction(async (tx) => {
      if (body.isPrimary) {
        await tx.organizationDomain.updateMany({
          where: { organizationId },
          data: { isPrimary: false },
        });
      }

      const createData = buildDomainCreateData({
        organizationId,
        domain: body.domain,
        normalizedDomain: normalized.normalizedDomain,
        kind: normalized.kind,
        provider: normalized.provider,
        isPrimary: body.isPrimary,
        userId: session.user.id,
      });

      return tx.organizationDomain.create({
        data: createData,
        include: {
          organization: {
            select: { id: true, name: true, slug: true, type: true, isActive: true },
          },
        },
      });
    });

    await writeAuditLog({
      action: "CREATE",
      entityType: "OrganizationDomain",
      entityId: domain.id,
      description: `Custom domain onboarding requested for ${domain.normalizedDomain} on organization ${organizationId}.`,
      newValue: { domain: domain.normalizedDomain, kind: domain.kind, provider: domain.provider },
      userId: session.user.id,
      organizationId: domain.organizationId,
      ...getClientMeta(request),
    });

    return NextResponse.json({ domain: domainForResponse(domain) }, { status: 201 });
  } catch (error) {
    return parseError(error);
  }
}
