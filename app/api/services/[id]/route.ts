import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { serviceService } from "@/lib/services/service.service";
import { updateServiceSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/types";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const service = await serviceService.getById(id);

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Check access - user must be member of the organization
    if (session?.user?.id) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: service.organizationId,
        },
      });

      if (!membership && session.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({
      service: {
        ...service,
        price: Number(service.price),
      },
    });
  } catch (error) {
    console.error("Error getting service:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "service:update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get existing service
    const existingService = await serviceService.getById(id);
    if (!existingService) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Check if user is member of the organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: existingService.organizationId,
      },
    });

    if (!membership && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    
    // Convert null/undefined/empty string values to undefined for optional fields
    const sanitizedBody = { ...body };
    if (sanitizedBody.image === null || sanitizedBody.image === "") sanitizedBody.image = undefined;
    if (sanitizedBody.description === null || sanitizedBody.description === "") sanitizedBody.description = undefined;
    if (sanitizedBody.categoryId === null || sanitizedBody.categoryId === "") sanitizedBody.categoryId = undefined;
    if (sanitizedBody.serviceProviderId === null || sanitizedBody.serviceProviderId === "") sanitizedBody.serviceProviderId = undefined;
    
    const data = updateServiceSchema.partial().parse(sanitizedBody);

    // Convert price to Decimal if provided
    const updateData: Record<string, unknown> = { ...data };
    if (data.price !== undefined) {
      updateData.price = data.price;
    }

    const service = await serviceService.update(id, updateData);

    return NextResponse.json({
      service: {
        ...service,
        price: Number(service.price),
      },
    });
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "service:delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get existing service
    const existingService = await serviceService.getById(id);
    if (!existingService) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Check if user is member of the organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: existingService.organizationId,
      },
    });

    if (!membership && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await serviceService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
