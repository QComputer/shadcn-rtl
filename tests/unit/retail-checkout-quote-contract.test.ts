import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retailCheckoutInput, retailCheckoutQuoteInput } from "../../lib/retail/checkout.contract";

describe("retail checkout quote and review contract", () => {
  it("accepts legacy quote clients while requiring an address for delivery", () => {
    assert.equal(retailCheckoutQuoteInput.safeParse({ organization: "shop", type: "PICK_UP" }).success, true);
    assert.equal(retailCheckoutQuoteInput.safeParse({ organization: "shop", type: "DELIVERY" }).success, false);
    assert.equal(retailCheckoutQuoteInput.safeParse({ organization: "shop", type: "DELIVERY", deliveryAddress: "Long enough address" }).success, true);
  });

  it("normalizes Iranian digits and validates optional recipient contact", () => {
    const result = retailCheckoutQuoteInput.safeParse({ organization: "shop", type: "DELIVERY", deliveryAddress: "Long enough address", recipientMobile: "۰۹۱۲۳۴۵۶۷۸۹" });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.recipientMobile, "9123456789");
    assert.equal(retailCheckoutQuoteInput.safeParse({ organization: "shop", type: "PICK_UP", recipientMobile: "not-a-mobile" }).success, false);
  });

  it("keeps checkout review tokens optional for existing clients and validates supplied tokens", () => {
    const legacy = { organization: "shop", idempotencyKey: "a38f7eb3-bc89-4db6-a85d-a22e731b19e6", type: "PICK_UP", paymentMethod: "BANK_TRANSFER" };
    assert.equal(retailCheckoutInput.safeParse(legacy).success, true);
    assert.equal(retailCheckoutInput.safeParse({ ...legacy, reviewToken: "short" }).success, false);
    assert.equal(retailCheckoutInput.safeParse({ ...legacy, reviewToken: "a".repeat(43) }).success, true);
  });
});
