import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildReasonedHotelOfflinePaymentAction,
  confirmedHotelOfflinePaymentMutation,
  parseHotelOfflinePaymentSummary,
  type HotelOfflinePaymentEntry,
} from "../../components/hotel-operations/hotel-offline-payments";

const base = { totalToman: "900", paidToman: "300", outstandingToman: "600" };
const submittedTransfer: HotelOfflinePaymentEntry = { id: "transfer-1", method: "BANK_TRANSFER", status: "SUBMITTED", amountToman: "100" };
const verifiedCash: HotelOfflinePaymentEntry = { id: "cash-1", method: "CASH", status: "VERIFIED", amountToman: "200" };

test("summary accepts and preserves distinct rejected and reversed statuses", () => {
  const summary = parseHotelOfflinePaymentSummary({ ...base, entries: [
    { ...submittedTransfer, status: "REJECTED" },
    { ...verifiedCash, status: "REVERSED" },
  ] });
  assert.deepEqual(summary?.entries.map(({ method, status }) => [method, status]), [
    ["BANK_TRANSFER", "REJECTED"],
    ["CASH", "REVERSED"],
  ]);
  assert.equal(parseHotelOfflinePaymentSummary({ ...base, entries: [{ ...submittedTransfer, status: "REFUNDED" }] }), null);
});

test("reasoned actions require a non-empty bounded reason and an eligible entry", () => {
  assert.deepEqual(buildReasonedHotelOfflinePaymentAction(submittedTransfer, "REJECT_BANK_TRANSFER", "  reference does not match  "), {
    action: "REJECT_BANK_TRANSFER", ledgerEntryId: "transfer-1", reason: "reference does not match",
  });
  assert.deepEqual(buildReasonedHotelOfflinePaymentAction(verifiedCash, "REVERSE_CASH", "Duplicate cash entry"), {
    action: "REVERSE_CASH", ledgerEntryId: "cash-1", reason: "Duplicate cash entry",
  });
  assert.equal(buildReasonedHotelOfflinePaymentAction(submittedTransfer, "REJECT_BANK_TRANSFER", "   "), null);
  assert.equal(buildReasonedHotelOfflinePaymentAction(submittedTransfer, "REJECT_BANK_TRANSFER", "x".repeat(501)), null);
  assert.equal(buildReasonedHotelOfflinePaymentAction(verifiedCash, "REJECT_BANK_TRANSFER", "wrong action"), null);
  assert.equal(buildReasonedHotelOfflinePaymentAction(submittedTransfer, "REVERSE_CASH", "wrong method"), null);
});

test("mutation confirmation requires matching method and final status", () => {
  assert.equal(confirmedHotelOfflinePaymentMutation({ outcome: "APPLIED", entry: { method: "BANK_TRANSFER", status: "REJECTED" } }, "REJECT_BANK_TRANSFER"), true);
  assert.equal(confirmedHotelOfflinePaymentMutation({ outcome: "REPLAY", entry: { method: "CASH", status: "REVERSED" } }, "REVERSE_CASH"), true);
  assert.equal(confirmedHotelOfflinePaymentMutation({ outcome: "APPLIED", entry: { method: "CASH", status: "REVERSED" } }, "REJECT_BANK_TRANSFER"), false);
  assert.equal(confirmedHotelOfflinePaymentMutation({ outcome: "APPLIED", entry: { method: "BANK_TRANSFER", status: "VERIFIED" } }, "REJECT_BANK_TRANSFER"), false);
  assert.equal(confirmedHotelOfflinePaymentMutation({ outcome: "UNAUTHORIZED", entry: { method: "CASH", status: "REVERSED" } }, "REVERSE_CASH"), false);
});
