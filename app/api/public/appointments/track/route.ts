import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";
import { resolveTenantPwaRequestContext } from "@/lib/tenant-pwa-context.server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token : "";

    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return securedJson({ error: "Invalid tracking token" }, 400);
    }

    // Hash the provided token to look up in database
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const tenant = await resolveTenantPwaRequestContext(request.headers);
    if (tenant.kind !== "tenant") {
      return securedJson({ error: "Appointment not found or tracking expired" }, 404);
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        trackingTokenHash: tokenHash,
        trackingTokenExpiresAt: { gt: new Date() },
        deletedAt: null,
        service: { organizationId: tenant.organizationId },
      },
      select: {
        bookingReference: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        service: {
          select: {
            name: true,
            duration: true,
            price: true,
            organization: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      return securedJson({ error: "Appointment not found or tracking expired" }, 404);
    }

    return securedJson({
      appointment: {
        bookingReference: appointment.bookingReference,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        service: {
          name: appointment.service.name,
          duration: appointment.service.duration,
          price: Number(appointment.service.price),
          organization: appointment.service.organization,
        },
      },
    });
  } catch (error) {
    console.error("Error getting appointment by tracking token");
    return securedJson({ error: "Internal server error" }, 500);
  }
}

function securedJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  } });
}
