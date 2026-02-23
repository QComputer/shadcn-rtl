import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { 
  createAppointmentSchema, 
  updateAppointmentSchema 
} from "@/lib/validators";
import type { 
  CreateAppointmentInput, 
  UpdateAppointmentInput 
} from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";

export class AppointmentService {
  async create(customerId: string, data: CreateAppointmentInput) {
    // Verify service exists
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
      include: {
        organization: true,
      },
    });

    if (!service || !service.isActive) {
      throw new Error("Service not found or not available");
    }

    // Parse dates
    const appointmentDate = new Date(data.date);
    const startTime = new Date(data.startTime);
    const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000);

    // Check for conflicting appointments
    const conflicting = await prisma.appointment.findFirst({
      where: {
        serviceId: data.serviceId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { endTime: { lte: endTime } },
            ],
          },
        ],
      },
    });

    if (conflicting) {
      throw new Error("Time slot is not available");
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: appointmentDate,
        startTime,
        endTime,
        status: "PENDING",
        notes: data.notes,
        customerId,
        serviceId: data.serviceId,
      },
      include: {
        service: {
          include: {
            organization: true,
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

    revalidatePath(`/dashboard/appointments`);
    return appointment;
  }

  async getById(id: string) {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        service: {
          include: {
            organization: true,
            category: true,
            serviceProvider: {
              select: {
                id: true,
                name: true,
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
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    customerId?: string;
    serviceId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const { 
      page = 1, 
      pageSize = 20, 
      customerId, 
      serviceId, 
      status,
      fromDate,
      toDate 
    } = params;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (customerId) where.customerId = customerId;
    if (serviceId) where.serviceId = serviceId;
    if (status) where.status = status;
    
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) (where.date as Record<string, Date>).gte = new Date(fromDate);
      if (toDate) (where.date as Record<string, Date>).lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startTime: "asc" },
        include: {
          service: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
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
            },
          },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async update(id: string, data: UpdateAppointmentInput, userRole: UserRole, userId: string) {
    if (!hasPermission(userRole, "appointment:update")) {
      throw new Error("Unauthorized");
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Handle cancellation
    if (data.status === "CANCELLED" && !appointment.cancelledAt) {
      data.cancellationReason = data.cancellationReason;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === "CANCELLED" && { 
          cancelledAt: new Date(),
          cancelledBy: userId,
        }),
      },
      include: {
        service: true,
        customer: true,
      },
    });

    revalidatePath(`/dashboard/appointments`);
    return updated;
  }

  async cancel(id: string, customerId: string, reason?: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.customerId !== customerId) {
      throw new Error("Unauthorized");
    }

    if (["COMPLETED", "CANCELLED"].includes(appointment.status)) {
      throw new Error("Cannot cancel this appointment");
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy: customerId,
      },
    });

    revalidatePath(`/dashboard/appointments`);
    return updated;
  }

  async getAvailableSlots(serviceId: string, date: string) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new Error("Service not found");
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.toLocaleDateString("en-US", { weekday: "long" });

    // Get business hours for this day
    const businessHours = await prisma.businessHour.findFirst({
      where: {
        organizationId: service.organizationId,
        day: dayOfWeek as "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY",
        isOpen: true,
      },
    });

    if (!businessHours) {
      return [];
    }

    // Get existing appointments for this service on this date
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        serviceId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startTime: { gte: startOfDay },
        endTime: { lte: endOfDay },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    // Generate available slots
    const slots: string[] = [];
    const [openHour, openMinute] = businessHours.openTime.split(":").map(Number);
    const [closeHour, closeMinute] = businessHours.closeTime.split(":").map(Number);

    let currentTime = new Date(targetDate);
    currentTime.setHours(openHour, openMinute, 0, 0);

    const closeTime = new Date(targetDate);
    closeTime.setHours(closeHour, closeMinute, 0, 0);

    const slotDuration = service.duration;

    while (currentTime.getTime() + slotDuration * 60 * 1000 <= closeTime.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000);
      
      // Check if slot conflicts with existing appointments
      const isAvailable = !existingAppointments.some(apt => {
        return (
          (currentTime >= apt.startTime && currentTime < apt.endTime) ||
          (slotEnd > apt.startTime && slotEnd <= apt.endTime) ||
          (currentTime <= apt.startTime && slotEnd >= apt.endTime)
        );
      });

      if (isAvailable && currentTime > new Date()) {
        slots.push(currentTime.toISOString());
      }

      // Move to next slot (30 minute intervals)
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    return slots;
  }
}

export const appointmentService = new AppointmentService();
