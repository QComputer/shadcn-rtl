import { NextResponse } from "next/server";
import { prisma } from "@/lib/db-runtime";
import { createPrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { expireOverdueHolds } from "@/lib/hotel/services/hotel-booking.service";

function authenticate(request: Request): boolean {
  // Runflare Cron: GET with Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return process.env.CRON_SECRET && token === process.env.CRON_SECRET;
  }
  // Legacy external scheduler: POST with x-cron-secret header
  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret) {
    return process.env.CRON_SECRET && headerSecret === process.env.CRON_SECRET;
  }
  return false;
}

function isOperational(): boolean {
  return process.env.HOTEL_ANONYMOUS_HOLD_OPERATIONAL_ENABLED === "1";
}

async function executeExpiration(now: Date) {
  const results: Array<{
    organizationId: string;
    expired: number;
    skipped: number;
    error?: string;
  }> = [];

  const organizations = await prisma.organization.findMany({
    where: { vertical: "HOTEL" },
    select: { id: true },
  });

  for (const org of organizations) {
    const repos = createPrismaHotelRepositories();
    try {
      const result = await expireOverdueHolds(
        { booking: repos, payments: repos, now: () => now },
        { scope: { organizationId: org.id }, now, limit: 100 },
      );
      results.push({ organizationId: org.id, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[cron:expire-holds] org=${org.id} error:`, message);
      results.push({ organizationId: org.id, expired: 0, skipped: 0, error: message });
    }
  }

  return results;
}

export async function GET(request: Request) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const results = await executeExpiration(now);

  const totalExpired = results.reduce((sum, r) => sum + r.expired, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const hasErrors = results.some((r) => r.error);

  return NextResponse.json({
    ok: !hasErrors,
    partial: hasErrors,
    now: now.toISOString(),
    totalExpired,
    totalSkipped,
    organizations: results.length,
    results,
  });
}

export async function POST(request: Request) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const results = await executeExpiration(now);

  const totalExpired = results.reduce((sum, r) => sum + r.expired, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const hasErrors = results.some((r) => r.error);

  return NextResponse.json({
    ok: !hasErrors,
    partial: hasErrors,
    now: now.toISOString(),
    totalExpired,
    totalSkipped,
    organizations: results.length,
    results,
  });
}

