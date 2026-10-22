import "server-only";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { customerFulfillment, publicFulfillmentInfoSchema } from "@/lib/retail/fulfillment";

/** Owner-only projection used by the existing Retail confirmation endpoint. */
export async function getRetailCustomerOrder(customerId: string, organization: string, orderNumber: string) {
  const order = await prisma.order.findFirst({ where: {orderNumber, organizationSlug: organization, customerId, retailCheckoutKey: {not: null}, deletedAt: null},
    include: {items: {orderBy: {id: "asc"}}, payment: true, statusHistory: {orderBy: [{createdAt: "asc"},{id: "asc"}], select: {id: true,newStatus: true,note: true,createdAt: true}}} });
  if (!order) throw new ApiError(404,"سفارش پیدا نشد.");
  const metadata=order.payment?.metadata;
  const retail=metadata && typeof metadata==="object" && !Array.isArray(metadata) ? metadata.retailR4 : null;
  const snapshot=retail && typeof retail==="object" && !Array.isArray(retail) ? retail : null;
  const fulfillmentInfo = publicFulfillmentInfoSchema.safeParse(snapshot?.fulfillmentInfo);
  return {fulfillmentInfo: fulfillmentInfo.success ? fulfillmentInfo.data : null, orderNumber: order.orderNumber,total: Number(order.total),subtotal: Number(order.subtotal),discount: Number(order.discount),deliveryFee: Number(order.deliveryFee),
    orderStatus: order.status,paymentStatus: order.paymentStatus,paymentMethod: order.payment?.method ?? order.paymentMethod,type: order.type,
    deliveryAddress: order.deliveryAddress,notes: order.notes,createdAt: order.createdAt.toISOString(),fulfillment: customerFulfillment(order.type,order.status,order.statusHistory),
    items: order.items.map(item=>({id:item.id,productName:item.productNameSnapshot ?? "محصول قدیمی",variantName:item.variantNameSnapshot,sku:item.skuSnapshot,
      options:Array.isArray(item.variantOptionsSnapshot)?item.variantOptionsSnapshot:[],quantity:item.quantity,unitPrice:Number(item.price),lineTotal:Number(item.price.mul(item.quantity).sub(item.discount))})),
    paymentDeadlineAt:typeof snapshot?.paymentDeadlineAt==="string"?snapshot.paymentDeadlineAt:order.retailPaymentDeadlineAt?.toISOString()??null,
    bankCardNumber:typeof snapshot?.bankCardNumber==="string"?snapshot.bankCardNumber:null,bankAccountOwner:typeof snapshot?.bankAccountOwner==="string"?snapshot.bankAccountOwner:null,
    trackingToken:order.payment?.method==="INOTI_USSD"?order.publicTrackingToken:null};
}
