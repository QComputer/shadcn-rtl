import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customerFulfillment,
  fulfillmentDetailsSchema,
  fulfillmentEventNote,
  fulfillmentSettingsSchema,
  fulfillmentUpdateSchema,
  handoverInputSchema,
  readFulfillmentDetails,
  readFulfillmentEvent,
} from "@/lib/retail/fulfillment";

test("fulfillment settings validate bounded text and retain an intentionally unset delivery fee", () => {
  const valid = { enablePickup: true, enableDelivery: false, deliveryFee: null,
    pickupAddress: "  Main shop  ", pickupInstructions: "", deliveryRestrictions: "", fulfillmentInstructions: "" };
  assert.deepEqual(fulfillmentSettingsSchema.parse(valid), { ...valid, pickupAddress: "Main shop" });
  assert.equal(fulfillmentSettingsSchema.safeParse({ ...valid, deliveryFee: -1 }).success, false);
  assert.equal(fulfillmentSettingsSchema.safeParse({ ...valid, pickupAddress: "x".repeat(501) }).success, false);
  assert.equal(fulfillmentUpdateSchema.safeParse({ ...valid, expectedVersion: "v1", unexpected: true }).success, false);
  assert.equal(fulfillmentDetailsSchema.parse({}).pickupAddress, "");
});

test("fulfillment settings and events preserve unrelated JSON and never reinterpret legacy history notes", () => {
  const unrelated = { unrelated: { retained: true }, retailFulfillment: { pickupAddress: "Shop" } };
  assert.deepEqual(readFulfillmentDetails(unrelated), { pickupAddress: "Shop", pickupInstructions: "", deliveryRestrictions: "", fulfillmentInstructions: "" });
  assert.deepEqual(readFulfillmentDetails({ unrelated: true, retailFulfillment: { pickupAddress: 4 } }),
    { pickupAddress: "", pickupInstructions: "", deliveryRestrictions: "", fulfillmentInstructions: "" });
  assert.equal(readFulfillmentEvent("Order status updated"), null);
  assert.equal(readFulfillmentEvent('{"merchantNote":"private legacy text"}'), null);

  const details = handoverInputSchema.parse({ operatorName: "  Reza  ", trackingReference: " TR-42 ", merchantNote: "Keep upright" });
  const encoded = fulfillmentEventNote(details);
  assert.deepEqual(readFulfillmentEvent(encoded), { ...details, operatorName: "Reza", trackingReference: "TR-42", merchantNote: "Keep upright" });
  assert.equal(readFulfillmentEvent(encoded)?.merchantNote, "Keep upright");
  assert.equal(handoverInputSchema.safeParse({ operatorName: "x".repeat(121), trackingReference: "", merchantNote: "" }).success, false);
});

test("customer fulfillment labels pickup as collected and delivery as dispatched, with private history omitted", () => {
  const at = new Date("2026-10-23T12:34:00.000Z");
  const event = fulfillmentEventNote({ operatorName: "Courier A", trackingReference: "TRACK-42", merchantNote: "staff only" });
  const delivery = customerFulfillment("DELIVERY", "PICKED_UP", [
    { id: "ready", newStatus: "READY", note: "private internal instruction", createdAt: at },
    { id: "dispatch", newStatus: "PICKED_UP", note: event, createdAt: at },
  ]);
  assert.equal(delivery.label, "تحویل به پیک");
  assert.equal(delivery.completed, false);
  assert.equal(delivery.events[0]?.label, "آماده ارسال");
  assert.equal(delivery.events[0]?.operatorName, null);
  assert.deepEqual(delivery.events[1], { id: "dispatch", status: "PICKED_UP", label: "تحویل به پیک", at: at.toISOString(), operatorName: "Courier A", trackingReference: "TRACK-42" });
  const serialized = JSON.stringify(delivery);
  for (const privateValue of ["staff only", "private internal instruction", "actorId", "changedById", "merchantNote"]) assert.equal(serialized.includes(privateValue), false);

  const pickup = customerFulfillment("PICK_UP", "PICKED_UP", [{ id: "collected", newStatus: "PICKED_UP", note: event, createdAt: at }]);
  assert.equal(pickup.label, "دریافت‌شده توسط مشتری");
  assert.equal(pickup.completed, true);
  assert.equal(pickup.events[0]?.operatorName, null, "pickup does not expose handover metadata intended for courier delivery");
});
