import type { PrismaClient } from "@prisma/client";
import type { ReservationCancellationPolicySnapshot } from "@/lib/hotel/domain/types";
import { PrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";

/**
 * Server-side booking boundary for policy snapshots. Callers provide only the
 * rate-plan identity; the repository verifies tenant/property ownership and
 * active policy state before returning immutable reservation terms.
 */
export async function resolveRatePlanCancellationSnapshot(
  db: PrismaClient,
  input: { organizationId: string; ratePlanId: string },
): Promise<ReservationCancellationPolicySnapshot | null> {
  return new PrismaHotelRepositories(db).resolveRatePlanCancellationPolicy({ organizationId: input.organizationId }, input.ratePlanId);
}
