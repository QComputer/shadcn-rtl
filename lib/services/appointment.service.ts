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

// Generate a unique booking reference
function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

    // Generate unique booking reference
    let bookingReference = generateBookingReference();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.appointment.findUnique({
        where: { bookingReference },
      });
      if (!existing) break;
      bookingReference = generateBookingReference();
      attempts++;
    }

    // Get customer info for snapshot
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: {
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        date: appointmentDate,
        startTime,
        endTime,
        status: "PENDING",
        notes: data.notes,
        customerId,
        serviceId: data.serviceId,
        bookingReference,
        customerNameAtBooking:
          data.customerName ||
          (customer
            ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
            : null),
        customerPhoneAtBooking: data.customerPhone || customer?.phone || null,
        customerEmailAtBooking: data.customerEmail || customer?.email || null,
      },
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
                avatar: true,
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
    organizationId?: string;
    serviceProviderId?: string;
  }) {
    const { 
      page = 1, 
      pageSize = 20, 
      customerId, 
      serviceId, 
      status,
      fromDate,
      toDate,
      organizationId,
      serviceProviderId
    } = params;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (customerId) where.customerId = customerId;
    if (serviceId) where.serviceId = serviceId;
    if (status) where.status = status;
    
    // Filter by organization through Service relation
    if (organizationId) {
      where.service = { organizationId };
    }
    
    // Filter by service provider (staff member)
    if (serviceProviderId) {
      where.service = { 
        ...(where.service as object),
        serviceProviderId 
      };
    }
    
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
      include: { organization: true },
    });

    if (!service?.serviceProviderId) {
      throw new Error("Service not found");
    }

    // Get organization timezone (default to UTC if not set)
    const timezone = service.organization.timezone || "UTC";

    // Parse the date and create a date object in the organization's timezone
    const targetDate = new Date(date);
    
    // Get day of week in organization's timezone
    const dayOfWeek = this.getDayOfWeekInTimezone(targetDate, timezone);

    // Get business hours for this day
    const businessHours = await prisma.businessHour.findFirst({
      where: {
        userId: service.serviceProviderId,
        day: dayOfWeek,
        isOpen: true,
      },
    });
    

    if (!businessHours) {
      return [];
    }

    // Create start and end of day in organization's timezone, then convert to UTC for DB query
    const startOfDay = new Date(date + "T00:00:00.000Z");
    const endOfDay = new Date(date + "T23:59:59.999Z");

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

    // Create slot times in the organization's timezone context
    // We work with the date string directly to avoid timezone conversion issues
    const baseDateStr = date.split("T")[0]; // Get YYYY-MM-DD part
    
    let currentSlot = new Date(`${baseDateStr}T${String(openHour).padStart(2, "0")}:${String(openMinute).padStart(2, "0")}:00.000Z`);
    const closeSlot = new Date(`${baseDateStr}T${String(closeHour).padStart(2, "0")}:${String(closeMinute).padStart(2, "0")}:00.000Z`);

    const slotDuration = service.duration;
    const now = new Date();

    while (currentSlot.getTime() + slotDuration * 60 * 1000 <= closeSlot.getTime()) {
      const slotEnd = new Date(currentSlot.getTime() + slotDuration * 60 * 1000);
      
      // Check if slot conflicts with existing appointments
      const isAvailable = !existingAppointments.some(apt => {
        return (
          (currentSlot >= apt.startTime && currentSlot < apt.endTime) ||
          (slotEnd > apt.startTime && slotEnd <= apt.endTime) ||
          (currentSlot <= apt.startTime && slotEnd >= apt.endTime)
        );
      });

      // Only include slots that are in the future
      if (isAvailable && currentSlot > now) {
        slots.push(currentSlot.toISOString());
      }

      // Move to next slot (30 minute intervals)
      currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
    }

    return slots;
  }

  // Helper method to get day of week in a specific timezone
  private getDayOfWeekInTimezone(date: Date, timezone: string): "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY" {
    try {
      // Use Intl.DateTimeFormat to get day in specific timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
      });
      const dayName = formatter.format(date).toUpperCase();
      
      // Validate and return the day
      const validDays = [ "SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY",] as const;
      if (validDays.includes(dayName as typeof validDays[number])) {
        return dayName as typeof validDays[number];
      }
      
      // Fallback to UTC day if invalid
      return date.toLocaleDateString("fa", { weekday: "long" }).toUpperCase() as typeof validDays[number];
    } catch {
      // Fallback to local day if timezone is invalid
      const days = [ "SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
      return days[date.getDay()];
    }
  }
}

export const appointmentService = new AppointmentService();
