import { retailOrderStatusLabel } from "@/lib/retail/order-operations";
import type { FulfillmentDetails, customerFulfillment } from "@/lib/retail/fulfillment";
export type CheckoutOption = { key?: string; label?: string; value: string | number | boolean | null; displayUnit?: string | null };
export type CheckoutCartItem = {
  id: string; variantId?: string; quantity: number; unitPrice: number;
  availability?: { orderable: boolean; maxQuantity: number | null; reason: string | null };
  variant: { id: string; name: string | null; sku: string | null; options?: CheckoutOption[];
    media?: { image?: string | null; gallery: string[] };
    product: { id: string; name: string; slug?: string | null; brand?: string | null; image?: string | null } };
};
export type CheckoutCart = { id?: string; items: CheckoutCartItem[]; subtotal: number; itemCount: number };
export type CheckoutQuote = {
  reviewToken: string; subtotal: number; discount: number; deliveryFee: number; total: number; currency: "TOMAN";
  items: Array<{ id: string; variantId: string; quantity: number; unitPrice: number; lineTotal: number; orderable: boolean; reason: string | null }>;
  fulfillmentInfo?: FulfillmentDetails & {contact: string | null};
  fulfillment: Array<{ type: "PICK_UP" | "DELIVERY"; label: string; fee: number }>;
  customer: { name: string | null; mobile: string | null; address?: string | null }; issues: string[];
};
export type CheckoutPaymentMethod = { method: "BANK_TRANSFER" | "CASH" | "INOTI_USSD"; label: string; cashModes?: string[]; bankCardNumber?: string | null; bankAccountOwner?: string | null; dialString?: string };
export type CheckoutOrder = {
  orderNumber: string; total: number; subtotal: number; discount: number; deliveryFee: number;
  orderStatus: string; paymentStatus: string; paymentMethod: string | null; type: string;
  deliveryAddress: string | null; notes?: string | null; createdAt: string;
  fulfillmentInfo?: (FulfillmentDetails & {contact: string | null}) | null;
  fulfillment?: ReturnType<typeof customerFulfillment>;
  trackingToken?: string | null; paymentDeadlineAt?: string | null; bankCardNumber?: string | null; bankAccountOwner?: string | null;
  items: Array<{ id: string; productName: string; variantName: string | null; sku: string | null; options: CheckoutOption[]; quantity: number; unitPrice: number; lineTotal: number; image?: string | null }>;
};

export const checkoutMoney = (value: number) => `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value)} تومان`;
export const checkoutDigits = (value: string) => value.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
export const checkoutOptionLabel = (option: CheckoutOption) => `${option.label ? `${option.label}: ` : ""}${option.value ?? ""}${option.displayUnit ? ` ${option.displayUnit}` : ""}`;
export const checkoutItemImage = (item: CheckoutCartItem) => item.variant.media?.gallery[0] ?? item.variant.media?.image ?? item.variant.product.image ?? null;
export const checkoutItemTotal = (item: CheckoutCartItem) => item.unitPrice * item.quantity;
export const checkoutQuantityValid = (quantity: number, maximum: number | null = null) => Number.isInteger(quantity) && quantity >= 1 && quantity <= 99 && (maximum === null || quantity <= maximum);
export function checkoutPaymentState(status: string) {
  const states: Record<string, string> = { PENDING: "پرداخت در انتظار است", UNPAID: "پرداخت نشده", AWAITING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", COMPLETED: "پرداخت تکمیل شده", FAILED: "پرداخت ناموفق", CANCELLED: "پرداخت لغو شده", REFUNDED: "وجه بازگردانده شده" };
  return states[status] ?? "وضعیت پرداخت نیازمند بررسی است";
}
export function checkoutOrderState(status: string, type?: string) {
  if (type) return retailOrderStatusLabel(status, type);
  const states: Record<string, string> = { PENDING: "ثبت‌شده؛ در انتظار بررسی فروشگاه", CONFIRMED: "تأیید شده", PROCESSING: "در حال آماده‌سازی", PREPARING: "در حال آماده‌سازی", READY: "آماده تحویل", DELIVERING: "در حال ارسال", DELIVERED: "تحویل داده شده", COMPLETED: "تکمیل شده", CANCELLED: "لغو شده" };
  return states[status] ?? "وضعیت سفارش نیازمند بررسی است";
}
export function checkoutError(value: unknown) {
  const message = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : value instanceof Error ? value.message : "";
  if (/review|changed|quote|stale/i.test(message)) return "اطلاعات سفارش تغییر کرده است. مبلغ و موجودی به‌روز را بررسی و دوباره تأیید کنید.";
  if (/stock|inventory|unavailable product|unavailable category/i.test(message)) return "موجودی یا وضعیت یکی از کالاها تغییر کرده است. تعداد و گزینه‌های سبد را بررسی کنید.";
  if (/coupon|discount/i.test(message)) return "کد تخفیف برای این سفارش قابل استفاده نیست؛ کد و شرایط آن را بررسی کنید.";
  if (/delivery|fulfillment|pickup/i.test(message)) return "روش دریافت انتخاب‌شده در دسترس نیست؛ گزینه‌های دریافت را دوباره بررسی کنید.";
  if (/payment|cash/i.test(message)) return "روش پرداخت در دسترس نیست؛ یک روش مجاز دیگر انتخاب کنید.";
  if (/empty/i.test(message)) return "سبد خرید خالی است؛ ابتدا کالایی انتخاب کنید.";
  if (/invalid|details/i.test(message)) return "اطلاعات واردشده معتبر نیست؛ بخش‌های مشخص‌شده را بررسی کنید.";
  if (/[\u0600-\u06FF]/.test(message)) return message;
  return "ارتباط با فروشگاه برقرار نشد؛ دوباره تلاش کنید. در صورت نامشخص بودن نتیجه ثبت سفارش، همین صفحه را نگه دارید.";
}
export function checkoutFormErrors(input: { type: string; deliveryAddress: string; recipientName: string; recipientMobile: string; paymentMethod: string; cashMode: string }, modes: string[]) {
  const errors: Record<string, string> = {};
  if (!input.paymentMethod) errors.paymentMethod = "روش پرداخت را انتخاب کنید.";
  if (input.paymentMethod === "CASH" && !modes.includes(input.cashMode)) errors.cashMode = "شیوه پرداخت نقدی مناسب روش دریافت را انتخاب کنید.";
  if (input.type === "DELIVERY") {
    if (input.deliveryAddress.trim().length < 8) errors.deliveryAddress = "نشانی کامل تحویل را وارد کنید.";
    if (input.recipientName.trim().length < 2) errors.recipientName = "نام گیرنده را وارد کنید.";
    if (!/^(?:09\d{9}|\+989\d{9})$/.test(checkoutDigits(input.recipientMobile).replace(/[\s-]/g, ""))) errors.recipientMobile = "شماره همراه معتبر گیرنده را وارد کنید.";
  }
  return errors;
}
