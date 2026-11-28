import { Prisma } from "@prisma/client";

const oneHundred = new Prisma.Decimal(100);

/** Applies a tenant's merchant-owned installment merchandise percentage exactly. */
export function installmentProductPrice(ordinaryProductPrice: Prisma.Decimal, markupPercent: Prisma.Decimal): Prisma.Decimal {
  if (!ordinaryProductPrice.isFinite() || ordinaryProductPrice.lt(0)) {
    throw new RangeError("Ordinary product price must be a finite non-negative amount.");
  }
  if (!markupPercent.isFinite() || markupPercent.lt(0) || markupPercent.gt(1000)) {
    throw new RangeError("Installment markup percentage must be between 0 and 1000.");
  }
  return ordinaryProductPrice.mul(oneHundred.add(markupPercent)).div(oneHundred);
}

export function retailProductPriceForPaymentMethod(
  ordinaryProductPrice: Prisma.Decimal,
  paymentMethod: "BANK_TRANSFER" | "CASH" | "INOTI_USSD" | "SNAPPPAY_INSTALLMENT" | undefined,
  installmentMarkupPercent: Prisma.Decimal = new Prisma.Decimal(0),
): Prisma.Decimal {
  return paymentMethod === "SNAPPPAY_INSTALLMENT"
    ? installmentProductPrice(ordinaryProductPrice, installmentMarkupPercent) : ordinaryProductPrice;
}

/** SnappPay Self API amounts use whole Toman; fractional totals must fail closed. */
export function isWholeTomanAmount(amount: Prisma.Decimal): boolean {
  return amount.isFinite() && amount.gt(0) && amount.isInteger();
}
