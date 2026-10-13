import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-guards";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { loyaltyCouponsService } from "@/lib/services/loyalty-coupons.service";

const optionalMoney = z.number().finite().nonnegative().max(9_999_999_999).nullable().optional();
const optionalLimit = z.number().int().positive().max(1_000_000).nullable().optional();
const optionalDate = z.string().datetime({ offset: true }).nullable().optional();

export const retailDiscountInput = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.number().finite().positive().max(9_999_999_999),
  minOrderTotal: optionalMoney,
  maxDiscountAmount: optionalMoney,
  startsAt: optionalDate,
  expiresAt: optionalDate,
  usageLimit: optionalLimit,
  perCustomerLimit: optionalLimit,
  isActive: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.discountType === "PERCENTAGE" && value.discountValue > 100) {
    context.addIssue({ code: "custom", path: ["discountValue"], message: "Percentage cannot exceed 100." });
  }
  if (value.startsAt && value.expiresAt && Date.parse(value.startsAt) > Date.parse(value.expiresAt)) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry must follow the start date." });
  }
});

export const retailDiscountStatusInput = z.object({ isActive: z.boolean() }).strict();

function serialize(coupon: {
  id: string; code: string; name: string; discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: Prisma.Decimal; minOrderTotal: Prisma.Decimal | null;
  maxDiscountAmount: Prisma.Decimal | null; startsAt: Date | null; expiresAt: Date | null;
  usageLimit: number | null; usedCount: number; perCustomerLimit: number | null; isActive: boolean;
}) {
  return {
    id: coupon.id, code: coupon.code, name: coupon.name, discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue), minOrderTotal: coupon.minOrderTotal === null ? null : Number(coupon.minOrderTotal),
    maxDiscountAmount: coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount),
    startsAt: coupon.startsAt?.toISOString() ?? null, expiresAt: coupon.expiresAt?.toISOString() ?? null,
    usageLimit: coupon.usageLimit, usedCount: coupon.usedCount,
    perCustomerLimit: coupon.perCustomerLimit, isActive: coupon.isActive,
  };
}

export async function listRetailDiscounts(organizationId: string) {
  const coupons = await prisma.coupon.findMany({
    where: { organizationId, segmentKey: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return coupons.map(serialize);
}

export async function createRetailDiscount(organizationId: string, actorUserId: string, input: z.infer<typeof retailDiscountInput>) {
  const coupon = await loyaltyCouponsService.createCoupon(organizationId, actorUserId, {
    ...input,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    segmentKey: null,
  });
  return serialize(coupon);
}

export async function updateRetailDiscount(
  organizationId: string, actorUserId: string, id: string,
  input: z.infer<typeof retailDiscountInput>,
) {
  const existing = await prisma.coupon.findFirst({ where: { id, organizationId, segmentKey: null } });
  if (!existing) throw new ApiError(404, "Discount not found");
  if (existing.usedCount > 0 && (
    existing.code !== input.code.trim().toUpperCase() || existing.name !== input.name ||
    existing.discountType !== input.discountType || Number(existing.discountValue) !== input.discountValue ||
    Number(existing.minOrderTotal ?? 0) !== Number(input.minOrderTotal ?? 0) ||
    Number(existing.maxDiscountAmount ?? 0) !== Number(input.maxDiscountAmount ?? 0) ||
    existing.usageLimit !== (input.usageLimit ?? null) ||
    existing.perCustomerLimit !== (input.perCustomerLimit ?? null) ||
    existing.startsAt?.toISOString() !== (input.startsAt ? new Date(input.startsAt).toISOString() : undefined) ||
    existing.expiresAt?.toISOString() !== (input.expiresAt ? new Date(input.expiresAt).toISOString() : undefined)
  )) throw new ApiError(409, "A used discount can only be activated or deactivated.");

  const coupon = await prisma.coupon.update({
    where: { id, organizationId },
    data: {
      code: input.code.trim().toUpperCase(), name: input.name,
      discountType: input.discountType, discountValue: input.discountValue,
      minOrderTotal: input.minOrderTotal ?? null, maxDiscountAmount: input.maxDiscountAmount ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      usageLimit: input.usageLimit ?? null, perCustomerLimit: input.perCustomerLimit ?? null,
      isActive: input.isActive ?? existing.isActive,
    },
  });
  await writeAuditLog({ action: "UPDATE", entityType: "Coupon", entityId: id,
    description: "Retail discount updated", userId: actorUserId, organizationId,
    previousValue: { isActive: existing.isActive }, newValue: { isActive: coupon.isActive },
  });
  return serialize(coupon);
}

export async function updateRetailDiscountStatus(organizationId: string, actorUserId: string, id: string, isActive: boolean) {
  const existing = await prisma.coupon.findFirst({ where: { id, organizationId, segmentKey: null } });
  if (!existing) throw new ApiError(404, "Discount not found");
  const coupon = await prisma.coupon.update({ where: { id, organizationId }, data: { isActive } });
  await writeAuditLog({ action: "CHANGE_STATUS", entityType: "Coupon", entityId: id,
    description: "Retail discount status changed", userId: actorUserId, organizationId,
    previousValue: { isActive: existing.isActive }, newValue: { isActive } });
  return serialize(coupon);
}
