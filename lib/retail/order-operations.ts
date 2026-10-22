import type { OrderStatus, OrderType, PaymentStatus } from "@prisma/client";

export const retailOrderStatusLabels: Record<OrderStatus, string> = {
  PENDING: "سفارش جدید", PLACED: "ثبت‌شده", ACCEPTED: "پذیرفته‌شده", PREPARING: "در حال آماده‌سازی",
  READY: "آماده تحویل", PICKED_UP: "تحویل‌شده به گیرنده / پیک", DELIVERED: "تحویل نهایی", RECEIVED: "دریافت‌شده",
  CANCELLED: "لغوشده", REFUNDED: "بازپرداخت‌شده",
};
export type RetailOperationalOrder = { status: OrderStatus; type: OrderType; paymentStatus: PaymentStatus };

/** Fulfillment never certifies payment. Pickup handover is terminal; delivery requires dispatch first. */
export function retailOrderActions(order: RetailOperationalOrder): Array<{ status: OrderStatus; label: string }> {
  const next: Partial<Record<OrderStatus, OrderStatus[]>> = {
    PENDING: ["ACCEPTED"], PLACED: ["ACCEPTED"], ACCEPTED: ["PREPARING"], PREPARING: ["READY"],
    READY: ["PICKED_UP"], PICKED_UP: order.type === "DELIVERY" ? ["DELIVERED"] : [],
  };
  const actions = (next[order.status] ?? []).map((status) => ({ status,
    label: status === "ACCEPTED" ? "پذیرش سفارش" : status === "PREPARING" ? "شروع آماده‌سازی" : status === "READY"
      ? order.type === "PICK_UP" ? "آماده دریافت حضوری" : "آماده ارسال"
      : status === "PICKED_UP" ? order.type === "PICK_UP" ? "تأیید تحویل به مشتری" : "تحویل به پیک"
      : "تأیید تحویل نهایی" }));
  if (["PENDING", "PLACED", "ACCEPTED", "PREPARING", "READY"].includes(order.status) && order.paymentStatus !== "COMPLETED") {
    actions.push({ status: "CANCELLED", label: "لغو سفارش و آزادسازی موجودی" });
  }
  return actions;
}

export function isRetailOrderTransitionAllowed(order: RetailOperationalOrder, next: OrderStatus) {
  return order.status === next || retailOrderActions(order).some((action) => action.status === next);
}

export function retailOrderStatusLabel(status: string, type?: string) {
  if (status === "PICKED_UP") return type === "DELIVERY" ? "تحویل به پیک" : type === "PICK_UP" ? "دریافت‌شده توسط مشتری" : "تحویل به مشتری / پیک";
  return retailOrderStatusLabels[status as OrderStatus] ?? status;
}
