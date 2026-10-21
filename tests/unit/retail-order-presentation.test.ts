import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canCancelOrder,
  canConfirmRetailCashCollection,
  formatVariantOptionsSnapshot,
  getRetailCashModeFromPaymentMetadata,
  shouldLinkRetailPaymentReports,
  shouldUseGenericPaymentControls,
} from "@/lib/order-presentation";

test("retail cash collection controls follow payment mode and fulfillment readiness", () => {
  const counter = {
    retailCheckoutKey: "counter-key", paymentMethod: "CASH", paymentStatus: "PENDING" as const,
    retailCashMode: "COUNTER" as const, status: "PENDING" as const,
  };
  assert.equal(canConfirmRetailCashCollection(counter), true);
  assert.equal(shouldLinkRetailPaymentReports(counter), false);
  assert.equal(shouldUseGenericPaymentControls(counter), false);

  const pickup = { ...counter, retailCashMode: "PICKUP" as const };
  assert.equal(canConfirmRetailCashCollection(pickup), false);
  assert.equal(canConfirmRetailCashCollection({ ...pickup, status: "READY" }), true);
  assert.equal(canConfirmRetailCashCollection({ ...pickup, status: "PICKED_UP" }), true);
  assert.equal(canConfirmRetailCashCollection({ ...counter, retailCashMode: "COURIER" }), false);
  assert.equal(shouldLinkRetailPaymentReports({ ...counter, retailCashMode: "COURIER" }), true);
});

test("paid retail orders cannot be cancelled or edited through generic payment controls", () => {
  const paid = {
    retailCheckoutKey: "paid-key", paymentMethod: "BANK_TRANSFER", paymentStatus: "COMPLETED" as const,
    status: "DELIVERED" as const,
  };
  assert.equal(canCancelOrder(paid), false);
  assert.equal(shouldUseGenericPaymentControls(paid), false);
  assert.equal(shouldLinkRetailPaymentReports(paid), false);
  assert.equal(canCancelOrder({ ...paid, status: "ACCEPTED" }), false);

  const legacy = { status: "ACCEPTED" as const, paymentStatus: "COMPLETED" as const };
  assert.equal(canCancelOrder(legacy), true);
  assert.equal(shouldUseGenericPaymentControls(legacy), true);
});

test("payment metadata projection exposes only validated cash modes", () => {
  assert.equal(getRetailCashModeFromPaymentMetadata({ retailR4: { cashMode: "COUNTER", bankCardNumber: "private" } }), "COUNTER");
  assert.equal(getRetailCashModeFromPaymentMetadata({ retailR4: { cashMode: "UNKNOWN" } }), null);
  assert.equal(getRetailCashModeFromPaymentMetadata(null), null);
});

test("immutable variant option snapshots format safely and ignore malformed values", () => {
  assert.deepEqual(formatVariantOptionsSnapshot([
    { key: "color", label: "Color", value: "Red", displayUnit: null },
    { key: "length", label: "Length", value: 20, displayUnit: "cm" },
    { key: "unsafe", label: "Unsafe", value: { secret: true } },
    null,
  ]), ["Color: Red", "Length: 20 cm"]);
  assert.deepEqual(formatVariantOptionsSnapshot({ not: "an array" }), []);
});
