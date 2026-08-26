import { Decimal } from "@prisma/client/runtime/library";

export type MoneyInput =
  | number
  | string
  | Decimal
  | { toString(): string }
  | null
  | undefined;

export function toMoneyDecimal(value: MoneyInput, fieldName = "money value"): Decimal {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is missing`);
  }

  let decimal: Decimal;
  try {
    if (value instanceof Decimal || Decimal.isDecimal(value)) {
      decimal = new Decimal(value.toString());
    } else if (typeof value === "number") {
      decimal = new Decimal(value);
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        throw new Error(`${fieldName} is not a valid money value`);
      }
      decimal = new Decimal(trimmed);
    } else {
      const serialized = value.toString();
      if (!serialized || serialized === "[object Object]") {
        throw new Error(`${fieldName} is not a valid money value`);
      }
      decimal = new Decimal(serialized);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid argument")) {
      throw new Error(`${fieldName} is not a valid money value`);
    }
    throw error;
  }

  if (!decimal.isFinite()) {
    throw new Error(`${fieldName} is not finite`);
  }

  return decimal;
}

export function toMoneyNumber(value: MoneyInput, fieldName = "money value"): number {
  return toMoneyDecimal(value, fieldName).toNumber();
}
