import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { buildHotelOfflinePolicySettings, HotelOfflinePolicySettings, hotelReservationPolicyEndpoint } from "../../components/hotel-operations/hotel-offline-policy-settings";

test("reservation policy endpoint encodes organization and property identifiers", () => {
  assert.equal(hotelReservationPolicyEndpoint("org/one", "property one"), "/api/organizations/org%2Fone/hotels/property%20one/reservations");
});

test("disabled is the fail-closed payload and drops offline methods", () => {
  assert.deepEqual(buildHotelOfflinePolicySettings({ manualConfirmationPolicy: "DISABLED", allowedOfflinePaymentMethods: ["CASH", "BANK_TRANSFER"], minimumVerifiedDepositAmount: "500" }), {
    mode: "RESERVATION", manualConfirmationPolicy: "DISABLED", allowedOfflinePaymentMethods: [], minimumVerifiedDepositAmount: null,
  });
});

test("active policies require an offline method and deposits require a positive integer amount", () => {
  assert.equal(buildHotelOfflinePolicySettings({ manualConfirmationPolicy: "CASH_ON_ARRIVAL", allowedOfflinePaymentMethods: [], minimumVerifiedDepositAmount: null }), null);
  assert.equal(buildHotelOfflinePolicySettings({ manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", allowedOfflinePaymentMethods: ["BANK_TRANSFER"], minimumVerifiedDepositAmount: "0" }), null);
  assert.deepEqual(buildHotelOfflinePolicySettings({ manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", allowedOfflinePaymentMethods: ["BANK_TRANSFER", "BANK_TRANSFER"], minimumVerifiedDepositAmount: "250000" }), {
    mode: "RESERVATION", manualConfirmationPolicy: "MINIMUM_VERIFIED_DEPOSIT", allowedOfflinePaymentMethods: ["BANK_TRANSFER"], minimumVerifiedDepositAmount: "250000",
  });
});

test("component renders provisional default, role note, and locale direction in fa/en/ar", () => {
  for (const locale of ["fa", "en", "ar"]) {
    const markup = renderToStaticMarkup(<HotelOfflinePolicySettings organizationId="org" propertyId="property" locale={locale} initialValues={{ manualConfirmationPolicy: "DISABLED", allowedOfflinePaymentMethods: [], minimumVerifiedDepositAmount: null }} />);
    assert.match(markup, /role="note"/);
    assert.match(markup, /provisional|موقت|مؤقتة/);
    assert.match(markup, /role="note"/);
    assert.match(markup, locale === "en" ? /dir="ltr"/ : /dir="rtl"/);
    assert.match(markup, /disabled/);
  }
});

test("configured policy is described as not confirming a reservation and does not invent bank details", () => {
  const markup = renderToStaticMarkup(<HotelOfflinePolicySettings organizationId="org" propertyId="property" locale="en" initialValues={{ manualConfirmationPolicy: "CASH_ON_ARRIVAL", allowedOfflinePaymentMethods: ["CASH", "BANK_TRANSFER"], minimumVerifiedDepositAmount: null }} />);
  assert.match(markup, /does not confirm a reservation/);
  assert.doesNotMatch(markup, /IBAN|account number|bank details/i);
});
