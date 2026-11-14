import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  HotelOfflinePaymentRepository,
  OfflinePaymentCommand,
  OfflinePaymentCommandResult,
  OfflinePaymentLedgerEntry,
} from "@/lib/hotel/offline-payments/service";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;
type RawLedger = {
  id: string;
  organizationId: string;
  reservationId: string;
  method: string;
  status: string;
  amountToman: bigint;
  idempotencyKey: string | null;
  recordedByUserId: string;
  verifiedByUserId: string | null;
  bankReference: string | null;
  receiptKey: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
};

type ReservationBalance = {
  id: string;
  totalAmount: bigint;
  paidAmount: bigint;
  status: string;
  currency: string;
  guestCustomerId: string | null;
};

const TABLE = Prisma.raw('"HotelOfflinePayment"');
const IDEMPOTENCY_TABLE = Prisma.raw('"HotelOfflinePaymentCommandIdempotency"');

function operation(command: OfflinePaymentCommand) {
  switch (command.type) {
    case "RECORD_CASH": return "RECORD_CASH" as const;
    case "SUBMIT_BANK_TRANSFER": return "SUBMIT_BANK_TRANSFER" as const;
    case "VERIFY_BANK_TRANSFER": return "VERIFY_BANK_TRANSFER" as const;
  }
}

function fingerprint(command: OfflinePaymentCommand) {
  const payload = command.type === "VERIFY_BANK_TRANSFER"
    ? { type: command.type, organizationId: command.organizationId, reservationId: command.reservationId, ledgerEntryId: command.ledgerEntryId, actorUserId: command.actorUserId }
    : { type: command.type, organizationId: command.organizationId, reservationId: command.reservationId, actorUserId: command.actorUserId, amountToman: command.amountToman.toString(), ...(command.type === "SUBMIT_BANK_TRANSFER" ? { bankReference: command.bankReference, receiptPending: command.receiptPending } : {}) };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function mapEntry(row: RawLedger): OfflinePaymentLedgerEntry | null {
  if ((row.method !== "CASH" && row.method !== "BANK_TRANSFER") || (row.status !== "SUBMITTED" && row.status !== "VERIFIED") || !row.idempotencyKey) return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    reservationId: row.reservationId,
    method: row.method,
    status: row.status,
    amountToman: row.amountToman,
    idempotencyKey: row.idempotencyKey,
    recordedByUserId: row.recordedByUserId,
    ...(row.verifiedByUserId ? { verifiedByUserId: row.verifiedByUserId } : {}),
    ...(row.bankReference ? { bankReference: row.bankReference } : {}),
    ...(row.method === "BANK_TRANSFER" ? { receiptAttached: Boolean(row.receiptKey?.trim()) } : {}),
    createdAt: row.createdAt,
    ...(row.verifiedAt ? { verifiedAt: row.verifiedAt } : {}),
  };
}

/**
 * PostgreSQL implementation of the offline ledger contract.
 *
 * The reservation row is locked before reading its balance. Every verified
 * money mutation and ledger state change then commits in the same transaction.
 * Transfer submissions do not change `paidAmount`, reservation status, or a
 * balance reservation; later verification checks the live verified balance.
 */
export class PrismaHotelOfflinePaymentRepository implements HotelOfflinePaymentRepository {
  constructor(private readonly client: Db) {}

  async applyOfflinePaymentCommand(command: OfflinePaymentCommand): Promise<OfflinePaymentCommandResult> {
    if (!command.organizationId.trim() || !command.reservationId.trim() || !command.actorUserId.trim() || !command.idempotencyKey.trim()) return { outcome: "INVALID_INPUT" };
    if (command.idempotencyKey.length > 200) return { outcome: "INVALID_INPUT" };
    if (command.type !== "VERIFY_BANK_TRANSFER" && command.amountToman <= BigInt(0)) return { outcome: "INVALID_AMOUNT" };
    if (command.type === "SUBMIT_BANK_TRANSFER" && ((!command.bankReference.trim() && !command.receiptPending) || command.bankReference.length > 160)) return { outcome: "INVALID_INPUT" };

    return this.client.$transaction((tx) => this.applyInTransaction(tx, command), {
      maxWait: 5_000,
      timeout: 10_000,
    });
  }

  private async applyInTransaction(tx: Tx, command: OfflinePaymentCommand): Promise<OfflinePaymentCommandResult> {
    const op = operation(command);
    const requestFingerprint = fingerprint(command);
    const placeholderId = randomUUID();
    const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO ${IDEMPOTENCY_TABLE}
        ("id", "organizationId", "operation", "idempotencyKey", "requestFingerprint", "status", "createdAt")
      VALUES (${placeholderId}, ${command.organizationId}, ${op}::"HotelOfflinePaymentCommandType", ${command.idempotencyKey}, ${requestFingerprint}, 'PROCESSING', ${command.now})
      ON CONFLICT ("organizationId", "operation", "idempotencyKey") DO NOTHING
      RETURNING "id"
    `);
    const claimsKey = inserted.length === 1;
    const idempotencyRows = await tx.$queryRaw<Array<{ requestFingerprint: string; status: string; ledgerEntryId: string | null }>>(Prisma.sql`
      SELECT "requestFingerprint", "status", "ledgerEntryId"
      FROM ${IDEMPOTENCY_TABLE}
      WHERE "organizationId" = ${command.organizationId}
        AND "operation" = ${op}::"HotelOfflinePaymentCommandType"
        AND "idempotencyKey" = ${command.idempotencyKey}
      FOR UPDATE
    `);
    const idempotency = idempotencyRows[0];
    if (!idempotency) throw new Error("Offline payment idempotency claim disappeared inside transaction.");
    if (!claimsKey) {
      if (idempotency.requestFingerprint !== requestFingerprint) return { outcome: "IDEMPOTENCY_CONFLICT" };
      if (idempotency.status !== "COMPLETED" || !idempotency.ledgerEntryId) return { outcome: "PAYMENT_NOT_PENDING" };
      const replayReservation = await tx.$queryRaw<Array<{ guestCustomerId: string | null }>>(Prisma.sql`
        SELECT "guestCustomerId" FROM "HotelReservation"
        WHERE "id" = ${command.reservationId} AND "organizationId" = ${command.organizationId}
      `);
      if (!replayReservation[0]) return { outcome: "NOT_FOUND" };
      if (!await this.isAuthorized(tx, command, replayReservation[0].guestCustomerId)) return { outcome: "UNAUTHORIZED" };
      const replayRows = await tx.$queryRaw<RawLedger[]>(Prisma.sql`
        SELECT p."id", p."organizationId", p."reservationId", p."method"::text AS "method", p."status"::text AS "status",
          p."amountToman", (SELECT c."idempotencyKey" FROM ${IDEMPOTENCY_TABLE} c WHERE c."ledgerEntryId" = p."id" AND c."operation"::text IN ('RECORD_CASH', 'SUBMIT_BANK_TRANSFER') LIMIT 1) AS "idempotencyKey",
          p."recordedByUserId", p."verifiedByUserId", p."bankReference", p."receiptKey", p."createdAt", p."verifiedAt"
        FROM ${TABLE} p
        WHERE p."id" = ${idempotency.ledgerEntryId} AND p."organizationId" = ${command.organizationId}
      `);
      const replay = replayRows[0] && mapEntry(replayRows[0]);
      return replay ? { outcome: "REPLAY", entry: replay } : { outcome: "NOT_FOUND" };
    }

    const reservationRows = await tx.$queryRaw<ReservationBalance[]>(Prisma.sql`
      SELECT "id", "totalAmount", "paidAmount", "status", "currency", "guestCustomerId"
      FROM "HotelReservation"
      WHERE "id" = ${command.reservationId} AND "organizationId" = ${command.organizationId}
      FOR UPDATE
    `);
    const reservation = reservationRows[0];
    if (!reservation) {
      await this.removePlaceholder(tx, command);
      return { outcome: "NOT_FOUND" };
    }

    // A lock on the reservation serializes this gate with cancellation and
    // expiry transitions. Ordinary collection never acts as reconciliation.
    if (!(["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as string[]).includes(reservation.status) || reservation.currency !== "TOMAN") {
      await this.removePlaceholder(tx, command);
      return { outcome: "PAYMENT_NOT_PENDING" };
    }
    const authorized = await this.isAuthorized(tx, command, reservation.guestCustomerId);
    if (!authorized) {
      await this.removePlaceholder(tx, command);
      return { outcome: "UNAUTHORIZED" };
    }

    if (command.type === "VERIFY_BANK_TRANSFER") {
      const candidateRows = await tx.$queryRaw<RawLedger[]>(Prisma.sql`
        SELECT p."id", p."organizationId", p."reservationId", p."method"::text AS "method", p."status"::text AS "status",
          p."amountToman", (SELECT c."idempotencyKey" FROM ${IDEMPOTENCY_TABLE} c WHERE c."ledgerEntryId" = p."id" AND c."operation"::text IN ('RECORD_CASH', 'SUBMIT_BANK_TRANSFER') LIMIT 1) AS "idempotencyKey",
          p."recordedByUserId", p."verifiedByUserId", p."bankReference", p."receiptKey", p."createdAt", p."verifiedAt"
        FROM ${TABLE} p
        WHERE p."id" = ${command.ledgerEntryId} AND p."organizationId" = ${command.organizationId}
          AND p."reservationId" = ${command.reservationId}
        FOR UPDATE
      `);
      const candidate = candidateRows[0];
      if (!candidate) {
        await this.removePlaceholder(tx, command);
        return { outcome: "NOT_FOUND" };
      }
      if (candidate.method !== "BANK_TRANSFER" || candidate.status !== "SUBMITTED") {
        await this.removePlaceholder(tx, command);
        return { outcome: "PAYMENT_NOT_PENDING" };
      }
      if (!candidate.bankReference?.trim() && !candidate.receiptKey?.trim()) {
        await this.removePlaceholder(tx, command);
        return { outcome: "PAYMENT_NOT_PENDING" };
      }
      if (reservation.paidAmount + candidate.amountToman > reservation.totalAmount) {
        await this.removePlaceholder(tx, command);
        return { outcome: "OVERPAYMENT" };
      }
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE ${TABLE}
        SET "status" = 'VERIFIED'::"HotelOfflinePaymentStatus", "verifiedByUserId" = ${command.actorUserId}, "verifiedAt" = ${command.now}
        WHERE "id" = ${candidate.id} AND "organizationId" = ${command.organizationId}
          AND "reservationId" = ${command.reservationId} AND "method" = 'BANK_TRANSFER'::"HotelOfflinePaymentMethod"
          AND "status" = 'SUBMITTED'::"HotelOfflinePaymentStatus"
      `);
      if (changed !== 1) {
        await this.removePlaceholder(tx, command);
        return { outcome: "PAYMENT_NOT_PENDING" };
      }
      const updatedBalance = await tx.$executeRaw(Prisma.sql`
        UPDATE "HotelReservation"
        SET "paidAmount" = "paidAmount" + ${candidate.amountToman}, "updatedAt" = ${command.now}
        WHERE "id" = ${command.reservationId} AND "organizationId" = ${command.organizationId}
          AND "paidAmount" + ${candidate.amountToman} <= "totalAmount"
      `);
      if (updatedBalance !== 1) throw new Error("Locked reservation balance changed during offline transfer verification.");
      await this.completeIdempotency(tx, command, candidate.id);
      const verified = { ...candidate, status: "VERIFIED", verifiedByUserId: command.actorUserId, verifiedAt: command.now };
      const entry = mapEntry(verified);
      return entry ? { outcome: "APPLIED", entry } : { outcome: "NOT_FOUND" };
    }

    if (command.type === "SUBMIT_BANK_TRANSFER") {
      // Reference matching is tenant-scoped and case-insensitive. The
      // transaction lock makes the check safe when two requests use different
      // idempotency keys at the same time. Hash collisions only serialize
      // unrelated references; they cannot permit a duplicate.
      const normalizedReference = command.bankReference.trim().toLocaleLowerCase("en-US");
      if (normalizedReference) {
        await tx.$executeRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([command.organizationId, normalizedReference])}, 0))
        `);
        const existingReference = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM ${TABLE}
          WHERE "organizationId" = ${command.organizationId}
            AND lower(btrim("bankReference")) = ${normalizedReference}
          LIMIT 1
        `);
        if (existingReference.length > 0) {
          await this.removePlaceholder(tx, command);
          return { outcome: "PAYMENT_NOT_PENDING" };
        }
      }
    }

    if (reservation.paidAmount + command.amountToman > reservation.totalAmount) {
      await this.removePlaceholder(tx, command);
      return { outcome: "OVERPAYMENT" };
    }
    const isCash = command.type === "RECORD_CASH";
    const ledgerId = randomUUID();
    const method = isCash ? "CASH" : "BANK_TRANSFER";
    const status = isCash ? "VERIFIED" : "SUBMITTED";
    const insertedRows = await tx.$queryRaw<RawLedger[]>(Prisma.sql`
      INSERT INTO ${TABLE}
        ("id", "organizationId", "reservationId", "method", "status", "amountToman",
         "recordedByUserId", "verifiedByUserId", "bankReference", "createdAt", "verifiedAt")
      VALUES (
        ${ledgerId}, ${command.organizationId}, ${command.reservationId}, ${method}::"HotelOfflinePaymentMethod",
        ${status}::"HotelOfflinePaymentStatus", ${command.amountToman},
        ${command.actorUserId}, ${isCash ? command.actorUserId : null},
        ${command.type === "SUBMIT_BANK_TRANSFER" && command.bankReference ? command.bankReference : null}, ${command.now}, ${isCash ? command.now : null}
      )
      RETURNING "id", "organizationId", "reservationId", "method"::text AS "method", "status"::text AS "status",
        "amountToman", "recordedByUserId", "verifiedByUserId", "bankReference", "receiptKey", "createdAt", "verifiedAt"
    `);
    const ledger = insertedRows[0];
    if (isCash) {
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE "HotelReservation"
        SET "paidAmount" = "paidAmount" + ${command.amountToman}, "updatedAt" = ${command.now}
        WHERE "id" = ${command.reservationId} AND "organizationId" = ${command.organizationId}
          AND "paidAmount" + ${command.amountToman} <= "totalAmount"
      `);
      if (updated !== 1) throw new Error("Locked reservation balance changed during cash collection.");
    }
    await this.completeIdempotency(tx, command, ledgerId);
    const entry = mapEntry({ ...ledger, idempotencyKey: command.idempotencyKey });
    return entry ? { outcome: "APPLIED", entry } : { outcome: "NOT_FOUND" };
  }

  private async isAuthorized(tx: Tx, command: OfflinePaymentCommand, guestCustomerId: string | null) {
    if (command.type === "SUBMIT_BANK_TRANSFER") {
      if (!guestCustomerId) return false;
      const identity = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT ci."id" FROM "CustomerIdentity" ci
        JOIN "User" u ON u."id" = ci."userId"
        WHERE ci."organizationId" = ${command.organizationId} AND ci."userId" = ${command.actorUserId}
          AND ci."guestCustomerId" = ${guestCustomerId} AND ci."status" = 'ACTIVE'::"CustomerIdentityStatus"
          AND u."isActive" = TRUE AND u."deletedAt" IS NULL
        LIMIT 1
      `);
      return identity.length === 1;
    }
    const roles = command.type === "VERIFY_BANK_TRANSFER" ? ["ADMIN", "MANAGER"] : ["ADMIN", "MANAGER", "STAFF"];
    const membership = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT om."id"
      FROM "OrganizationMember" om
      JOIN "User" u ON u."id" = om."userId"
      WHERE om."organizationId" = ${command.organizationId} AND om."userId" = ${command.actorUserId}
        AND om."isActive" = TRUE AND u."isActive" = TRUE AND u."deletedAt" IS NULL
        AND om."role" IN (${Prisma.join(roles.map((role) => Prisma.sql`${role}::"UserRole"`))})
      LIMIT 1
    `);
    return membership.length === 1;
  }

  private async completeIdempotency(tx: Tx, command: OfflinePaymentCommand, ledgerEntryId: string) {
    const changed = await tx.$executeRaw(Prisma.sql`
      UPDATE ${IDEMPOTENCY_TABLE}
      SET "status" = 'COMPLETED', "ledgerEntryId" = ${ledgerEntryId}, "completedAt" = ${command.now}
      WHERE "organizationId" = ${command.organizationId}
        AND "operation" = ${operation(command)}::"HotelOfflinePaymentCommandType"
        AND "idempotencyKey" = ${command.idempotencyKey} AND "status" = 'PROCESSING'
    `);
    if (changed !== 1) throw new Error("Offline payment idempotency completion lost its locked row.");
  }

  private async removePlaceholder(tx: Tx, command: OfflinePaymentCommand) {
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM ${IDEMPOTENCY_TABLE}
      WHERE "organizationId" = ${command.organizationId}
        AND "operation" = ${operation(command)}::"HotelOfflinePaymentCommandType"
        AND "idempotencyKey" = ${command.idempotencyKey} AND "status" = 'PROCESSING'
    `);
  }
}

export function createPrismaHotelOfflinePaymentRepository(client: Db) {
  return new PrismaHotelOfflinePaymentRepository(client);
}
