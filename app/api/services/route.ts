import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { serviceService } from "@/lib/services/service.service";
import { createServiceSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/types";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = request.nextUrl;
    
    // Get organizationId from query or from user's membership
    let organizationId = searchParams.get("organizationId");
    
    // If not provided, try to get from user's membership
    if (!organizationId && session?.user?.id) {
      // Check if user is SUPER_ADMIN - they can access any organization
      if (session.user.role === "SUPER_ADMIN") {
        // For SUPER_ADMIN, if no org specified, return all services across all organizations
        if (!organizationId) {
          const params: Record<string, string | boolean | number | undefined> = {};
          params.page = parseInt(searchParams.get("page") || "1");
          params.pageSize = parseInt(searchParams.get("pageSize") || "20");
          params.categoryId = searchParams.get("categoryId") || undefined;
          params.isActive = searchParams.get("isActive") === "true" ? true : searchParams.get("isActive") === "false" ? false : undefined;
          params.search = searchParams.get("search") || undefined;

          // Get all services without organization filter for SUPER_ADMIN
          const services = await serviceService.listAll(params);

          return NextResponse.json({
            ...services,
            data: services.data.map(s => ({ ...s, price: Number(s.price) })),
          });
        }
      } else {
        // Regular user - get from membership
        const membership = await prisma.organizationMember.findFirst({
          where: { userId: session.user.id },
          select: { organizationId: true },
        });
        if (membership) {
          organizationId = membership.organizationId;
        }
      }
    }

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    // Check if user is provider=me (services assigned to current user)
    const providerFilter = searchParams.get("provider");
    if (providerFilter === "me" && session?.user?.id) {
      // Return services where user is the service provider
      const services = await prisma.service.findMany({
        where: {
          serviceProviderId: session.user.id,
          organizationId,
          deletedAt: null,
        },
        include: {
          category: {
            select: { id: true, name: true },
          },
          organization: {
            select: { name: true },
          },
          _count: {
            select: {
              appointments: {
                where: { status: { in: ["COMPLETED", "CONFIRMED"] } },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json({
        data: services.map(s => ({ ...s, price: Number(s.price) })),
        total: services.length,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      });
    }

    const params: Record<string, string | boolean | number | undefined> = {};
    params.page = parseInt(searchParams.get("page") || "1");
    params.pageSize = parseInt(searchParams.get("pageSize") || "20");
    params.categoryId = searchParams.get("categoryId") || undefined;
    params.isActive = searchParams.get("isActive") === "true" ? true : searchParams.get("isActive") === "false" ? false : undefined;
    params.search = searchParams.get("search") || undefined;

    const services = await serviceService.list(organizationId, params);

    return NextResponse.json({
      ...services,
      data: services.data.map(s => ({ ...s, price: Number(s.price) })),
    });
  } catch (error) {
    console.error("Error listing services:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "service:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = createServiceSchema.parse(body);

    let { organizationId, ...serviceData } = body;
    
    // If organizationId not provided, get from user's membership
    if (!organizationId) {
      // For SUPER_ADMIN, organizationId is required
      if (session.user.role === "SUPER_ADMIN") {
        return NextResponse.json({ error: "Organization ID is required for SUPER_ADMIN" }, { status: 400 });
      }
      
      // For regular users, get from membership
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });
      
      if (!membership) {
        return NextResponse.json({ error: "You must be a member of an organization" }, { status: 400 });
      }
      
      organizationId = membership.organizationId;
    }

     // Assign current user as service provider if not specified
    const service = await serviceService.create(organizationId, {
      ...serviceData,
      ...data,
      serviceProviderId: data.serviceProviderId || session.user.id,
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
