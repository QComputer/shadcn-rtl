import { prisma } from "@/lib/db";

export interface NotificationPayload {
  userId?: string;
  email?: string;
  phone?: string;
  title: string;
  message: string;
  type: "APPOINTMENT_CONFIRMATION" | "APPOINTMENT_REMINDER" | "APPOINTMENT_CANCELLATION" | "APPOINTMENT_RESCHEDULED";
  metadata?: Record<string, unknown>;
}

export interface AppointmentNotificationData {
  appointmentId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  serviceName: string;
  organizationName: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  organizationId: string;
}

export class NotificationService {
  /**
   * Send appointment confirmation notification
   */
  async sendAppointmentConfirmation(data: AppointmentNotificationData): Promise<void> {
    const dateStr = data.date.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    const timeStr = data.startTime.toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const payload: NotificationPayload = {
      userId: undefined, // Will be set if we have the customer's user ID
      email: data.customerEmail || undefined,
      phone: data.customerPhone || undefined,
      title: "تأیید نوبت",
      message: `نوبت شما برای ${data.serviceName} در ${data.organizationName} در تاریخ ${dateStr} ساعت ${timeStr} تأیید شد.`,
      type: "APPOINTMENT_CONFIRMATION",
      metadata: {
        appointmentId: data.appointmentId,
        serviceName: data.serviceName,
        organizationName: data.organizationName,
        date: data.date.toISOString(),
        startTime: data.startTime.toISOString(),
      },
    };

    await this.sendNotification(payload, data.organizationId);
  }

  /**
   * Send appointment reminder notification
   */
  async sendAppointmentReminder(data: AppointmentNotificationData): Promise<void> {
    const dateStr = data.date.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    const timeStr = data.startTime.toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const payload: NotificationPayload = {
      email: data.customerEmail || undefined,
      phone: data.customerPhone || undefined,
      title: "یادآوری نوبت",
      message: `یادآوری: شما نوبت ${data.serviceName} در ${data.organizationName} را در تاریخ ${dateStr} ساعت ${timeStr} دارید.`,
      type: "APPOINTMENT_REMINDER",
      metadata: {
        appointmentId: data.appointmentId,
        serviceName: data.serviceName,
        organizationName: data.organizationName,
        date: data.date.toISOString(),
        startTime: data.startTime.toISOString(),
      },
    };

    await this.sendNotification(payload, data.organizationId);
  }

  /**
   * Send appointment cancellation notification
   */
  async sendAppointmentCancellation(
    data: AppointmentNotificationData,
    reason?: string
  ): Promise<void> {
    const dateStr = data.date.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    const timeStr = data.startTime.toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    let message = `نوبت شما برای ${data.serviceName} در ${data.organizationName} در تاریخ ${dateStr} ساعت ${timeStr} لغو شد.`;
    
    if (reason) {
      message += ` دلیل: ${reason}`;
    }

    const payload: NotificationPayload = {
      email: data.customerEmail || undefined,
      phone: data.customerPhone || undefined,
      title: "لغو نوبت",
      message,
      type: "APPOINTMENT_CANCELLATION",
      metadata: {
        appointmentId: data.appointmentId,
        serviceName: data.serviceName,
        organizationName: data.organizationName,
        reason,
      },
    };

    await this.sendNotification(payload, data.organizationId);
  }

  /**
   * Core notification sending method
   * In production, this would integrate with:
   * - Email service (SendGrid, AWS SES, etc.)
   * - SMS service (Twilio, Kavenegar, etc.)
   * - Push notifications (Firebase, etc.)
   */
  private async sendNotification(
    payload: NotificationPayload,
    organizationId: string
  ): Promise<void> {
    // Log the notification for now
    //console.log(`[Notification] ${payload.type}: ${payload.title}`);
    //console.log(`  To: ${payload.email || payload.phone || "Unknown"}`);
    //console.log(`  Message: ${payload.message}`);

    // Store notification in database for tracking
    // This could be a separate Notification model in the future
    
    // Check organization notification settings. The public settings model is keyed by
    // organization slug, while appointment notification callers pass organization id.
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });

    const settings = organization
      ? await prisma.organizationSettings.findUnique({
          where: { organizationSlug: organization.slug },
        })
      : null;

    if (settings?.emailNotifications && payload.email) {
      // TODO: Send email
      // await this.sendEmail(payload.email, payload.title, payload.message);
      //console.log(`  [Would send email to: ${payload.email}]`);
    }

    if (settings?.smsNotifications && payload.phone) {
      // TODO: Send SMS
      // await this.sendSMS(payload.phone, payload.message);
      //console.log(`  [Would send SMS to: ${payload.phone}]`);
    }

  }

  /**
   * Schedule reminders for upcoming appointments
   * This would typically be called by a cron job
   */
  async scheduleReminders(hoursBefore: number = 24): Promise<void> {
    const reminderTime = new Date();
    reminderTime.setHours(reminderTime.getHours() + hoursBefore);

    // Find appointments that need reminders
    const appointments = await prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        startTime: {
          gte: new Date(),
          lte: reminderTime,
        },
        // Would need a "reminderSent" field to track
      },
      include: {
        service: {
          include: { organization: true },
        },
        customer: true,
        guestCustomer: true,
      },
    });

    for (const apt of appointments) {
      await this.sendAppointmentReminder({
        appointmentId: apt.id,
        customerName: apt.customer
          ? apt.customer.firstName
            ? `${apt.customer.firstName} ${apt.customer.lastName || ""}`
            : apt.customer.name
          : apt.guestCustomer?.name || "no name",
        customerEmail: apt.customer?.email,
        customerPhone: apt.customer?.phone,
        serviceName: apt.service.name,
        organizationName: apt.service.organization.name,
        date: apt.date,
        startTime: apt.startTime,
        endTime: apt.endTime,
        organizationId: apt.service.organizationId,
      });
    }

    //console.log(`[NotificationService] Sent ${appointments.length} reminders`);
  }
}

export const notificationService = new NotificationService();
