import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, requireSameOriginMutation } from "@/lib/api-guards";
import { readBoundedJson } from "@/lib/security/bounded-json";
import { appointmentOwnerWhere, appointmentPublicDto, appointmentPublicError, privateAppointmentHeaders, publicAppointmentSelect, publicAppointmentSlug } from "@/lib/appointments/public-ownership.server";

export const dynamic = "force-dynamic";
const inputSchema = z.object({ organizationSlug: z.string().regex(publicAppointmentSlug), bookingReference: z.string().trim().regex(/^[A-Za-z0-9-]{1,64}$/).optional() }).strict();

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const parsed = inputSchema.safeParse(await readBoundedJson(request, { maxBytes: 2048 }));
    if (!parsed.success) throw new ApiError(400, "Invalid request");
    const { organizationSlug, bookingReference } = parsed.data;
    const scope = await appointmentOwnerWhere(request, organizationSlug);
    const appointments = await prisma.appointment.findMany({
      where: { ...scope, ...(bookingReference ? { bookingReference: bookingReference.toUpperCase() } : {}) },
      select: publicAppointmentSelect, orderBy: [{ startTime: "desc" }, { id: "desc" }], take: 51,
    });
    return Response.json({ appointments: appointments.slice(0, 50).map(appointmentPublicDto), hasMore: appointments.length > 50 }, { headers: privateAppointmentHeaders });
  } catch (error) { return appointmentPublicError(error); }
}
