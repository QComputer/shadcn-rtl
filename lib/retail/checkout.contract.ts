import { OrderType } from "@prisma/client";
import { z } from "zod";
import { normalizeIranianMobile } from "@/lib/sms/phone-normalization";

const asciiDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10));
export const retailRecipientFields = {
  recipientName: z.string().trim().min(2).max(120).optional(),
  recipientMobile: z.string().trim().min(10).max(24).transform((value) => {
    const digits = asciiDigits(value);
    return normalizeIranianMobile(digits.startsWith("09") && digits.length === 11 ? digits.slice(1) : digits);
  }).refine((value) => value !== null, "Mobile must be a valid Iranian mobile number.").optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
};
export const retailCheckoutQuoteInput = z.object({
  organization: z.string().trim().min(1).max(120), type: z.nativeEnum(OrderType),
  deliveryAddress: z.string().trim().min(8).max(500).optional(), couponCode: z.string().trim().min(2).max(40).optional(),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "INOTI_USSD"]).optional(),
  cashMode: z.enum(["COUNTER", "PICKUP", "COURIER"]).optional(),
  ...retailRecipientFields,
}).strict().superRefine((value, context) => {
  if (value.type === "DELIVERY" && !value.deliveryAddress) context.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Delivery address is required." });
  if (value.paymentMethod !== "CASH" && value.cashMode) context.addIssue({ code: "custom", path: ["cashMode"], message: "Cash mode is only valid for cash payment." });
});
export type QuoteInput = z.infer<typeof retailCheckoutQuoteInput>;
export const retailCheckoutInput = z.object({
  organization: z.string().trim().min(1).max(120), idempotencyKey: z.string().uuid(), type: z.nativeEnum(OrderType),
  deliveryAddress: z.string().trim().min(8).max(500).optional(), couponCode: z.string().trim().min(2).max(40).optional(),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "INOTI_USSD"]), cashMode: z.enum(["COUNTER", "PICKUP", "COURIER"]).optional(),
  reviewToken: z.string().min(20).max(100).optional(), ...retailRecipientFields,
}).strict().superRefine((value, context) => {
  if (value.type === "DELIVERY" && !value.deliveryAddress) context.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Delivery address is required." });
  if (value.paymentMethod === "CASH" && !value.cashMode) context.addIssue({ code: "custom", path: ["cashMode"], message: "Cash collection mode is required." });
  if (value.paymentMethod !== "CASH" && value.cashMode) context.addIssue({ code: "custom", path: ["cashMode"], message: "Cash mode is only valid for cash payment." });
  if (value.cashMode === "PICKUP" && value.type !== "PICK_UP") context.addIssue({ code: "custom", path: ["cashMode"], message: "Pickup cash requires customer pickup." });
  if (value.cashMode === "COURIER" && value.type !== "DELIVERY") context.addIssue({ code: "custom", path: ["cashMode"], message: "Courier cash requires delivery." });
});
export type CheckoutInput = z.infer<typeof retailCheckoutInput>;
