import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireSuperAdmin } from "@/lib/shop-domain-admin";
import { validateRawDomain } from "@/lib/domains/domain-normalization.server";

const createDomainSchema = z.object({
  domain: z.string().trim().min(3).max(255),
  isPrimary: z.boolean().optional().default(false),
});

function normalizeDomainInput(domain: string) {
  return validateRawDomain(domain);
}

function validateDomain(domain: string) {
  return normalizeDomainInput(domain);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireSuperAdmin(session);
    const { id: organizationId } = await params;

    const domains = await prisma.organizationDomain.findMany({
      where: { organizationId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ domains });
  } catch (error) {
    return jsonError(error, "Failed to load organization domains");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireSuperAdmin(session);
    const { id: organizationId } = await params;
    const body = createDomainSchema.parse(await request.json());
    const normalizedDomain = validateDomain(body.domain);
    if (body.isPrimary) {
      throw new ApiError(400, "Only ACTIVE verified domains can be set as primary");
    }

    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, type: "SHOP", isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (!organization) throw new ApiError(404, "Shop organization not found");

    const domain = await prisma.organizationDomain.create({
      data: {
        organizationId,
        domain: normalizedDomain,
        normalizedDomain,
        status: "DNS_REQUIRED",
        isPrimary: false,
      },
    });

    return NextResponse.json({ domain }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    return jsonError(error, "Failed to create organization domain");
  }
}
