import { z } from "zod";
import { retailOrderStatusLabel } from "@/lib/retail/order-operations";

const text = (max: number) => z.string().trim().max(max).default("");
export const fulfillmentDetailsSchema = z.object({
  pickupAddress: text(500), pickupInstructions: text(1000), deliveryRestrictions: text(1000), fulfillmentInstructions: text(1000),
}).strict();
export const publicFulfillmentInfoSchema = fulfillmentDetailsSchema.extend({contact: z.string().max(100).nullable()}).strict();
export const fulfillmentSettingsSchema = fulfillmentDetailsSchema.extend({
  enablePickup: z.boolean(), enableDelivery: z.boolean(), deliveryFee: z.number().finite().min(0).max(1_000_000_000).nullable(),
}).strict();
export const fulfillmentUpdateSchema = fulfillmentSettingsSchema.extend({expectedVersion: z.string().min(1).max(128)}).strict();
export const handoverInputSchema = z.object({operatorName: text(120), trackingReference: text(120), merchantNote: text(1000)}).strict();
export type HandoverInput = z.infer<typeof handoverInputSchema>;
export type FulfillmentDetails = z.infer<typeof fulfillmentDetailsSchema>;
const eventSchema = z.object({contract: z.literal("retail-fulfillment"), version: z.literal(1), details: handoverInputSchema}).strict();

/** A versioned event in the existing history.note field; legacy plain-text notes are never reinterpreted. */
export function readFulfillmentEvent(note: string | null | undefined) {
  if (!note || !note.startsWith("{")) return null;
  try {const event = eventSchema.safeParse(JSON.parse(note)); return event.success ? event.data.details : null;} catch {return null;}
}
export function fulfillmentEventNote(details: HandoverInput) {
  return JSON.stringify({contract: "retail-fulfillment", version: 1, details: handoverInputSchema.parse(details)});
}
export function readFulfillmentDetails(settings: unknown): FulfillmentDetails {
  const root = settings && typeof settings === "object" && !Array.isArray(settings) ? settings as Record<string, unknown> : {};
  const parsed = fulfillmentDetailsSchema.safeParse(root.retailFulfillment);
  return parsed.success ? parsed.data : fulfillmentDetailsSchema.parse({});
}
export type FulfillmentHistorySource = {id: string; newStatus: string; note: string | null; createdAt: Date | string};
export function customerFulfillment(type: string, status: string, history: FulfillmentHistorySource[]) {
  return {type, label: retailOrderStatusLabel(status, type), completed: status === "DELIVERED" || status === "RECEIVED" || type === "PICK_UP" && status === "PICKED_UP",
    events: history.map(entry => {
      const details = readFulfillmentEvent(entry.note);
      // Never project internal notes, raw history JSON, staff IDs or actor identity to customers.
      const shipment = type === "DELIVERY" && ["PICKED_UP", "DELIVERED"].includes(entry.newStatus);
      return {id: entry.id, status: entry.newStatus, label: retailOrderStatusLabel(entry.newStatus, type), at: new Date(entry.createdAt).toISOString(),
        operatorName: shipment ? details?.operatorName || null : null, trackingReference: shipment ? details?.trackingReference || null : null};
    })};
}
