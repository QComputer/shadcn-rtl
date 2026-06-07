import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, requireAuthSession } from "@/lib/api-guards";

const RATE_LIMIT_WINDOW_MS = 10_000;
const driverLastLocation = new Map<string, { ts: number }>();

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();

    if (session.user.role !== "DRIVER") {
      throw new ApiError(403, "Forbidden");
    }

    const body = await request.json().catch(() => ({}));
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Number(body.accuracy ?? NaN);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new ApiError(400, "Valid latitude and longitude are required");
    }

    const now = Date.now();
    const last = driverLastLocation.get(session.user.id);
    if (last && now - last.ts < RATE_LIMIT_WINDOW_MS) {
      throw new ApiError(429, "Location updates are limited to once every 10 seconds");
    }

    await prisma.location.create({
      data: {
        userId: session.user.id,
        organizationId: null,
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
      },
    });

    driverLastLocation.set(session.user.id, { ts: now });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating driver location:", error);
    return NextResponse.json(
      { error: error instanceof ApiError ? error.message : "Internal server error" },
      { status: error instanceof ApiError ? error.status : 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();

    if (!["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      throw new ApiError(403, "Forbidden");
    }

    const since = request.nextUrl.searchParams.get("since");
    const where: Record<string, unknown> = {};
    if (since) {
      where.timestamp = { gte: new Date(since) };
    }

    const rows = await prisma.location.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 500,
      include: {
        user: {
          select: { id: true, name: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    const latestByDriver = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      if (!latestByDriver.has(row.userId)) {
        latestByDriver.set(row.userId, row);
      }
    }

    return NextResponse.json({ data: Array.from(latestByDriver.values()) });
  } catch (error) {
    console.error("Error fetching driver locations:", error);
    return NextResponse.json(
      { error: error instanceof ApiError ? error.message : "Internal server error" },
      { status: error instanceof ApiError ? error.status : 500 }
    );
  }
}
