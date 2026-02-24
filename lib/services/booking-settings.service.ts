import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface BookingSettingsInput {
  slotDuration?: number;
  bufferBefore?: number;
  bufferAfter?: number;
  minBookingNotice?: number;
  maxBookingAdvance?: number;
  maxAppointmentsPerDay?: number;
  allowCancellation?: boolean;
  cancellationDeadline?: number;
  requirePhone?: boolean;
  requireEmail?: boolean;
  requireName?: boolean;
  autoConfirm?: boolean;
}

export class BookingSettingsService {
  /**
   * Get booking settings for an organization
   * Creates default settings if none exist
   */
  async getForOrganization(organizationId: string) {
    let settings = await prisma.bookingSettings.findUnique({
      where: { organizationId },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.bookingSettings.create({
        data: { organizationId },
      });
    }

    return settings;
  }

  /**
   * Update booking settings for an organization
   */
  async update(organizationId: string, data: BookingSettingsInput) {
    const settings = await prisma.bookingSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...data,
      },
      update: data,
    });

    revalidatePath(`/dashboard/settings`);
    revalidatePath(`/dashboard/appointments`);
    return settings;
  }

  /**
   * Validate if a booking is allowed based on settings
   */
  async validateBooking(
    organizationId: string,
    appointmentTime: Date,
    existingAppointmentsCount: number
  ): Promise<{ valid: boolean; error?: string }> {
    const settings = await this.getForOrganization(organizationId);
    const now = new Date();

    // Check minimum booking notice
    const minNoticeMs = settings.minBookingNotice * 60 * 1000;
    if (appointmentTime.getTime() - now.getTime() < minNoticeMs) {
      return {
        valid: false,
        error: `Booking must be made at least ${settings.minBookingNotice} minutes in advance`,
      };
    }

    // Check maximum booking advance
    const maxAdvanceMs = settings.maxBookingAdvance * 60 * 1000;
    if (appointmentTime.getTime() - now.getTime() > maxAdvanceMs) {
      return {
        valid: false,
        error: `Booking cannot be made more than ${Math.floor(settings.maxBookingAdvance / 1440)} days in advance`,
      };
    }

    // Check max appointments per day
    if (
      settings.maxAppointmentsPerDay &&
      existingAppointmentsCount >= settings.maxAppointmentsPerDay
    ) {
      return {
        valid: false,
        error: "Maximum number of appointments for this day has been reached",
      };
    }

    return { valid: true };
  }

  /**
   * Check if cancellation is allowed
   */
  async canCancel(
    organizationId: string,
    appointmentTime: Date
  ): Promise<{ canCancel: boolean; error?: string }> {
    const settings = await this.getForOrganization(organizationId);

    if (!settings.allowCancellation) {
      return {
        canCancel: false,
        error: "Cancellation is not allowed for this organization",
      };
    }

    const now = new Date();
    const deadlineMs = settings.cancellationDeadline * 60 * 1000;
    
    if (appointmentTime.getTime() - now.getTime() < deadlineMs) {
      return {
        canCancel: false,
        error: `Cancellation must be made at least ${settings.cancellationDeadline} minutes before the appointment`,
      };
    }

    return { canCancel: true };
  }

  /**
   * Get effective slot duration (considering buffer times)
   */
  async getEffectiveSlotDuration(organizationId: string, serviceDuration: number): Promise<number> {
    const settings = await this.getForOrganization(organizationId);
    
    // Use the larger of: service duration, or configured slot duration
    const baseDuration = Math.max(serviceDuration, settings.slotDuration);
    
    // Add buffer times
    return baseDuration + settings.bufferBefore + settings.bufferAfter;
  }
}

export const bookingSettingsService = new BookingSettingsService();
