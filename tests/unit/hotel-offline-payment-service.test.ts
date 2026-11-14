import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createHotelOfflinePaymentService,
  type HotelOfflinePaymentRepository,
  type OfflinePaymentActor,
  type OfflinePaymentCommand,
  type OfflinePaymentCommandResult,
  type OfflinePaymentLedgerEntry,
} from "../../lib/hotel/offline-payments/service";

const ORG = "hotel-a";
const OTHER_ORG = "hotel-b";
const RESERVATION = "reservation-1";
const TOTAL = BigInt(1000000);
const CASH_ACTOR: OfflinePaymentActor = {
  organizationId: ORG, userId: "staff-cash", permissions: ["hotel:offline-payment:record-cash"],
};
const SUBMITTER: OfflinePaymentActor = {
  organizationId: ORG, userId: "guest-1", permissions: ["hotel:offline-payment:submit-transfer"],
};
const VERIFIER: OfflinePaymentActor = {
  organizationId: ORG, userId: "staff-reviewer", permissions: ["hotel:offline-payment:verify-transfer"],
};

/**
 * In-memory contract double only. It serializes commands to approximate the
 * required atomic repository boundary; it is not evidence of PostgreSQL locks,
 * constraints, rollback, or production persistence.
 */
class MemoryOfflinePaymentRepository implements HotelOfflinePaymentRepository {
  private readonly reservations = new Map([[`${ORG}:${RESERVATION}`, { total: TOTAL, paid: BigInt(0), status: "PENDING_PAYMENT" }]]);
  private readonly entries = new Map<string, OfflinePaymentLedgerEntry>();
  private readonly byIdempotency = new Map<string, string>();
  private readonly receiptPendingByIdempotency = new Map<string, boolean>();
  private nextId = 0;
  private queue: Promise<void> = Promise.resolve();

  async applyOfflinePaymentCommand(command: OfflinePaymentCommand): Promise<OfflinePaymentCommandResult> {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return this.apply(command);
    } finally {
      release();
    }
  }

  private apply(command: OfflinePaymentCommand): OfflinePaymentCommandResult {
    const reservation = this.reservations.get(`${command.organizationId}:${command.reservationId}`);
    if (!reservation) return { outcome: "NOT_FOUND" };

    const idemScope = `${command.organizationId}:${command.idempotencyKey}`;
    const existingId = this.byIdempotency.get(idemScope);
    if (existingId) {
      const existing = this.entries.get(existingId)!;
      const same = command.type === "VERIFY_BANK_TRANSFER"
        ? existing.id === command.ledgerEntryId && existing.status === "VERIFIED"
        : existing.reservationId === command.reservationId && existing.method === (command.type === "RECORD_CASH" ? "CASH" : "BANK_TRANSFER")
          && existing.amountToman === command.amountToman && existing.bankReference === (command.type === "SUBMIT_BANK_TRANSFER" ? command.bankReference || undefined : undefined)
          && (command.type !== "SUBMIT_BANK_TRANSFER" || this.receiptPendingByIdempotency.get(idemScope) === command.receiptPending);
      return same ? { outcome: "REPLAY", entry: existing } : { outcome: "IDEMPOTENCY_CONFLICT" };
    }

    if (command.type === "VERIFY_BANK_TRANSFER") {
      const entry = this.entries.get(command.ledgerEntryId);
      if (!entry || entry.reservationId !== command.reservationId) return { outcome: "NOT_FOUND" };
      if (entry.organizationId !== command.organizationId) return { outcome: "TENANT_MISMATCH" };
      if (entry.method !== "BANK_TRANSFER" || entry.status !== "SUBMITTED") return { outcome: "PAYMENT_NOT_PENDING" };
      if (!entry.bankReference?.trim() && !entry.receiptAttached) return { outcome: "PAYMENT_NOT_PENDING" };
      if (reservation.paid + entry.amountToman > reservation.total) return { outcome: "OVERPAYMENT" };
      const verified = { ...entry, status: "VERIFIED" as const, verifiedByUserId: command.actorUserId, verifiedAt: command.now };
      this.entries.set(entry.id, verified);
      this.byIdempotency.set(idemScope, entry.id);
      reservation.paid += entry.amountToman;
      return { outcome: "APPLIED", entry: verified };
    }

    if (command.type === "SUBMIT_BANK_TRANSFER" && [...this.entries.values()].some((entry) =>
      entry.organizationId === command.organizationId && entry.reservationId === command.reservationId
      && entry.method === "BANK_TRANSFER" && entry.status === "SUBMITTED")) {
      return { outcome: "PAYMENT_NOT_PENDING" };
    }
    if (command.type !== "SUBMIT_BANK_TRANSFER" && reservation.paid + command.amountToman > reservation.total) return { outcome: "OVERPAYMENT" };
    const entry: OfflinePaymentLedgerEntry = {
      id: `offline-${++this.nextId}`, organizationId: command.organizationId,
      reservationId: command.reservationId, method: command.type === "RECORD_CASH" ? "CASH" : "BANK_TRANSFER",
      status: command.type === "RECORD_CASH" ? "VERIFIED" : "SUBMITTED",
      amountToman: command.amountToman, idempotencyKey: command.idempotencyKey,
      recordedByUserId: command.actorUserId,
      ...(command.type === "SUBMIT_BANK_TRANSFER" ? { bankReference: command.bankReference } : {}),
      ...(command.type === "RECORD_CASH" ? { verifiedByUserId: command.actorUserId, verifiedAt: command.now } : {}),
      createdAt: command.now,
    };
    this.entries.set(entry.id, entry);
    this.byIdempotency.set(idemScope, entry.id);
    if (command.type === "SUBMIT_BANK_TRANSFER") this.receiptPendingByIdempotency.set(idemScope, command.receiptPending);
    if (entry.status === "VERIFIED") reservation.paid += entry.amountToman;
    return { outcome: "APPLIED", entry };
  }

  paidAmount(organizationId = ORG, reservationId = RESERVATION) {
    return this.reservations.get(`${organizationId}:${reservationId}`)?.paid ?? null;
  }

  reservationStatus() {
    return this.reservations.get(`${ORG}:${RESERVATION}`)?.status;
  }

  attachReceipt(entryId: string) {
    const entry = this.entries.get(entryId);
    assert.ok(entry);
    this.entries.set(entryId, { ...entry, receiptAttached: true });
  }
}

function setup() {
  const repository = new MemoryOfflinePaymentRepository();
  const service = createHotelOfflinePaymentService({ repository, now: () => new Date("2026-11-14T10:00:00Z") });
  return { repository, service };
}

describe("Hotel offline payment service contract", () => {
  it("records cash as verified and updates paid total without confirming reservation", async () => {
    const { repository, service } = setup();
    const result = await service.recordCash({ actor: CASH_ACTOR, reservationId: RESERVATION, amountToman: BigInt(300000), idempotencyKey: "cash-1" });
    assert.equal(result.outcome, "APPLIED");
    assert.equal(result.outcome === "APPLIED" && result.entry.status, "VERIFIED");
    assert.equal(repository.paidAmount(), BigInt(300000));
    assert.equal(repository.reservationStatus(), "PENDING_PAYMENT");
  });

  it("keeps a submitted transfer unverified and out of paidAmount", async () => {
    const { repository, service } = setup();
    const result = await service.submitBankTransfer({ actor: SUBMITTER, reservationId: RESERVATION, amountToman: BigInt(400000), idempotencyKey: "transfer-1", bankReference: "trace-123" });
    assert.equal(result.outcome, "APPLIED");
    assert.equal(result.outcome === "APPLIED" && result.entry.status, "SUBMITTED");
    assert.equal(repository.paidAmount(), BigInt(0));
    assert.equal(repository.reservationStatus(), "PENDING_PAYMENT");
  });

  it("accepts a reference-free transfer only when receiptPending is explicit, then requires an attached receipt to verify", async () => {
    const { repository, service } = setup();
    const missingFlag = await service.submitBankTransfer({ actor: SUBMITTER, reservationId: RESERVATION, amountToman: BigInt(250000), idempotencyKey: "receipt-missing-flag", bankReference: "" });
    assert.equal(missingFlag.outcome, "INVALID_INPUT");
    const submitted = await service.submitBankTransfer({ actor: SUBMITTER, reservationId: RESERVATION, amountToman: BigInt(250000), idempotencyKey: "receipt-pending", bankReference: null, receiptPending: true });
    assert.equal(submitted.outcome, "APPLIED");
    assert.equal(repository.paidAmount(), BigInt(0));
    if (submitted.outcome !== "APPLIED") return;
    const beforeReceipt = await service.verifyBankTransfer({ actor: VERIFIER, reservationId: RESERVATION, ledgerEntryId: submitted.entry.id, idempotencyKey: "receipt-verify" });
    assert.equal(beforeReceipt.outcome, "PAYMENT_NOT_PENDING");
    repository.attachReceipt(submitted.entry.id);
    const withReceipt = await service.verifyBankTransfer({ actor: VERIFIER, reservationId: RESERVATION, ledgerEntryId: submitted.entry.id, idempotencyKey: "receipt-verify" });
    assert.equal(withReceipt.outcome, "APPLIED");
    assert.equal(repository.paidAmount(), BigInt(250000));
  });

  it("includes receiptPending in transfer idempotency fingerprints", async () => {
    const { service } = setup();
    const first = await service.submitBankTransfer({ actor: SUBMITTER, reservationId: RESERVATION, amountToman: BigInt(200000), idempotencyKey: "receipt-flag-fingerprint", bankReference: "trace-fingerprint", receiptPending: false });
    const conflict = await service.submitBankTransfer({ actor: SUBMITTER, reservationId: RESERVATION, amountToman: BigInt(200000), idempotencyKey: "receipt-flag-fingerprint", bankReference: "trace-fingerprint", receiptPending: true });
    assert.equal(first.outcome, "APPLIED");
    assert.equal(conflict.outcome, "IDEMPOTENCY_CONFLICT");
  });

  it("adds transfer amount only when a staff actor verifies it", async () => {
    const { repository, service } = setup();
    const submitted = await service.submitBankTransfer({ actor: SUBMITTER, reservationId: RESERVATION, amountToman: BigInt(400000), idempotencyKey: "transfer-1", bankReference: "trace-123" });
    assert.equal(submitted.outcome, "APPLIED");
    if (submitted.outcome !== "APPLIED") return;
    const verified = await service.verifyBankTransfer({ actor: VERIFIER, reservationId: RESERVATION, ledgerEntryId: submitted.entry.id, idempotencyKey: "verify-1" });
    assert.equal(verified.outcome, "APPLIED");
    assert.equal(verified.outcome === "APPLIED" && verified.entry.verifiedByUserId, VERIFIER.userId);
    assert.equal(repository.paidAmount(), BigInt(400000));
    assert.equal(repository.reservationStatus(), "PENDING_PAYMENT");
  });

  it("returns the same entry on replay and conflicts when the key is reused for a different amount", async () => {
    const { service } = setup();
    const first = await service.recordCash({ actor: CASH_ACTOR, reservationId: RESERVATION, amountToman: BigInt(300000), idempotencyKey: "cash-1" });
    const replay = await service.recordCash({ actor: CASH_ACTOR, reservationId: RESERVATION, amountToman: BigInt(300000), idempotencyKey: "cash-1" });
    const conflict = await service.recordCash({ actor: CASH_ACTOR, reservationId: RESERVATION, amountToman: BigInt(200000), idempotencyKey: "cash-1" });
    assert.equal(first.outcome, "APPLIED");
    assert.equal(replay.outcome, "REPLAY");
    assert.equal(conflict.outcome, "IDEMPOTENCY_CONFLICT");
  });

  it("rejects calls without a trusted permission and rejects invalid amounts", async () => {
    const { service } = setup();
    const unauthorized = await service.recordCash({ actor: SUBMITTER, reservationId: RESERVATION, amountToman: BigInt(1), idempotencyKey: "x" });
    const invalid = await service.recordCash({ actor: CASH_ACTOR, reservationId: RESERVATION, amountToman: BigInt(0), idempotencyKey: "x" });
    assert.equal(unauthorized.outcome, "UNAUTHORIZED");
    assert.equal(invalid.outcome, "INVALID_AMOUNT");
  });

  it("does not accept an actor from a different tenant as a repository scope", async () => {
    const { service, repository } = setup();
    const result = await service.recordCash({ actor: { ...CASH_ACTOR, organizationId: OTHER_ORG }, reservationId: RESERVATION, amountToman: BigInt(1), idempotencyKey: "cross-tenant" });
    assert.equal(result.outcome, "NOT_FOUND");
    assert.equal(repository.paidAmount(), BigInt(0));
    assert.equal(repository.paidAmount(OTHER_ORG), null);
  });

  it("serializes simultaneous commands so verified totals cannot exceed the reservation", async () => {
    const { service, repository } = setup();
    const results = await Promise.all([
      service.recordCash({ actor: CASH_ACTOR, reservationId: RESERVATION, amountToman: BigInt(700000), idempotencyKey: "cash-a" }),
      service.recordCash({ actor: CASH_ACTOR, reservationId: RESERVATION, amountToman: BigInt(500000), idempotencyKey: "cash-b" }),
    ]);
    assert.equal(results.filter((result) => result.outcome === "APPLIED").length, 1);
    assert.equal(results.filter((result) => result.outcome === "OVERPAYMENT").length, 1);
    assert.ok(repository.paidAmount()! <= TOTAL);
  });
});
