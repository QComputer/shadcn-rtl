import "server-only";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import type { TenantContext } from "@/lib/tenant-context";
import { orderService } from "@/lib/services/order.service";
import { canConfirmRetailCashCollection, formatVariantOptionsSnapshot, getRetailCashModeFromPaymentMetadata } from "@/lib/order-presentation";
import { retailOrderActions } from "@/lib/retail/order-operations";
import { orderedImages, readGallerySettings } from "@/lib/retail/product-galleries";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)), "تاریخ معتبر نیست.");
export const merchantOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20),
  query: z.string().trim().max(100).default(""), status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(), from: date.optional(), to: date.optional(),
  sort: z.enum(["newest", "oldest", "highest"]).default("newest"),
}).strict().refine((v) => !v.from || !v.to || v.from <= v.to, "بازه تاریخ معتبر نیست.");
export const merchantOrderActionSchema = z.object({status: z.nativeEnum(OrderStatus), expectedStatus: z.nativeEnum(OrderStatus)}).strict();

function assertMerchant(context: TenantContext) {
  if (!["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(context.role)) throw new ApiError(403, "دسترسی مدیریت سفارش ندارید.");
}
const select = {
  id: true, orderNumber: true, retailCheckoutKey: true, type: true, status: true, createdAt: true,
  total: true, subtotal: true, deliveryFee: true, tax: true, discount: true, paymentStatus: true, paymentMethod: true,
  deliveryAddress: true, notes: true,
  customer: { select: { name: true, firstName: true, lastName: true, phone: true } },
  guestCustomer: { select: { name: true, phone: true } },
} satisfies Prisma.OrderSelect;
function summary(order: Prisma.OrderGetPayload<{select: typeof select}>) {
  return { id: order.id, orderNumber: order.orderNumber, type: order.type, status: order.status, createdAt: order.createdAt,
    total: Number(order.total), subtotal: Number(order.subtotal), deliveryFee: Number(order.deliveryFee), tax: Number(order.tax), discount: Number(order.discount),
    paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod, deliveryAddress: order.deliveryAddress, notes: order.notes,
    customer: order.customer ? { name: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || order.customer.name,
      phone: order.customer.phone } : order.guestCustomer };
}
export async function listMerchantRetailOrders(context: TenantContext, input: z.infer<typeof merchantOrderQuerySchema>) {
  assertMerchant(context);
  const base: Prisma.OrderWhereInput = { organizationSlug: context.organizationSlug, deletedAt: null,
    ...(input.paymentStatus && { paymentStatus: input.paymentStatus }),
    ...(input.from || input.to ? { createdAt: { ...(input.from && { gte: new Date(input.from + "T00:00:00+03:30") }),
      ...(input.to && { lt: new Date(new Date(input.to + "T00:00:00+03:30").getTime() + 86400000) }) } } : {}),
    ...(input.query ? { OR: [ { orderNumber: { contains: input.query, mode: "insensitive" } },
      { customer: { is: { OR: [{name: {contains: input.query, mode: "insensitive"}}, {firstName: {contains: input.query, mode: "insensitive"}}, {lastName: {contains: input.query, mode: "insensitive"}}, {phone: {contains: input.query}}] } } },
      { guestCustomer: { is: { OR: [{name: {contains: input.query, mode: "insensitive"}}, {phone: {contains: input.query}}] } } } ] } : {}),
  };
  const where = {...base, ...(input.status && {status: input.status})};
  const [orders, total, counts] = await Promise.all([
    prisma.order.findMany({where, select, skip: (input.page - 1) * input.pageSize, take: input.pageSize,
      orderBy: input.sort === "highest" ? [{total: "desc"}, {id: "desc"}] : [{createdAt: input.sort === "oldest" ? "asc" : "desc"}, {id: "desc"}]}),
    prisma.order.count({where}), prisma.order.groupBy({by: ["status"], where: base, _count: {_all: true}}),
  ]);
  return {orders: orders.map(summary), total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total/input.pageSize),
    counts: counts.map((entry) => ({status: entry.status, count: entry._count._all}))};
}
export async function getMerchantRetailOrder(context: TenantContext, orderNumber: string) {
  assertMerchant(context);
  const order = await prisma.order.findFirst({where: {organizationSlug: context.organizationSlug, orderNumber, deletedAt: null},
    select: {...select, payment: {select: {metadata: true}}, statusHistory: {orderBy: [{createdAt: "asc"}, {id: "asc"}]},
      items: {include: {product: {select: {organizationId: true, gallerySettings: true, images: {select: {id: true, url: true, access: true, organizationId: true}}}},
        variant: {select: {productId: true, galleryImages: {orderBy: {sortOrder: "asc"}, select: {image: {select: {url: true, access: true, organizationId: true}}}}}}}}}});
  if (!order) throw new ApiError(404, "سفارش پیدا نشد.");
  const safeImage = (image: {url: string; access: string; organizationId: string | null}) => image.organizationId === context.organizationId && image.access === "PUBLIC" &&
    (image.url.startsWith("/") && !image.url.startsWith("//") || (() => { try {return new URL(image.url).protocol === "https:";} catch {return false;} })());
  const metadata = order.payment?.metadata;
  const retail = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata.retailR4 : null;
  const cashBeforeConfirmation = retail && typeof retail === "object" && !Array.isArray(retail) && retail.cashBeforeConfirmation === true;
  return { ...summary(order), items: order.items.map((item) => {
    const owned = item.product.organizationId === context.organizationId;
    const images = owned ? [...(item.variant?.productId === item.productId ? item.variant.galleryImages.map((entry) => entry.image) : []),
      ...orderedImages(item.product.images, readGallerySettings(item.product.gallerySettings)?.productImageIds ?? [])] : [];
    return {id: item.id, name: item.productNameSnapshot ?? "محصول قدیمی (نام هنگام خرید ثبت نشده)", sku: item.skuSnapshot,
      options: formatVariantOptionsSnapshot(item.variantOptionsSnapshot), variantName: item.variantNameSnapshot,
      quantity: item.quantity, unitPrice: Number(item.price), lineTotal: Number(item.price.mul(item.quantity).sub(item.discount)),
      imageUrl: images.find(safeImage)?.url ?? null};
  }), history: order.statusHistory.map(({id,previousStatus,newStatus,note,createdAt}) => ({id,previousStatus,newStatus,note,createdAt})),
    actions: (order.retailCheckoutKey ? retailOrderActions(order) : []).filter((action) => !(action.status === "ACCEPTED" && order.paymentMethod === "CASH" && order.paymentStatus !== "COMPLETED" && cashBeforeConfirmation)), canConfirmCash: canConfirmRetailCashCollection({...order, retailCashMode: getRetailCashModeFromPaymentMetadata(order.payment?.metadata)}),
    legacyOrder: !order.retailCheckoutKey,
    imageNotice: "تصویر از گالری فعلی همان محصول است؛ نام، مشخصات و مبالغ از سوابق خرید نمایش داده می‌شوند." };
}
export async function changeMerchantRetailOrder(context: TenantContext, orderNumber: string, input: z.infer<typeof merchantOrderActionSchema>) {
  assertMerchant(context);
  const order = await prisma.order.findFirst({where: {organizationSlug: context.organizationSlug, orderNumber, retailCheckoutKey: {not: null}, deletedAt: null}, select: {id: true}});
  if (!order) throw new ApiError(404, "سفارش پیدا نشد.");
  await orderService.updateStatus(order.id, {status: input.status}, context.role, context.actorUserId,
    {organizationSlug: context.organizationSlug, expectedStatus: input.expectedStatus});
  return getMerchantRetailOrder(context, orderNumber);
}
