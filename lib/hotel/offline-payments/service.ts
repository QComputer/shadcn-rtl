/**
 * Tenant-bound application contract for offline hotel collections.
 *
 * This module deliberately has no database adapter. The repository method is
 * the transaction boundary: implementations must scope every lookup/write by
 * organization, enforce idempotency, and atomically update the ledger and
 * reservation payment total when money is verified. Bank transfer submission
 * is only a claim; it must not change paidAmount or reservation status.
 */

export type OfflinePaymentMethod = "CASH" | "BANK_TRANSFER";
export type OfflinePaymentStatus = "SUBMITTED" | "VERIFIED";

export type OfflinePaymentActor = {
  /** Must be derived from the authenticated session, never request fields. */
  readonly organizationId: string;
  readonly userId: string;
  readonly permissions: readonly ("hotel:offline-payment:record-cash" | "hotel:offline-payment:submit-transfer" | "hotel:offline-payment:verify-transfer")[];
};

export type OfflinePaymentCommand =
  | {
      readonly type: "RECORD_CASH";
      readonly organizationId: string;
      readonly reservationId: string;
      readonly actorUserId: string;
      readonly idempotencyKey: string;
      readonly amountToman: bigint;
      readonly now: Date;
    }
  | {
      readonly type: "SUBMIT_BANK_TRANSFER";
      readonly organizationId: string;
      readonly reservationId: string;
      readonly actorUserId: string;
      readonly idempotencyKey: string;
      readonly amountToman: bigint;
      readonly bankReference: string;
      readonly now: Date;
    }
  | {
      readonly type: "VERIFY_BANK_TRANSFER";
      readonly organizationId: string;
      readonly reservationId: string;
      readonly ledgerEntryId: string;
      readonly actorUserId: string;
      readonly idempotencyKey: string;
      readonly now: Date;
    };

export type OfflinePaymentLedgerEntry = {
  readonly id: string;
  readonly organizationId: string;
  readonly reservationId: string;
  readonly method: OfflinePaymentMethod;
  readonly status: OfflinePaymentStatus;
  readonly amountToman: bigint;
  readonly idempotencyKey: string;
  readonly recordedByUserId: string;
  readonly verifiedByUserId?: string;
  readonly bankReference?: string;
  readonly createdAt: Date;
  readonly verifiedAt?: Date;
};

export type OfflinePaymentCommandResult =
  | { readonly outcome: "APPLIED"; readonly entry: OfflinePaymentLedgerEntry }
  | { readonly outcome: "REPLAY"; readonly entry: OfflinePaymentLedgerEntry }
  | { readonly outcome: "NOT_FOUND" | "TENANT_MISMATCH" | "UNAUTHORIZED" | "INVALID_INPUT" | "INVALID_AMOUNT" | "IDEMPOTENCY_CONFLICT" | "PAYMENT_NOT_PENDING" | "OVERPAYMENT" };

export interface HotelOfflinePaymentRepository {
  /**
   * Must run as one atomic operation. For RECORD_CASH, create a VERIFIED row
   * and increment paidAmount together. SUBMIT_BANK_TRANSFER must create a
   * SUBMITTED row only. VERIFY_BANK_TRANSFER must compare-and-set a pending
   * row, increment paidAmount once, and preserve the reservation status.
   * Replays and uniqueness/conflict outcomes are resolved inside the same
   * transaction, including serializing simultaneous verification attempts.
   */
  applyOfflinePaymentCommand(command: OfflinePaymentCommand): Promise<OfflinePaymentCommandResult>;
}

export interface HotelOfflinePaymentService {
  recordCash(input: { actor: OfflinePaymentActor; reservationId: string; idempotencyKey: string; amountToman: bigint }): Promise<OfflinePaymentCommandResult>;
  submitBankTransfer(input: { actor: OfflinePaymentActor; reservationId: string; idempotencyKey: string; amountToman: bigint; bankReference: string }): Promise<OfflinePaymentCommandResult>;
  verifyBankTransfer(input: { actor: OfflinePaymentActor; reservationId: string; ledgerEntryId: string; idempotencyKey: string }): Promise<OfflinePaymentCommandResult>;
}

const PERMISSION = {
  RECORD_CASH: "hotel:offline-payment:record-cash",
  SUBMIT_BANK_TRANSFER: "hotel:offline-payment:submit-transfer",
  VERIFY_BANK_TRANSFER: "hotel:offline-payment:verify-transfer",
} as const;

function hasPermission(actor: OfflinePaymentActor, permission: OfflinePaymentActor["permissions"][number]) {
  return Boolean(actor.organizationId.trim() && actor.userId.trim() && actor.permissions.includes(permission));
}

function validateCommon(input: { actor: OfflinePaymentActor; reservationId: string; idempotencyKey: string; amountToman?: bigint }) {
  if (!input.actor.organizationId.trim() || !input.actor.userId.trim()) return "INVALID_ACTOR" as const;
  if (!input.reservationId.trim() || !input.idempotencyKey.trim() || input.idempotencyKey.length > 200) return "INVALID_INPUT" as const;
  if (input.amountToman !== undefined && input.amountToman <= 0n) return "INVALID_AMOUNT" as const;
  return null;
}

export function createHotelOfflinePaymentService(deps: {
  readonly repository: HotelOfflinePaymentRepository;
  readonly now: () => Date;
}): HotelOfflinePaymentService {
  return {
    async recordCash(input) {
      const invalid = validateCommon(input);
      if (invalid) return { outcome: invalid === "INVALID_ACTOR" ? "INVALID_INPUT" : invalid };
      if (!hasPermission(input.actor, PERMISSION.RECORD_CASH)) return { outcome: "UNAUTHORIZED" };
      return deps.repository.applyOfflinePaymentCommand({
        type: "RECORD_CASH", organizationId: input.actor.organizationId,
        reservationId: input.reservationId, actorUserId: input.actor.userId,
        idempotencyKey: input.idempotencyKey, amountToman: input.amountToman, now: deps.now(),
      });
    },
    async submitBankTransfer(input) {
      const invalid = validateCommon(input);
      if (invalid) return { outcome: invalid === "INVALID_ACTOR" ? "INVALID_INPUT" : invalid };
      if (!hasPermission(input.actor, PERMISSION.SUBMIT_BANK_TRANSFER)) return { outcome: "UNAUTHORIZED" };
      const bankReference = input.bankReference.trim();
      if (!bankReference || bankReference.length > 160) return { outcome: "INVALID_INPUT" };
      return deps.repository.applyOfflinePaymentCommand({
        type: "SUBMIT_BANK_TRANSFER", organizationId: input.actor.organizationId,
        reservationId: input.reservationId, actorUserId: input.actor.userId,
        idempotencyKey: input.idempotencyKey, amountToman: input.amountToman,
        bankReference, now: deps.now(),
      });
    },
    async verifyBankTransfer(input) {
      const invalid = validateCommon(input);
      if (invalid) return { outcome: invalid === "INVALID_ACTOR" ? "INVALID_INPUT" : invalid };
      if (!hasPermission(input.actor, PERMISSION.VERIFY_BANK_TRANSFER)) return { outcome: "UNAUTHORIZED" };
      if (!input.ledgerEntryId.trim()) return { outcome: "INVALID_INPUT" };
      return deps.repository.applyOfflinePaymentCommand({
        type: "VERIFY_BANK_TRANSFER", organizationId: input.actor.organizationId,
        reservationId: input.reservationId, ledgerEntryId: input.ledgerEntryId,
        actorUserId: input.actor.userId, idempotencyKey: input.idempotencyKey, now: deps.now(),
      });
    },
  };
}
