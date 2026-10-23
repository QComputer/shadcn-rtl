import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "تاریخ معتبر نیست.");
export const analyticsQuerySchema = z.object({
  range: z.enum(["today", "7d", "30d", "month", "custom"]).default("30d"),
  from: date.optional(), to: date.optional(),
  status: z.enum(["PENDING", "PLACED", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "DELIVERED", "RECEIVED", "CANCELLED", "REFUNDED"]).optional(),
  paymentStatus: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]).optional(),
  productId: z.string().trim().min(1).max(100).optional(), categoryId: z.string().trim().min(1).max(100).optional(),
  ranking: z.enum(["quantity", "value"]).default("quantity"),
  page: z.coerce.number().int().min(1).max(10000).default(1), lowStock: z.coerce.number().int().min(0).max(1000).optional(),
  format: z.enum(["csv", "xlsx"]).optional(), report: z.enum(["summary", "products", "inventory"]).default("summary"),
}).strict().superRefine((v, ctx) => {
  if (v.range === "custom" && (!v.from || !v.to || v.from > v.to || (Date.parse(v.to) - Date.parse(v.from)) / 86400000 > 365))
    ctx.addIssue({ code: "custom", message: "بازه دلخواه باید معتبر و حداکثر ۳۶۶ روز باشد.", path: ["from"] });
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export function localDate(at: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
export function addDateDays(date: string, days: number) { return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10); }
/** Reporting boundaries are interpreted by PostgreSQL AT TIME ZONE using the tenant's IANA timezone. */
export function analyticsRange(input: AnalyticsQuery, timezone: string, now = new Date()) {
  const today = localDate(now, timezone);
  const from = input.range === "custom" ? input.from! : input.range === "month" ? today.slice(0, 8) + "01" : addDateDays(today, input.range === "7d" ? -6 : input.range === "30d" ? -29 : 0);
  const to = input.range === "custom" ? input.to! : today;
  return { from, to, timezone };
}
export type RetailAnalyticsReport = {
  range: { from: string; to: string; timezone: string }; filters: {status?: string; paymentStatus?: string; productId?: string; categoryId?: string; lowStock?: number; ranking?: string};
  summary: { orders: number; actionRequired: number; fulfilled: number; cancelled: number; grossValue: string; verifiedCollected: string; pendingCollection: string; averageOrderValue: string; unitsSold: number; subtotal: string; shipping: string; tax: string; discount: string; paymentMismatches: number };
  trends: { date: string; orders: number; grossValue: string; collected: string }[];
  statuses: { status: string; paymentStatus: string; count: number }[];
  products: { productId: string; variantId: string | null; name: string; sku: string | null; options: unknown; quantity: number; value: string }[];
  productTotal: number; page: number; pageSize: number;
  inventory: { tracked: number; untracked: number; backorder: number; lowStock: number; outOfStock: number; incompleteProducts: number; rows: { productId: string; variantId: string; name: string; sku: string | null; quantity: number; allowBackOrder: boolean }[]; movements: {id: string; sku: string | null; delta: number; reason: string; at: string}[] };
  customers: { purchasing: number; new: number; returning: number; repeatRate: string };
  fulfillment: { type: string; count: number }[];
  definitions: string[]; limitations: string[]; generatedAt: string; queryMilliseconds: number;
};
