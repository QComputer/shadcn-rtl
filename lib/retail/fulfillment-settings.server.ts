import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import type { TenantContext } from "@/lib/tenant-context";
import { fulfillmentUpdateSchema, readFulfillmentDetails } from "@/lib/retail/fulfillment";
import type { z } from "zod";

function assertMerchant(context: TenantContext) {
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(context.role)) throw new ApiError(403, "دسترسی تنظیمات دریافت سفارش ندارید.");
}
async function project(tx: Prisma.TransactionClient, context: TenantContext) {
  const org = await tx.organization.findFirst({where: {id: context.organizationId, slug: context.organizationSlug, deletedAt: null, isActive: true},
    select: {address: true, phone: true, settings: {select: {settings: true, enablePickup: true, enableDelivery: true, deliveryFee: true, updatedAt: true}}}});
  if (!org) throw new ApiError(404, "فروشگاه پیدا نشد.");
  const settings = {enablePickup: org.settings?.enablePickup ?? true, enableDelivery: org.settings?.enableDelivery ?? true,
    deliveryFee: org.settings?.deliveryFee ?? null, ...readFulfillmentDetails(org.settings?.settings)};
  if (!settings.pickupAddress) settings.pickupAddress = org.address ?? "";
  return {settings, contact: {address: org.address, phone: org.phone}, version: createHash("sha256").update(JSON.stringify([settings, org.settings?.updatedAt, org.address, org.phone])).digest("hex")};
}
export async function getRetailFulfillmentSettings(context: TenantContext) {assertMerchant(context);return project(prisma, context);}
export async function updateRetailFulfillmentSettings(context: TenantContext, raw: z.infer<typeof fulfillmentUpdateSchema>) {
  assertMerchant(context); const input = fulfillmentUpdateSchema.parse(raw);
  const result = await prisma.$transaction(async tx => {
    // Serialize creation and updates without adding a second settings store.
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${context.organizationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "OrganizationSettings" WHERE "organizationSlug" = ${context.organizationSlug} FOR UPDATE`;
    const previous = await project(tx, context);
    if (previous.version !== input.expectedVersion) throw new ApiError(409, "تنظیمات تغییر کرده است؛ اطلاعات تازه را دریافت کنید و دوباره بررسی کنید.");
    const row = await tx.organizationSettings.findUnique({where: {organizationSlug: context.organizationSlug}, select: {settings: true}});
    const root = row?.settings && typeof row.settings === "object" && !Array.isArray(row.settings) ? row.settings : {};
    const {enablePickup, enableDelivery, deliveryFee} = input;
    const details = {pickupAddress: input.pickupAddress, pickupInstructions: input.pickupInstructions, deliveryRestrictions: input.deliveryRestrictions, fulfillmentInstructions: input.fulfillmentInstructions};
    const data = {enablePickup, enableDelivery, deliveryFee, settings: {...root, retailFulfillment: details} as Prisma.InputJsonValue};
    const saved = await tx.organizationSettings.upsert({where: {organizationSlug: context.organizationSlug}, create: {organizationSlug: context.organizationSlug, ...data}, update: data});
    await tx.auditLog.create({data: {action: "UPDATE", entityType: "RetailFulfillmentSettings", entityId: saved.id, userId: context.actorUserId,
      organizationId: context.organizationId, organizationSlug: context.organizationSlug, description: "Updated retail fulfillment configuration",
      previousValue: previous.settings, newValue: {enablePickup,enableDelivery,deliveryFee,...details}}});
    return project(tx, context);
  });
  for (const locale of ["fa", "en", "ar"]) revalidatePath(`/${locale}/${context.organizationSlug}/shop`);return result;
}
