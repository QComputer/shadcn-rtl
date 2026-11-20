import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { customerPhoneAuthService } from "@/lib/customer-auth/core.server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, bookingReference, organizationSlug, otpCode } = body;

    if (!organizationSlug) {
      return NextResponse.json({ error: "Organization slug is required" }, { status: 400 });
    }

    // Rate limiting by IP
    const clientIp = getClientIp(request.headers);
    const rateLimit = checkRateLimit({
      key: `appointment-lookup:${clientIp}`,
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug, type: "APPOINTMENT", isActive: true },
      select: { id: true },
    });

    if (!organization) {
      // Generic response to prevent enumeration
      return NextResponse.json({ message: "If the organization exists, tracking information has been sent." });
    }

    // Case 1: Phone-only lookup - anti-enumeration, never returns PII
    if (phone && !bookingReference) {
      // Always return generic message regardless of whether phone matches
      // This prevents enumeration of customers/appointments
      return NextResponse.json({
        message: "If an appointment exists for this phone number, tracking information has been sent."
      });
    }

    // Case 2: Booking reference + OTP verification
    if (bookingReference && otpCode && phone) {
      // First, find appointment by booking reference and verify it belongs to this organization
      // Also check that the provided phone matches the appointment's contact info
      const appointment = await prisma.appointment.findFirst({
        where: {
          bookingReference,
          deletedAt: null,
          service: {
            organizationId: organization.id,
          },
        },
        select: {
          id: true,
          trackingTokenHash: true,
          trackingTokenExpiresAt: true,
          customerPhoneAtBooking: true,
          customer: {
            select: { phone: true },
          },
          guestCustomer: {
            select: { phone: true },
          },
        },
      });

      if (!appointment) {
        // Generic response - don't reveal if appointment exists
        return NextResponse.json({
          message: "If the booking reference is valid and verified, tracking information has been sent."
        });
      }

      // Verify the provided phone matches the appointment's contact info
      const normalizedPhone = phone.replace(/^\+?98|^00?98/, "0");
      const appointmentPhones = [
        appointment.customerPhoneAtBooking,
        appointment.customer?.phone,
        appointment.guestCustomer?.phone,
      ].filter(Boolean).map(p => p!.replace(/^\+?98|^00?98/, "0"));

      const phoneMatches = appointmentPhones.some(p => p === normalizedPhone);

      if (!phoneMatches) {
        // Phone doesn't match appointment - generic response to prevent enumeration
        return NextResponse.json({
          message: "If the booking reference is valid and verified, tracking information has been sent."
        });
      }

      // Phone matches - verify OTP for ownership confirmation
      // Note: customerPhoneAuthService.consume() may create user accounts/memberships.
      // This is a known limitation; for production use, a dedicated appointment-ownership
      // verification flow without side effects should be implemented (GF2+).
      try {
        await customerPhoneAuthService.consume({
          otp: otpCode,
          phone: normalizedPhone,
          organizationId: organization.id,
          origin: request.headers.get("origin") || request.headers.get("referer") || "",
        });
      } catch {
        return NextResponse.json(
          { error: "Invalid or expired verification code" },
          { status: 400 }
        );
      }

      if (!appointment.trackingTokenHash || !appointment.trackingTokenExpiresAt) {
        // Generic response - don't reveal if appointment exists
        return NextResponse.json({
          message: "If the booking reference is valid and verified, tracking information has been sent."
        });
      }

      if (appointment.trackingTokenExpiresAt <= new Date()) {
        return NextResponse.json({ error: "Tracking link has expired" }, { status: 410 });
      }

      // Return the tracking token URL for the client to use
      // In practice, this should be sent via SMS/email to the verified phone
      // For now, return a generic success message
      return NextResponse.json({
        message: "Verification successful. Tracking information has been sent."
      });
    }

    // Case 3: Booking reference only (no OTP) - return generic message
    if (bookingReference && !otpCode) {
      return NextResponse.json({
        message: "To access appointment details, please verify your phone number with the OTP sent to you."
      });
    }

    return NextResponse.json(
      { error: "Phone number or booking reference is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error looking up appointments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}