import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDateDays, analyticsQuerySchema, analyticsRange, localDate } from "@/lib/retail/analytics";
import { exportRetailAnalytics } from "@/lib/retail/analytics-export";
import type { RetailAnalyticsReport } from "@/lib/retail/analytics";
import * as XLSX from "xlsx";
import { getDashboardRouteAccessDecision } from "@/lib/dashboard/navigation-policy";
import { checkRouteAccess } from "@/lib/access-control";

describe("Retail R5 analytics query and range contracts", () => {
  it("registers analytics in both existing dashboard guards with merchant-only SHOP access", () => {
    for (const role of ["ADMIN", "MANAGER"] as const) {
      assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: "/fa/dashboard/retail-analytics", role, capabilities: ["SHOP"] }).isAllowed, true);
      assert.equal(checkRouteAccess("/fa/dashboard/retail-analytics", { userId: "qa", userRole: role, organizationId: "shop", organizationType: "SHOP", organizationCapabilities: ["SHOP"] }).hasAccess, true);
    }
    assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: "/fa/dashboard/retail-analytics", role: "STAFF", capabilities: ["SHOP"] }).isAllowed, false);
    assert.equal(getDashboardRouteAccessDecision({ locale: "fa", pathname: "/fa/dashboard/retail-analytics", role: "ADMIN", capabilities: ["APPOINTMENT"] }).isAllowed, false);
  });
  it("defaults to a 30-day range, summary, first page, and bounded low-stock threshold", () => {
    assert.deepEqual(analyticsQuerySchema.parse({}), {
      range: "30d", ranking: "quantity", page: 1, report: "summary",
    });
  });

  it("requires a valid ordered custom range and rejects unknown filters", () => {
    assert.equal(analyticsQuerySchema.safeParse({ range: "custom", from: "2026-02-30", to: "2026-03-01" }).success, false);
    assert.equal(analyticsQuerySchema.safeParse({ range: "custom", from: "2026-03-02", to: "2026-03-01" }).success, false);
    assert.equal(analyticsQuerySchema.safeParse({ range: "custom", from: "2025-03-01", to: "2026-03-02" }).success, false);
    assert.equal(analyticsQuerySchema.safeParse({ surprise: true }).success, false);
    assert.equal(analyticsQuerySchema.safeParse({ page: 0 }).success, false);
  });

  it("uses tenant-local calendar dates for presets across UTC date boundaries", () => {
    const now = new Date("2026-03-31T20:31:00.000Z");
    assert.equal(localDate(now, "Asia/Tehran"), "2026-04-01");
    assert.deepEqual(analyticsRange(analyticsQuerySchema.parse({ range: "today" }), "Asia/Tehran", now), {
      from: "2026-04-01", to: "2026-04-01", timezone: "Asia/Tehran",
    });
    assert.deepEqual(analyticsRange(analyticsQuerySchema.parse({ range: "7d" }), "Asia/Tehran", now), {
      from: "2026-03-26", to: "2026-04-01", timezone: "Asia/Tehran",
    });
  });

  it("keeps calendar-day preset lengths stable across a DST transition", () => {
    const now = new Date("2026-03-08T16:00:00.000Z");
    assert.equal(localDate(now, "America/New_York"), "2026-03-08");
    assert.deepEqual(analyticsRange(analyticsQuerySchema.parse({ range: "7d" }), "America/New_York", now), {
      from: "2026-03-02", to: "2026-03-08", timezone: "America/New_York",
    });
    assert.equal(addDateDays("2026-03-08", 1), "2026-03-09");
  });

  it("exports bounded product rows as safe CSV and XLSX, and an empty report as headers only", () => {
    const report = {
      range: { from: "2026-04-01", to: "2026-04-01", timezone: "Asia/Tehran" },
      page: 1, filters: { status: "DELIVERED" },
      summary: { orders: 1, actionRequired: 0, fulfilled: 1, cancelled: 0, grossValue: "205.15", verifiedCollected: "205.15", pendingCollection: "0", averageOrderValue: "205.15", unitsSold: 2, subtotal: "200.20", shipping: "10.05", tax: "0", discount: "5.10", paymentMismatches: 0 },
      trends: [], statuses: [], productTotal: 1,
      products: [{ productId: "product-1", variantId: null, name: "=HYPERLINK(\"bad\")", sku: "000007", options: { size: "M" }, quantity: 2, value: "195.15" }],
      inventory: { tracked: 0, untracked: 0, backorder: 0, lowStock: 0, outOfStock: 0, incompleteProducts: 0, rows: [], movements: [] },
      customers: { purchasing: 1, new: 1, returning: 0, repeatRate: "0.00" }, fulfillment: [], definitions: [], limitations: [], generatedAt: "2026-04-01T12:00:00.000Z", queryMilliseconds: 1,
    } as RetailAnalyticsReport;
    const csv = exportRetailAnalytics(report, "products", "CSV").toString("utf8");
    assert.ok(csv.startsWith("\uFEFF"));
    assert.match(csv, /2026-04-01/);
    assert.match(csv, /'=HYPERLINK/);
    assert.doesNotMatch(csv, /phone|email|customer/i);

    const xlsx = XLSX.read(exportRetailAnalytics(report, "products", "XLSX"), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(xlsx.Sheets.Retail!, { defval: "" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.SKU, "000007");
    assert.equal(rows[0]?.["نام هنگام خرید"], '=HYPERLINK("bad")');
    assert.equal(rows[0]?.["ارزش اقلام به تومان"], "195.15");

    const emptyReport = { ...report, products: [], productTotal: 0 } as RetailAnalyticsReport;
    const emptyCsv = exportRetailAnalytics(emptyReport, "products", "CSV").toString("utf8");
    assert.ok(emptyCsv.includes("منطقه زمانی"));
    assert.equal(emptyCsv.split("\r\n").length, 1);
  });
});

