export type OrderStatusLabelMap = Record<string, string>
export type PaymentStatusLabelMap = Record<string, string>

export const orderStatusLabelsFa: OrderStatusLabelMap = {
  PENDING: "در انتظار",
  PLACED: "ثبت شده",
  ACCEPTED: "قبول شده",
  PREPARING: "در حال آماده‌سازی",
  READY: "آماده تحویل",
  PICKED_UP: "تحویل پیک شده",
  DELIVERED: "تحویل شده",
  RECEIVED: "دریافت شده",
  CANCELLED: "لغو شده",
  REFUNDED: "مسترد شده",
}

export const paymentStatusLabelsFa: PaymentStatusLabelMap = {
  PENDING: "در انتظار پرداخت",
  COMPLETED: "پرداخت موفق",
  FAILED: "پرداخت ناموفق",
  REFUNDED: "مسترد شده",
}

export function getOrderStatusLabel(status: string | null | undefined, locale = "fa"): string {
  if (!status) return ""
  if (locale === "fa") return orderStatusLabelsFa[status] || status
  return status
}

export function getPaymentStatusLabel(status: string | null | undefined, locale = "fa"): string {
  if (!status) return ""
  if (locale === "fa") return paymentStatusLabelsFa[status] || status
  return status
}
