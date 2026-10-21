export type OrderLifecycleStatus =
  | "PENDING"
  | "PLACED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED"
  | "RECEIVED"
  | "REFUNDED";

export type OrderPaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type RetailCashMode = "COUNTER" | "PICKUP" | "COURIER";

export interface OrderPaymentPresentation {
  status: OrderLifecycleStatus;
  paymentStatus: OrderPaymentStatus;
  retailCheckoutKey?: string | null;
  paymentMethod?: string | null;
  retailCashMode?: RetailCashMode | null;
}

export function getRetailCashModeFromPaymentMetadata(value: unknown): RetailCashMode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const retail = (value as Record<string, unknown>).retailR4;
  if (!retail || typeof retail !== "object" || Array.isArray(retail)) return null;
  const mode = (retail as Record<string, unknown>).cashMode;
  return mode === "COUNTER" || mode === "PICKUP" || mode === "COURIER" ? mode : null;
}

const CANCELABLE_STATUSES = new Set<OrderLifecycleStatus>([
  "PENDING",
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PICKED_UP",
]);

export function canCancelOrder(order: OrderPaymentPresentation): boolean {
  if (!CANCELABLE_STATUSES.has(order.status)) return false;
  return !(order.retailCheckoutKey && order.paymentStatus === "COMPLETED");
}

export function canConfirmRetailCashCollection(order: OrderPaymentPresentation): boolean {
  if (!order.retailCheckoutKey || order.paymentMethod !== "CASH" || order.paymentStatus !== "PENDING") {
    return false;
  }
  if (order.status === "CANCELLED" || order.status === "REFUNDED") return false;
  if (order.retailCashMode === "COUNTER") return true;
  return order.retailCashMode === "PICKUP" && ["READY", "PICKED_UP"].includes(order.status);
}

export function shouldUseGenericPaymentControls(order: OrderPaymentPresentation): boolean {
  return !order.retailCheckoutKey;
}

export function shouldLinkRetailPaymentReports(order: OrderPaymentPresentation): boolean {
  return Boolean(order.retailCheckoutKey) && order.paymentStatus !== "COMPLETED" &&
    !canConfirmRetailCashCollection(order);
}

export function formatVariantOptionsSnapshot(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const option = item as Record<string, unknown>;
    if (typeof option.value !== "string" && typeof option.value !== "number" && typeof option.value !== "boolean") {
      return [];
    }
    const label = typeof option.label === "string" && option.label.trim()
      ? option.label.trim()
      : typeof option.key === "string" && option.key.trim() ? option.key.trim() : null;
    if (!label) return [];
    const unit = typeof option.displayUnit === "string" && option.displayUnit.trim()
      ? ` ${option.displayUnit.trim()}`
      : "";
    return [`${label}: ${String(option.value)}${unit}`];
  });
}
