import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireAuthSession, requireCurrentOrgAdminOrManager } from "@/lib/api-guards";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const { searchParams } = request.nextUrl;
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "20", 10), 1), 100);
    const search = searchParams.get("search")?.trim();
    const role = searchParams.get("role");
    const isActive = searchParams.get("isActive");

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (session.user.role !== "SUPER_ADMIN") {
      const membership = await requireCurrentOrgAdminOrManager(session);
      where.memberOf = {
        some: {
          organizationId: membership?.organizationId,
          isActive: true,
        },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) where.role = role;
    if (isActive !== null) where.isActive = isActive === "true";

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          isTeamMember: true,
          locale: true,
          createdAt: true,
          memberOf: {
            where: session.user.role === "SUPER_ADMIN" ? undefined : { isActive: true },
            orderBy: { joinedAt: "desc" },
            include: {
              organization: {
                select: { id: true, name: true, slug: true, type: true },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const normalizedData = data.map((user) => ({
      ...user,
      memberships: user.memberOf,
      memberOf: user.memberOf[0] ?? null,
    }));

    return NextResponse.json({
      data: normalizedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error listing users:", error);
    return jsonError(error, "Internal server error");
  }
}
