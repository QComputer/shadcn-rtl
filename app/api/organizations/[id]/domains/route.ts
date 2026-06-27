import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, resolveManageableOrganizationId } from "@/lib/api-guards";
import { normalizeDomainHost } from "@/lib/custom-domain-routing";

const createDomainSchema = z.object({
  domain: z.string().trim().min(3).max(255),
  isPrimary: z.boolean().optional().default(false),
});

function normalizeDomainInput(domain: string) {
  return normalizeDomainHost(domain);
}

function validateDomain(domain: string) {
  const normalizedDomain = normalizeDomainInput(domain);
  if (!normalizedDomain || normalizedDomain === "localhost" || normalizedDomain.endsWith(".localhost")) {
    throw new ApiError(400, "Invalid custom domain");
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedDomain)) {
    throw new ApiError(400, "Domain must be a valid hostname, such as example.ir");
  }
  return normalizedDomain;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);

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
    const { id } = await params;
    const organizationId = await resolveManageableOrganizationId(session, id);
    const body = createDomainSchema.parse(await request.json());
    const normalizedDomain = validateDomain(body.domain);

    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, type: "SHOP", isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (!organization) throw new ApiError(404, "Shop organization not found");

    const domain = await prisma.$transaction(async (tx) => {
      if (body.isPrimary) {
        await tx.organizationDomain.updateMany({
          where: { organizationId },
          data: { isPrimary: false },
        });
      }

      return tx.organizationDomain.create({
        data: {
          organizationId,
          domain: body.domain.trim().toLowerCase(),
          normalizedDomain,
          status: "DNS_REQUIRED",
          isPrimary: body.isPrimary,
        },
      });
    });

    return NextResponse.json({ domain }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    return jsonError(error, "Failed to create organization domain");
  }
}
