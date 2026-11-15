import { createHash } from "node:crypto";
import { prisma } from "@/lib/db-runtime";
import { hotelPaymentReceiptLockId, listStaleHotelPaymentReceipts, removeHotelPaymentReceipt } from "@/lib/hotel/offline-payments/receipt-storage.server";

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const organizationId = option("organization-id");
  const olderThanHours = Number(option("older-than-hours"));
  const limit = Number(option("limit"));
  const apply = process.argv.includes("--apply");
  if (process.env.HOTEL_RECEIPT_ORPHAN_RECONCILE_ENABLED !== "1" || !organizationId
    || !Number.isInteger(olderThanHours) || olderThanHours < 24 || olderThanHours > 8760
    || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Require explicit reconciliation enablement, one organization, age >= 24h, and limit 1..100.");
  }
  const expectedDatabase = process.env.HOTEL_RECEIPT_RECONCILE_EXPECTED_DATABASE;
  const expectedRole = process.env.HOTEL_RECEIPT_RECONCILE_EXPECTED_ROLE;
  const expectedHost = process.env.HOTEL_RECEIPT_RECONCILE_EXPECTED_HOST;
  if (!expectedDatabase || !expectedRole || !expectedHost) throw new Error("Set the expected database, role, and server host after verifying the target identity.");
  try {
    const identity = await prisma.$queryRaw<Array<{ database: string; role: string; host: string }>>`SELECT current_database()::text AS database, current_user::text AS role, COALESCE(inet_server_addr()::text, 'local-socket') AS host`;
    if (identity.length !== 1 || identity[0].database !== expectedDatabase || identity[0].role !== expectedRole || identity[0].host !== expectedHost) {
      throw new Error("Connected PostgreSQL identity does not match the explicitly expected target.");
    }
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const candidates = await listStaleHotelPaymentReceipts({ organizationId, olderThan: cutoff, limit });
    let deleted = 0;
    for (const key of candidates) {
      const lockId = hotelPaymentReceiptLockId(organizationId, key);
      const action = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockId}) IS NULL AS acquired`;
        const referenced = await tx.hotelOfflinePayment.findFirst({ where: { organizationId, receiptKey: key }, select: { id: true } });
        if (referenced) return "PRESERVE_REFERENCED" as const;
        if (!apply) return "DRY_RUN_ELIGIBLE" as const;
        // Keep the tenant/key lock until deletion commits so upload association
        // cannot race the reference check and leave a dangling DB key.
        await removeHotelPaymentReceipt(organizationId, key);
        return "DELETE" as const;
      });
      if (action === "DELETE") deleted += 1;
      console.log(JSON.stringify({ action, organizationId, receiptFingerprint: createHash("sha256").update(key).digest("hex").slice(0, 12), reason: action === "PRESERVE_REFERENCED" ? "DATABASE_REFERENCE_EXISTS" : "OLDER_THAN_GRACE_AND_UNREFERENCED" }));
    }
    console.log(JSON.stringify({ result: "COMPLETE", databaseVerified: true, organizationId, candidateCount: candidates.length, deletedCount: deleted, apply }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Receipt reconciliation failed.");
  process.exitCode = 1;
});
