import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission - only staff/admin can confirm
    if (!hasPermission(session.user.role, "appointment:update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: {
          include: { organization: true },
        },
        customer: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Check if already confirmed
    if (appointment.status === "CONFIRMED") {
      return NextResponse.json({ error: "Appointment already confirmed" }, { status: 400 });
    }

    // Check if can be confirmed (not cancelled or completed)
    if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status)) {
      return NextResponse.json(
        { error: `Cannot confirm appointment with status: ${appointment.status}` },
        { status: 400 }
      );
    }

    // Update appointment status
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CONFIRMED",
      },
      include: {
        service: {
          include: {
            organization: true,
            category: true,
            serviceProvider: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Appointment",
        entityId: id,
        description: `Appointment confirmed by ${session.user.name || session.user.id}`,
        previousValue: { status: appointment.status },
        newValue: { status: "CONFIRMED" },
        userId: session.user.id,
        organizationId: appointment.service.organizationId,
      },
    });

    revalidatePath(`/dashboard/appointments`);
    revalidatePath(`/dashboard/calendar`);

    // TODO: Send confirmation notification to customer
    // This would integrate with the notification service

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error confirming appointment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
