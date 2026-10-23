import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import type { TenantContext } from "@/lib/tenant-context";
import { addDateDays, analyticsRange, type AnalyticsQuery, type RetailAnalyticsReport } from "./analytics";

export async function getRetailAnalytics(context: TenantContext, input: AnalyticsQuery): Promise<RetailAnalyticsReport> {
  if (!["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(context.role)) throw new ApiError(403, "دسترسی گزارش فروش ندارید.");
  const started = performance.now();
  const organization = await prisma.organization.findFirst({ where: { id: context.organizationId, slug: context.organizationSlug, isActive: true, deletedAt: null }, select: { timezone: true } });
  if (!organization) throw new ApiError(404, "فروشگاه پیدا نشد.");
  const range = analyticsRange(input, organization.timezone);
  const start = Prisma.sql`((${range.from}::date::timestamp AT TIME ZONE ${range.timezone}) AT TIME ZONE 'UTC')`;
  const end = Prisma.sql`((${addDateDays(range.to, 1)}::date::timestamp AT TIME ZONE ${range.timezone}) AT TIME ZONE 'UTC')`;
  const dates = Prisma.sql`o."createdAt" >= ${start} AND o."createdAt" < ${end}`;
  const productScope = Prisma.sql`p."organizationId" = ${context.organizationId}
    ${input.productId ? Prisma.sql`AND p.id = ${input.productId}` : Prisma.empty}
    ${input.categoryId ? Prisma.sql`AND (p."categoryId" = ${input.categoryId} OR EXISTS (SELECT 1 FROM "ProductCategoryAssignment" ca WHERE ca."productId"=p.id AND ca."categoryId"=${input.categoryId}))` : Prisma.empty}`;
  // EXISTS scopes whole orders. It deliberately does not multiply orders by items.
  const scope = Prisma.sql`o."organizationSlug"=${context.organizationSlug} AND o."deletedAt" IS NULL AND o."retailCheckoutKey" IS NOT NULL
    ${input.status ? Prisma.sql`AND o.status::text=${input.status}` : Prisma.empty}
    ${input.paymentStatus ? Prisma.sql`AND o."paymentStatus"::text=${input.paymentStatus}` : Prisma.empty}
    ${input.productId || input.categoryId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "OrderItem" i JOIN "Product" p ON p.id=i."productId" WHERE i."orderId"=o.id AND ${productScope})` : Prisma.empty}`;
  // One Payment per order is guaranteed by the existing unique orderId key.
  // Events/attempts/reports are never summed as financial transactions.
  const verified = Prisma.sql`o."paymentStatus"='COMPLETED' AND pay.status='COMPLETED' AND pay.amount=o.total
    AND (o."paymentMethod" IS DISTINCT FROM 'CASH' OR EXISTS (SELECT 1 FROM "RetailPaymentReport" r WHERE r."orderId"=o.id AND r."organizationId"=${context.organizationId} AND r.kind='CASH_COLLECTION' AND r.status='APPROVED' AND r."reviewedAt" IS NOT NULL AND r."reviewedById" IS NOT NULL))`;
  const paidPeriod = Prisma.sql`o."paidAt" >= ${start} AND o."paidAt" < ${end}`;
  const paidItems = Prisma.sql`${scope} AND ${dates} AND ${verified} AND o.status NOT IN ('CANCELLED','REFUNDED')`;
  const threshold = input.lowStock === undefined ? Prisma.sql`p."lowStockThreshold"` : Prisma.sql`${input.lowStock}`;
  const inventoryScope = Prisma.sql`${productScope} AND p."deletedAt" IS NULL AND v."deletedAt" IS NULL`;
  const values = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '15000'`;
    const summary = await tx.$queryRaw<RetailAnalyticsReport["summary"][]>(Prisma.sql`
      SELECT count(*)::int orders,
        count(*) FILTER (WHERE o.status IN ('PENDING','PLACED','ACCEPTED','PREPARING','READY') OR (o.type='DELIVERY' AND o.status='PICKED_UP'))::int "actionRequired",
        count(*) FILTER (WHERE o.status IN ('DELIVERED','RECEIVED') OR (o.type='PICK_UP' AND o.status='PICKED_UP'))::int fulfilled,
        count(*) FILTER (WHERE o.status='CANCELLED')::int cancelled,
        coalesce(sum(o.total),0)::text "grossValue", coalesce(round(avg(o.total),2),0)::text "averageOrderValue",
        coalesce(sum(o.subtotal),0)::text subtotal, coalesce(sum(o."deliveryFee"),0)::text shipping,
        coalesce(sum(o.tax),0)::text tax, coalesce(sum(o.discount),0)::text discount,
        coalesce(sum(o.total) FILTER (WHERE o."paymentStatus"='PENDING' AND o.status NOT IN ('CANCELLED','REFUNDED')),0)::text "pendingCollection",
        count(*) FILTER (WHERE (o."paymentStatus"='COMPLETED' OR pay.status='COMPLETED') AND (NOT coalesce((${verified}),false) OR o."paidAt" IS NULL))::int "paymentMismatches"
      FROM "Order" o LEFT JOIN "Payment" pay ON pay."orderId"=o.id WHERE ${scope} AND ${dates}`);
    const collections = await tx.$queryRaw<{ amount: string }[]>(Prisma.sql`SELECT coalesce(sum(pay.amount),0)::text amount FROM "Order" o JOIN "Payment" pay ON pay."orderId"=o.id WHERE ${scope} AND ${verified} AND ${paidPeriod}`);
    const trends = await tx.$queryRaw<RetailAnalyticsReport["trends"]>(Prisma.sql`
      WITH days AS (SELECT generate_series(${range.from}::date,${range.to}::date,'1 day')::date AS bucket),
      orders AS (SELECT ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${range.timezone})::date AS bucket,count(*)::int n,sum(o.total) amount FROM "Order" o WHERE ${scope} AND ${dates} GROUP BY 1),
      receipts AS (SELECT ((o."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${range.timezone})::date AS bucket,sum(pay.amount) amount FROM "Order" o JOIN "Payment" pay ON pay."orderId"=o.id WHERE ${scope} AND ${verified} AND ${paidPeriod} GROUP BY 1)
      SELECT to_char(days.bucket,'YYYY-MM-DD') date,coalesce(orders.n,0)::int orders,coalesce(orders.amount,0)::text "grossValue",coalesce(receipts.amount,0)::text collected FROM days LEFT JOIN orders USING(bucket) LEFT JOIN receipts USING(bucket) ORDER BY days.bucket`);
    const statuses = await tx.$queryRaw<RetailAnalyticsReport["statuses"]>(Prisma.sql`SELECT o.status::text status,o."paymentStatus"::text "paymentStatus",count(*)::int count FROM "Order" o WHERE ${scope} AND ${dates} GROUP BY 1,2 ORDER BY 1,2`);
    const itemScope = input.productId || input.categoryId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Product" p WHERE p.id=i."productId" AND ${productScope})` : Prisma.empty;
    const itemGroups = Prisma.sql`SELECT i."productId",i."variantId",coalesce(i."productNameSnapshot",'محصول قدیمی؛ نام خرید ثبت نشده') name,i."skuSnapshot" sku,i."variantOptionsSnapshot" options,sum(i.quantity)::int quantity,sum(i.price*i.quantity-i.discount)::text value FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId" JOIN "Payment" pay ON pay."orderId"=o.id WHERE ${paidItems} AND EXISTS (SELECT 1 FROM "Product" owned WHERE owned.id=i."productId" AND owned."organizationId"=${context.organizationId}) ${itemScope} GROUP BY i."productId",i."variantId",i."productNameSnapshot",i."skuSnapshot",i."variantOptionsSnapshot"`;
    const products = await tx.$queryRaw<RetailAnalyticsReport["products"]>(Prisma.sql`${itemGroups} ORDER BY ${input.ranking === "value" ? Prisma.sql`sum(i.price*i.quantity-i.discount)` : Prisma.sql`sum(i.quantity)`} DESC,i."productId",i."variantId" NULLS FIRST,name,sku NULLS FIRST,i."variantOptionsSnapshot"::text NULLS FIRST LIMIT 20 OFFSET ${(input.page - 1) * 20}`);
    const itemSummary = await tx.$queryRaw<{ total: number; units: number }[]>(Prisma.sql`SELECT count(*)::int total,coalesce(sum(quantity),0)::int units FROM (${itemGroups}) groups`);
    const inventory = await tx.$queryRaw<Omit<RetailAnalyticsReport["inventory"], "rows" | "incompleteProducts" | "movements">[]>(Prisma.sql`SELECT count(*) FILTER (WHERE p."trackInventory")::int tracked,count(*) FILTER (WHERE NOT p."trackInventory")::int untracked,count(*) FILTER (WHERE v."allowBackOrder")::int backorder,count(*) FILTER (WHERE p."trackInventory" AND v.inventory-v."reservedQuantity">0 AND v.inventory-v."reservedQuantity"<=${threshold})::int "lowStock",count(*) FILTER (WHERE p."trackInventory" AND v.inventory-v."reservedQuantity"<=0 AND NOT v."allowBackOrder")::int "outOfStock" FROM "ProductVariant" v JOIN "Product" p ON p.id=v."productId" WHERE ${inventoryScope}`);
    const rows = await tx.$queryRaw<RetailAnalyticsReport["inventory"]["rows"]>(Prisma.sql`SELECT p.id "productId",v.id "variantId",p.name,v.sku,(v.inventory-v."reservedQuantity") quantity,v."allowBackOrder" FROM "ProductVariant" v JOIN "Product" p ON p.id=v."productId" WHERE ${inventoryScope} AND p."trackInventory" AND v.inventory-v."reservedQuantity"<=${threshold} ORDER BY (v.inventory-v."reservedQuantity"),v.id LIMIT 25`);
    const movements = await tx.$queryRaw<RetailAnalyticsReport["inventory"]["movements"]>(Prisma.sql`SELECT m.id,v.sku,m."quantityDelta" delta,m.reason::text reason,to_char(m."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') at FROM "InventoryMovement" m JOIN "ProductVariant" v ON v.id=m."variantId" JOIN "Product" p ON p.id=v."productId" WHERE ${productScope} AND m."createdAt">=${start} AND m."createdAt"<${end} ORDER BY m."createdAt" DESC,m.id LIMIT 20`);
    const incomplete = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int count FROM "Product" p WHERE ${productScope} AND p."deletedAt" IS NULL AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId"=p.id AND v."deletedAt" IS NULL AND coalesce(v.price,p."basePrice")>0)`);
    const customers = await tx.$queryRaw<{ purchasing: number; new: number; returning: number }[]>(Prisma.sql`WITH purchasers AS (SELECT DISTINCT o."customerId" id FROM "Order" o JOIN "Payment" pay ON pay."orderId"=o.id WHERE ${paidItems} AND o."customerId" IS NOT NULL), classified AS (SELECT id,EXISTS (SELECT 1 FROM "Order" old JOIN "Payment" pp ON pp."orderId"=old.id WHERE old."customerId"=purchasers.id AND old."organizationSlug"=${context.organizationSlug} AND old."retailCheckoutKey" IS NOT NULL AND old."deletedAt" IS NULL AND old."createdAt"<${start} AND old.status NOT IN ('CANCELLED','REFUNDED') AND old."paymentStatus"='COMPLETED' AND pp.status='COMPLETED' AND pp.amount=old.total AND (old."paymentMethod" IS DISTINCT FROM 'CASH' OR EXISTS (SELECT 1 FROM "RetailPaymentReport" r WHERE r."orderId"=old.id AND r."organizationId"=${context.organizationId} AND r.kind='CASH_COLLECTION' AND r.status='APPROVED' AND r."reviewedAt" IS NOT NULL AND r."reviewedById" IS NOT NULL))) "returning" FROM purchasers) SELECT count(*)::int purchasing,count(*) FILTER (WHERE NOT "returning")::int new,count(*) FILTER (WHERE "returning")::int "returning" FROM classified`);
    const fulfillment = await tx.$queryRaw<RetailAnalyticsReport["fulfillment"]>(Prisma.sql`SELECT o.type::text type,count(*)::int count FROM "Order" o WHERE ${scope} AND ${dates} GROUP BY 1 ORDER BY 1`);
    return { summary: { ...summary[0], verifiedCollected: collections[0].amount, unitsSold: itemSummary[0].units }, trends, statuses, products, productTotal: itemSummary[0].total,
      inventory: { ...inventory[0], incompleteProducts: incomplete[0].count, rows, movements }, customers: { ...customers[0], repeatRate: customers[0].purchasing ? new Prisma.Decimal(customers[0].returning).mul(100).div(customers[0].purchasing).toFixed(2) : "0" }, fulfillment };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 25000 });
  return { ...values, range, filters: {status: input.status, paymentStatus: input.paymentStatus, productId: input.productId, categoryId: input.categoryId, lowStock: input.lowStock, ranking: input.ranking}, page: input.page, pageSize: 20, generatedAt: new Date().toISOString(), queryMilliseconds: Math.round(performance.now() - started),
    definitions: [
      "ارزش ناخالص = مجموع total ثبت‌شده سفارش‌های ایجادشده در بازه، شامل لغوشده‌ها؛ این عدد درآمد وصول‌شده نیست.",
      "وصول تأییدشده = مبلغ یکتای Payment با وضعیت COMPLETED در هر دو رکورد سفارش و پرداخت، مبلغ برابر با total و paidAt در بازه؛ وجه نقد به تأیید ثبت‌شده دریافت نیاز دارد. سفارش لغوشده با دریافت معتبر همچنان در وصول می‌آید.",
      "مانده در انتظار = total سفارش‌های ایجادشده در بازه با پرداخت PENDING، به‌جز لغوشده و مرجوع‌شده؛ پرداخت FAILED مطالبات تأییدشده محسوب نمی‌شود.",
      "میانگین ارزش سفارش = ارزش ناخالص تقسیم بر تعداد سفارش‌های ایجادشده؛ حمل، مالیات و تخفیف مستقیماً از مقادیر سفارش خوانده می‌شوند و دوباره به total اضافه نمی‌شوند.",
      "عملکرد کالا و تعداد فروش = اقلام سفارش‌های ایجادشده در بازه با پرداخت تأییدشده و غیرلغوشده/غیرمرجوع؛ ارزش قلم = قیمت خرید × تعداد − تخفیف قلم، بدون تخصیص حمل یا تخفیف کل سفارش.",
      "مشتری بازگشتی = شناسه حساب دارای خرید تأییدشده پیش از شروع بازه در همین فروشگاه؛ نرخ = بازگشتی / مشتریان خریدار شناسایی‌شده. مهمانان و نام/تلفن مشابه ادغام نمی‌شوند.",
      "موجودی، لحظه‌ای است و فقط فیلتر محصول/دسته را می‌پذیرد؛ اتمام موجودی فقط برای کالای رهگیری‌شده بدون پیش‌فروش است. کالای بدون واریانت موجودی صفر تلقی نمی‌شود.",
    ], limitations: [
      "گزارش فقط سفارش‌های Retail دارای کلید checkout را پوشش می‌دهد؛ سفارش‌های قدیمی فاقد این نشانگر جدا هستند.",
      "مبالغ به تومان هستند. بازپرداخت مالیِ قابل تطبیق پشتیبانی نمی‌شود؛ درآمد خالص و مبلغ بازپرداخت نمایش داده نمی‌شود. وضعیت REFUNDED به‌تنهایی سند بازپرداخت نیست.",
      "نام، SKU و گزینه‌های تاریخی از snapshot خریدند. برند و دسته تاریخی در snapshot موجود نیست؛ فیلتر دسته براساس دسته فعلی است و انتخاب محصول/دسته، کل سفارش متناظر را برای KPI انتخاب می‌کند.",
      "بازه وصول براساس زمان دریافت است؛ بنابراین الزاماً با سفارش‌های ایجادشده همان بازه برابر نیست. پرداخت‌های فاقد paidAt در روند وصول منظور نمی‌شوند.",
      "فهرست هشدار موجودی حداکثر ۲۵ ردیف و عملکرد محصول هر صفحه ۲۰ ردیف است؛ خروجی عملکرد، همان صفحه و خروجی موجودی همان هشدارهای نمایش‌داده‌شده است.",
    ] };
}
