import { Prisma } from "@prisma/client";

export type HotelGuestRequestEndpoint = "create" | "status";
type Db = { $queryRaw(query: Prisma.Sql): Promise<unknown> };
export type HotelGuestRequestRate = { allowed: boolean; remaining: number; resetAt: number; retryAfterSeconds: number; storeUnavailable: boolean };

const budgets: Record<HotelGuestRequestEndpoint, { limit: number; windowMs: number }> = {
  // Tenant aggregates (60 create/min, 240 status/min), not per-guest fairness:
  // one guest can affect others; each fixed window lasts 60s, and sustained
  // abuse can exhaust consecutive windows.
  // Tune using operational traffic evidence. Client IP headers remain untrusted.
  create: { limit: 60, windowMs: 60_000 },
  status: { limit: 240, windowMs: 60_000 },
};

/**
 * Atomically enforce one durable, shared fixed window per verified tenant and
 * endpoint. The database clock is authoritative; failures deny with 503.
 */
export async function checkHotelGuestRequestRateLimit(input: {
  organizationId: string;
  endpoint: HotelGuestRequestEndpoint;
  db?: Db;
}): Promise<HotelGuestRequestRate> {
  const { limit, windowMs } = budgets[input.endpoint];
  try {
    const db = input.db ?? (await import("@/lib/db-runtime")).prisma;
    const rows = await db.$queryRaw(Prisma.sql`
      INSERT INTO "HotelGuestRequestRateLimit" ("organizationId", "endpoint", "count", "windowStartedAt")
      VALUES (${input.organizationId}, ${input.endpoint}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("organizationId", "endpoint") DO UPDATE SET
        "count" = CASE
          WHEN "HotelGuestRequestRateLimit"."windowStartedAt" + (${windowMs}::double precision * INTERVAL '1 millisecond') <= CURRENT_TIMESTAMP THEN 1
          ELSE LEAST("HotelGuestRequestRateLimit"."count" + 1, ${limit + 1})
        END,
        "windowStartedAt" = CASE
          WHEN "HotelGuestRequestRateLimit"."windowStartedAt" + (${windowMs}::double precision * INTERVAL '1 millisecond') <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
          ELSE "HotelGuestRequestRateLimit"."windowStartedAt"
        END
      RETURNING "count", "windowStartedAt", CURRENT_TIMESTAMP AS "dbNow"
    `) as Array<{ count: number; windowStartedAt: Date; dbNow: Date }>;
    const row = rows[0];
    if (!row) throw new Error("rate limit upsert returned no row");
    const resetAt = row.windowStartedAt.getTime() + windowMs;
    const allowed = row.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - row.count),
      resetAt,
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - row.dbNow.getTime()) / 1000)),
      storeUnavailable: false,
    };
  } catch {
    const now = Date.now();
    return { allowed: false, remaining: 0, resetAt: now + 1000, retryAfterSeconds: 1, storeUnavailable: true };
  }
}
