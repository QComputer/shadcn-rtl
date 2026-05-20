import { NextRequest, NextResponse } from "next/server";
import { serviceService } from "@/lib/services/service.service";
import { createServiceSchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
} from "@/lib/api-guards";

async function assertProviderBelongsToOrganization(providerId: string | null | undefined, organizationId: string) {
  if (!providerId) return;
  const providerMembership = await prisma.organizationMember.findFirst({
    where: { userId: providerId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!providerMembership) throw new ApiError(400, "Service provider must belong to the selected organization");
}

async function assertCategoryBelongsToOrganization(categoryId: string | undefined, organizationId: string) {
  if (!categoryId) return;
  const category = await prisma.serviceCategory.findFirst({
    where: { id: categoryId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!category) throw new ApiError(400, "Service category must belong to the selected organization");
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const { searchParams } = request.nextUrl;
    let organizationId = searchParams.get("organizationId");

    const params: Record<string, string | boolean | number | undefined> = {};
    params.page = parseInt(searchParams.get("page") || "1", 10);
    params.pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    params.categoryId = searchParams.get("categoryId") || undefined;
    params.isActive = searchParams.get("isActive") === "true" ? true : searchParams.get("isActive") === "false" ? false : undefined;
    params.search = searchParams.get("search") || undefined;

    if (session.user.role === "SUPER_ADMIN" && !organizationId) {
      const services = await serviceService.listAll(params);
      return NextResponse.json({ ...services, data: services.data.map((s) => ({ ...s, price: Number(s.price) })) });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id, isActive: true },
        select: { organizationId: true },
      });
      if (!membership) throw new ApiError(403, "Forbidden");
      if (organizationId && organizationId !== membership.organizationId) throw new ApiError(403, "Forbidden");
      organizationId = membership.organizationId;
    }

    if (!organizationId) throw new ApiError(400, "Organization ID is required");

    const providerFilter = searchParams.get("provider");
    if (providerFilter === "me") {
      const services = await prisma.service.findMany({
        where: {
          serviceProviderId: session.user.id,
          organizationId,
          deletedAt: null,
        },
        include: {
          category: { select: { id: true, name: true } },
          organization: { select: { name: true } },
          _count: { select: { appointments: { where: { status: { in: ["COMPLETED", "CONFIRMED"] } } } } },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json({
        data: services.map((s) => ({ ...s, price: Number(s.price) })),
        total: services.length,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      });
    }

    const services = await serviceService.list(organizationId, params);
    return NextResponse.json({ ...services, data: services.data.map((s) => ({ ...s, price: Number(s.price) })) });
  } catch (error) {
    console.error("Error listing services:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = await request.json();
    const data = createServiceSchema.parse(body);
    const organizationId = await requireCurrentOrganizationId(session, body.organizationId ?? session.user.organizationId);

    await assertCategoryBelongsToOrganization(data.categoryId, organizationId);
    await assertProviderBelongsToOrganization(data.serviceProviderId || session.user.id, organizationId);

    const service = await serviceService.create(organizationId, {
      ...data,
      serviceProviderId: data.serviceProviderId || session.user.id,
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return jsonError(error, "Internal server error");
  }
}
