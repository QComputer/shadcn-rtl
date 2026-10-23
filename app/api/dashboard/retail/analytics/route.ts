import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import { requireRetailMerchantContext } from "@/lib/retail/merchant-context.server";
import { analyticsQuerySchema } from "@/lib/retail/analytics";
import { getRetailAnalytics } from "@/lib/retail/analytics.server";
import { exportRetailAnalytics } from "@/lib/retail/analytics-export";

export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const { context } = await requireRetailMerchantContext();
    const parsed = analyticsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "فیلتر گزارش معتبر نیست.");
    const query = parsed.data;
    const report = await getRetailAnalytics(context, query);
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (!query.format) return NextResponse.json(report, { headers });
    const bytes = exportRetailAnalytics(report, query.report, query.format === "csv" ? "CSV" : "XLSX");
    return new NextResponse(new Uint8Array(bytes), { headers: { ...headers,
      "Content-Type": query.format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="retail-${query.report}-${report.range.from}-${report.range.to}-page-${report.page}.${query.format}"`,
    } });
  } catch (error) { return jsonError(error, "بارگذاری گزارش فروش ناموفق بود."); }
}
