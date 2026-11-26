import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import { appointmentOwnerWhere, appointmentPublicDto, appointmentPublicError, privateAppointmentHeaders, publicAppointmentSelect } from "@/lib/appointments/public-ownership.server";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const slug = request.nextUrl.searchParams.get("organizationSlug");
    // Reject legacy phone/ref URLs rather than continuing to put contact data in logs.
    if (!slug || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || request.nextUrl.searchParams.has("phone") || request.nextUrl.searchParams.has("ref")) throw new ApiError(400, "Invalid request");
    const scope = await appointmentOwnerWhere(request, slug);
    const appointment = await prisma.appointment.findFirst({ where: { ...scope, id }, select: publicAppointmentSelect });
    if (!appointment) throw new ApiError(404, "Appointment unavailable");
    return Response.json({ appointment: appointmentPublicDto(appointment) }, { headers: privateAppointmentHeaders });
  } catch (error) { return appointmentPublicError(error); }
}
