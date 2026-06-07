import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";

const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED"] as const;
const TERMINAL_APPOINTMENT_STATUSES = ["COMPLETED", "CANCELLED", "NO_SHOW"] as const;

const APPOINTMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

function generateBookingReference(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

type BookingOwner =
  | { kind: "user"; customerId: string }
  | {
      kind: "guest";
      guestCustomerId: string;
      customerName: string;
      customerPhone?: string | null;
      customerEmail?: string | null;
    };

type TimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type AppointmentConflictScope =
  | { serviceProviderId: string }
  | { serviceId: string };

function parseDateOnly(input: string) {
  const datePart = input.split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new Error("Invalid appointment date");
  }
  return datePart;
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid time format");

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("Invalid time format");
  }

  return { hour, minute };
}

function addDaysToDateOnly(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0, 0));
  return utc.toISOString().slice(0, 10);
}

function getTimeZoneParts(date: Date, timeZone: string): TimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  let hour = Number(values.hour || 0);
  if (hour === 24) hour = 0;

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour,
    minute: Number(values.minute || 0),
    second: Number(values.second || 0),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function localDateTimeToUtc(
  dateOnly: string,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let i = 0; i < 3; i++) {
    const offset = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    const nextUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offset;
    if (Math.abs(nextUtcMs - utcMs) < 1000) break;
    utcMs = nextUtcMs;
  }

  return new Date(utcMs);
}

function getLocalDateString(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getDayOfWeekInTimezone(date: Date, timeZone: string): "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY" {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  });
  const dayName = formatter.format(date).toUpperCase();
  const validDays = ["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
  if (validDays.includes(dayName as (typeof validDays)[number])) {
    return dayName as (typeof validDays)[number];
  }
  throw new Error(`Unable to resolve day of week for timezone ${timeZone}`);
}

function dateRangeOverlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function buildConflictWhere(scope: AppointmentConflictScope, startTime: Date, endTime: Date) {
  return {
    deletedAt: null,
    status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    ...("serviceProviderId" in scope
      ? { service: { serviceProviderId: scope.serviceProviderId } }
      : { serviceId: scope.serviceId }),
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  };
}

function assertAppointmentTransition(currentStatus: string, nextStatus?: string) {
  if (!nextStatus || nextStatus === currentStatus) return;

  const allowed = APPOINTMENT_STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Invalid appointment status transition from ${currentStatus} to ${nextStatus}`);
  }
}

function normalizePositiveInt(value: number | string | undefined, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

export class AppointmentService {
  private async createWithOwner(owner: BookingOwner, data: CreateAppointmentInput) {
    const appointment = await prisma.$transaction(
      async (tx) => {
        const service = await tx.service.findFirst({
          where: {
            id: data.serviceId,
            isActive: true,
            deletedAt: null,
            organization: {
              isActive: true,
              deletedAt: null,
              type: "APPOINTMENT",
            },
          },
          include: {
            organization: true,
          },
        });

        if (!service) {
          throw new Error("Service not found or not available");
        }

        const timezone = service.organization.timezone || "UTC";
        const appointmentDateOnly = parseDateOnly(data.date);
        const requestedStart = new Date(data.startTime);
        if (Number.isNaN(requestedStart.getTime())) {
          throw new Error("Invalid appointment start time");
        }

        const localStartDate = getLocalDateString(requestedStart, timezone);
        if (localStartDate !== appointmentDateOnly) {
          throw new Error("Appointment date does not match the selected start time in organization timezone");
        }

        const startTime = requestedStart;
        const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000);
        const appointmentDate = localDateTimeToUtc(appointmentDateOnly, 0, 0, timezone);
        const scope: AppointmentConflictScope = service.serviceProviderId
          ? { serviceProviderId: service.serviceProviderId }
          : { serviceId: service.id };

        const bookingSettings = await tx.bookingSettings.findUnique({
          where: { organizationSlug: service.organization.slug },
        });

        const now = new Date();
        const minBookingNotice = bookingSettings?.minBookingNotice ?? 60;
        if (startTime.getTime() - now.getTime() < minBookingNotice * 60 * 1000) {
          throw new Error("Appointment is too soon to book");
        }

        const maxBookingAdvance = bookingSettings?.maxBookingAdvance ?? 43200;
        if (startTime.getTime() - now.getTime() > maxBookingAdvance * 60 * 1000) {
          throw new Error("Appointment is too far in the future");
        }

        if (bookingSettings?.maxAppointmentsPerDay) {
          const dayStart = localDateTimeToUtc(appointmentDateOnly, 0, 0, timezone);
          const nextDay = addDaysToDateOnly(appointmentDateOnly, 1);
          const dayEnd = localDateTimeToUtc(nextDay, 0, 0, timezone);
          const dailyCount = await tx.appointment.count({
            where: {
              deletedAt: null,
              status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
              service: { organizationId: service.organizationId },
              startTime: { gte: dayStart, lt: dayEnd },
            },
          });

          if (dailyCount >= bookingSettings.maxAppointmentsPerDay) {
            throw new Error("Daily appointment limit reached");
          }
        }

        const conflicting = await tx.appointment.findFirst({
          where: buildConflictWhere(scope, startTime, endTime),
          select: { id: true },
        });

        if (conflicting) {
          throw new Error("Time slot is not available");
        }

        let bookingReference = generateBookingReference();
        let attempts = 0;
        while (attempts < 10) {
          const existing = await tx.appointment.findUnique({
            where: { bookingReference },
            select: { id: true },
          });
          if (!existing) break;
          bookingReference = generateBookingReference();
          attempts++;
        }

        if (attempts >= 10) {
          throw new Error("Could not generate a unique booking reference");
        }

        let customer:
          | {
              name: string | null;
              firstName: string | null;
              lastName: string | null;
              phone: string | null;
              email: string | null;
            }
          | null = null;

        if (owner.kind === "user") {
          customer = await tx.user.findUnique({
            where: { id: owner.customerId },
            select: {
              name: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          });
        }

        const guestName = owner.kind === "guest" ? owner.customerName : null;
        const guestPhone = owner.kind === "guest" ? owner.customerPhone || null : null;
        const guestEmail = owner.kind === "guest" ? owner.customerEmail || null : null;
        const initialStatus = bookingSettings?.autoConfirm ? "CONFIRMED" : "PENDING";

        return tx.appointment.create({
          data: {
            date: appointmentDate,
            startTime,
            endTime,
            status: initialStatus,
            confirmedAt: initialStatus === "CONFIRMED" ? new Date() : null,
            notes: data.notes,
            customerId: owner.kind === "user" ? owner.customerId : null,
            guestCustomerId: owner.kind === "guest" ? owner.guestCustomerId : null,
            serviceId: data.serviceId,
            bookingReference,
            customerNameAtBooking:
              data.customerName ||
              guestName ||
              (customer
                ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.name
                : null),
            customerPhoneAtBooking: data.customerPhone || guestPhone || customer?.phone || null,
            customerEmailAtBooking: data.customerEmail || guestEmail || customer?.email || null,
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
            guestCustomer: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/dashboard/appointments");
    return appointment;
  }

  async create(customerId: string, data: CreateAppointmentInput) {
    return this.createWithOwner({ kind: "user", customerId }, data);
  }

  async createForGuest(guestCustomerId: string, data: CreateAppointmentInput & { customerName: string }) {
    return this.createWithOwner(
      {
        kind: "guest",
        guestCustomerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone || null,
        customerEmail: data.customerEmail || null,
      },
      data,
    );
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
        guestCustomer: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  async list(params: {
    page?: number | string;
    pageSize?: number | string;
    customerId?: string;
    guestCustomerId?: string;
    serviceId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    organizationId?: string;
    serviceProviderId?: string;
  }) {
    const {
      page: rawPage = 1,
      pageSize: rawPageSize = 20,
      customerId,
      guestCustomerId,
      serviceId,
      status,
      fromDate,
      toDate,
      organizationId,
      serviceProviderId,
    } = params;

    const page = normalizePositiveInt(rawPage, 1, 10000);
    const pageSize = normalizePositiveInt(rawPageSize, 20, 500);

    const serviceWhere: Record<string, string> = {};
    if (organizationId) serviceWhere.organizationId = organizationId;
    if (serviceProviderId) serviceWhere.serviceProviderId = serviceProviderId;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (customerId) where.customerId = customerId;
    if (guestCustomerId) where.guestCustomerId = guestCustomerId;
    if (serviceId) where.serviceId = serviceId;
    if (status) where.status = status;
    if (Object.keys(serviceWhere).length > 0) where.service = serviceWhere;

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
              phone: true,
            },
          },
          guestCustomer: {
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
      include: {
        service: true,
      },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    assertAppointmentTransition(appointment.status, data.status);

    const now = new Date();
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === "CANCELLED" && {
          cancelledAt: appointment.cancelledAt || now,
          cancelledBy: appointment.cancelledBy || userId,
        }),
        ...(data.status === "CONFIRMED" && {
          confirmedAt: appointment.confirmedAt || now,
          confirmedBy: appointment.confirmedBy || userId,
        }),
      },
      include: {
        service: true,
        customer: true,
        guestCustomer: true,
      },
    });

    revalidatePath("/dashboard/appointments");
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

    assertAppointmentTransition(appointment.status, "CANCELLED");

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy: customerId,
      },
    });

    revalidatePath("/dashboard/appointments");
    return updated;
  }

  async reschedule(
    id: string,
    data: { startTime: Date; endTime: Date; date: string },
    actor: { userId: string; organizationId: string; role: UserRole },
  ) {
    if (!hasPermission(actor.role, "appointment:update")) {
      throw new Error("Unauthorized");
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (!appointment.service?.organizationId) {
      throw new Error("Appointment service organization not found");
    }

    if (
      actor.role !== "SUPER_ADMIN" &&
      appointment.service.organizationId !== actor.organizationId
    ) {
      throw new Error("Forbidden");
    }

    if (TERMINAL_APPOINTMENT_STATUSES.includes(appointment.status as (typeof TERMINAL_APPOINTMENT_STATUSES)[number])) {
      throw new Error("Cannot reschedule a completed, cancelled, or no-show appointment");
    }

    const timezone = appointment.service.organization.timezone || "UTC";
    const duration = appointment.service.duration * 60 * 1000;
    const newStart = data.startTime;
    const requestedEnd = data.endTime;
    const newEnd = new Date(newStart.getTime() + duration);
    const clampedEnd =
      requestedEnd.getTime() - newStart.getTime() >= duration / 2 ? requestedEnd : newEnd;

    const newStartDateOnly = getLocalDateString(newStart, timezone);
    const requestedDateOnly = parseDateOnly(data.date);
    if (newStartDateOnly !== requestedDateOnly) {
      throw new Error("Appointment date does not match the selected start time in organization timezone");
    }

    const scope: AppointmentConflictScope = appointment.service.serviceProviderId
      ? { serviceProviderId: appointment.service.serviceProviderId }
      : { serviceId: appointment.service.id };

    const conflicting = await prisma.appointment.findFirst({
      where: {
        ...buildConflictWhere(scope, newStart, clampedEnd),
        id: { not: id },
      },
      select: { id: true },
    });

    if (conflicting) {
      throw new Error("Time slot is not available — conflict detected");
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        date: data.date,
        startTime: newStart,
        endTime: clampedEnd,
      },
      include: {
        service: true,
        customer: true,
        guestCustomer: true,
      },
    });

    revalidatePath("/dashboard/appointments");
    return updated;
  }

  async getAvailableSlots(serviceId: string, date: string) {
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        deletedAt: null,
        organization: {
          isActive: true,
          deletedAt: null,
          type: "APPOINTMENT",
        },
      },
      include: { organization: true },
    });

    if (!service) {
      throw new Error("Service not found");
    }

    if (!service.serviceProviderId) {
      throw new Error("Service provider is not configured");
    }

    const timezone = service.organization.timezone || "UTC";
    const dateOnly = parseDateOnly(date);
    const noonUtc = localDateTimeToUtc(dateOnly, 12, 0, timezone);
    const dayOfWeek = getDayOfWeekInTimezone(noonUtc, timezone);

    const businessHours = await prisma.businessHour.findFirst({
      where: {
        organizationId: service.organizationId,
        userId: service.serviceProviderId,
        day: dayOfWeek,
        isOpen: true,
      },
    }) || await prisma.businessHour.findFirst({
      where: {
        organizationId: service.organizationId,
        userId: null,
        day: dayOfWeek,
        isOpen: true,
      },
    });

    if (!businessHours) {
      return [];
    }

    const bookingSettings = await prisma.bookingSettings.findUnique({
      where: { organizationSlug: service.organization.slug },
    });

    const { hour: openHour, minute: openMinute } = parseTime(businessHours.openTime);
    const { hour: closeHour, minute: closeMinute } = parseTime(businessHours.closeTime);
    const openUtc = localDateTimeToUtc(dateOnly, openHour, openMinute, timezone);
    const closeUtc = localDateTimeToUtc(dateOnly, closeHour, closeMinute, timezone);

    if (closeUtc <= openUtc) {
      return [];
    }

    const scope: AppointmentConflictScope = service.serviceProviderId
      ? { serviceProviderId: service.serviceProviderId }
      : { serviceId: service.id };

    const existingAppointments = await prisma.appointment.findMany({
      where: buildConflictWhere(scope, openUtc, closeUtc),
      select: {
        startTime: true,
        endTime: true,
      },
    });

    const slotStepMinutes = bookingSettings?.slotDuration ?? 30;
    const bufferBefore = bookingSettings?.bufferBefore ?? 0;
    const bufferAfter = bookingSettings?.bufferAfter ?? 0;
    const minBookingNotice = bookingSettings?.minBookingNotice ?? 60;
    const maxBookingAdvance = bookingSettings?.maxBookingAdvance ?? 43200;
    const now = new Date();
    const earliest = new Date(now.getTime() + minBookingNotice * 60 * 1000);
    const latest = new Date(now.getTime() + maxBookingAdvance * 60 * 1000);

    const slots: string[] = [];
    let currentSlot = openUtc;

    while (currentSlot.getTime() + service.duration * 60 * 1000 <= closeUtc.getTime()) {
      const slotEnd = new Date(currentSlot.getTime() + service.duration * 60 * 1000);
      const guardedStart = new Date(currentSlot.getTime() - bufferBefore * 60 * 1000);
      const guardedEnd = new Date(slotEnd.getTime() + bufferAfter * 60 * 1000);

      const isAvailable = !existingAppointments.some((appointment) =>
        dateRangeOverlaps(guardedStart, guardedEnd, appointment.startTime, appointment.endTime),
      );

      if (isAvailable && currentSlot >= earliest && currentSlot <= latest) {
        slots.push(currentSlot.toISOString());
      }

      currentSlot = new Date(currentSlot.getTime() + slotStepMinutes * 60 * 1000);
    }

    return slots;
  }
}

export const appointmentService = new AppointmentService();
