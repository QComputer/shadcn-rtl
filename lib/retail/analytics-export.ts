import type { AnalyticsQuery, RetailAnalyticsReport } from "./analytics";
import { writeRetailSpreadsheet } from "@/lib/import-hub/retail-spreadsheet";

/** Same bounded page/snapshot and filter semantics as the on-screen report, no customer PII. */
export function exportRetailAnalytics(report: RetailAnalyticsReport, kind: AnalyticsQuery["report"], format: "CSV" | "XLSX") {
  const scope = kind === "products" ? `صفحه فعلی عملکرد؛ حداکثر ${report.pageSize} ردیف، نه تمام نتایج`
    : kind === "inventory" ? "هشدارهای موجودی نمایش‌داده‌شده؛ حداکثر ۲۵ ردیف، نه تمام موجودی فروشگاه"
      : "شاخص‌های تجمیعی مطابق بازه و فیلترهای گزارش؛ نه فهرست کامل سفارش‌ها";
  const context: Record<string, string> = { "از تاریخ محلی": report.range.from, "تا تاریخ محلی": report.range.to, "منطقه زمانی": report.range.timezone, "واحد پول": "تومان", "دامنه خروجی": scope, ...(kind === "products" ? { "صفحه عملکرد": String(report.page) } : {}), "فیلترها": JSON.stringify(report.filters) };
  const entries: Record<string, string>[] = kind === "products" ? report.products.map(row => ({
    "شناسه محصول": row.productId, "شناسه واریانت": row.variantId ?? "", "نام هنگام خرید": row.name, SKU: row.sku ?? "", "گزینه‌های هنگام خرید": JSON.stringify(row.options), "تعداد تأییدشده": String(row.quantity), "ارزش اقلام به تومان": row.value,
  })) : kind === "inventory" ? report.inventory.rows.map(row => ({
    "شناسه محصول": row.productId, "شناسه واریانت": row.variantId, "محصول": row.name, SKU: row.sku ?? "", "موجودی قابل استفاده": String(row.quantity), "پیش‌فروش": row.allowBackOrder ? "بله" : "خیر",
  })) : Object.entries(report.summary).map(([metric, value]) => ({ "شاخص": labels[metric] ?? metric, "مقدار": String(value), "واحد": countMetrics.has(metric) ? "تعداد" : "تومان" }));
  const rows = entries.map(row => ({ ...context, ...row }));
  // An empty report exports headers only, never fabricates a zero-value product row.
  const fields = kind === "products" ? ["شناسه محصول", "شناسه واریانت", "نام هنگام خرید", "SKU", "گزینه‌های هنگام خرید", "تعداد تأییدشده", "ارزش اقلام به تومان"]
    : kind === "inventory" ? ["شناسه محصول", "شناسه واریانت", "محصول", "SKU", "موجودی قابل استفاده", "پیش‌فروش"] : ["شاخص", "مقدار", "واحد"];
  const columns = [...Object.keys(context), ...fields];
  return writeRetailSpreadsheet(rows, format, columns);
}

const countMetrics = new Set(["orders", "actionRequired", "fulfilled", "cancelled", "unitsSold", "paymentMismatches"]);
const labels: Record<string, string> = {
  orders: "سفارش‌های ایجادشده", actionRequired: "نیازمند اقدام", fulfilled: "تحویل‌شده", cancelled: "لغوشده",
  grossValue: "ارزش ناخالص سفارش‌های ایجادشده", verifiedCollected: "وصول تأییدشده در بازه دریافت", pendingCollection: "در انتظار دریافت",
  averageOrderValue: "میانگین ارزش سفارش", unitsSold: "واحد خرید تأییدشده", subtotal: "جمع ثبت‌شده کالاها", shipping: "حمل ثبت‌شده", tax: "مالیات ثبت‌شده", discount: "تخفیف ثبت‌شده", paymentMismatches: "مغایرت پرداخت",
};

