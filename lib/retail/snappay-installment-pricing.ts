import { Prisma } from "@prisma/client";

const oneHundred = new Prisma.Decimal(100);
const installmentPercent = new Prisma.Decimal(111);

/** Applies the owner-approved 11% product-price uplift using decimal arithmetic. */
export function snappPayInstallmentProductPrice(ordinaryProductPrice: Prisma.Decimal): Prisma.Decimal {
  if (!ordinaryProductPrice.isFinite() || ordinaryProductPrice.lt(0)) {
    throw new RangeError("Ordinary product price must be a finite non-negative amount.");
  }
  return ordinaryProductPrice.mul(installmentPercent).div(oneHundred);
}

export function retailProductPriceForPaymentMethod(
  ordinaryProductPrice: Prisma.Decimal,
  paymentMethod: "BANK_TRANSFER" | "CASH" | "INOTI_USSD" | "SNAPPPAY_INSTALLMENT" | undefined,
): Prisma.Decimal {
  return paymentMethod === "SNAPPPAY_INSTALLMENT"
    ? snappPayInstallmentProductPrice(ordinaryProductPrice) : ordinaryProductPrice;
}

/** SnappPay Self API amounts use whole Toman; fractional totals must fail closed. */
export function isWholeTomanAmount(amount: Prisma.Decimal): boolean {
  return amount.isFinite() && amount.gt(0) && amount.isInteger();
}
