import { NextResponse } from "next/server";
import { prisma } from "@/lib/db-runtime";
import { createPrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { expireOverdueHolds } from "@/lib/hotel/services/hotel-booking.service";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: Array<{ organizationId: string; expired: number; skipped: number }> = [];

  const organizations = await prisma.organization.findMany({
    where: { vertical: "HOTEL" },
    select: { id: true },
  });

  for (const org of organizations) {
    const repos = createPrismaHotelRepositories();
    const result = await expireOverdueHolds(
      { booking: repos, payments: repos, now: () => now },
      { scope: { organizationId: org.id }, now, limit: 100 },
    );
    results.push({ organizationId: org.id, ...result });
  }

  await prisma.$disconnect();
  return NextResponse.json({ ok: true, now: now.toISOString(), results });
}

