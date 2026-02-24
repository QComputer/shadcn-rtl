import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a price in the organization's currency
 * @param price - The price in smallest currency unit (e.g., cents) or as a decimal
 * @param currency - The currency code (default: USD)
 * @param locale - The locale for formatting (default: en-US)
 * @param fromSmallestUnit - Whether the price is in smallest unit (default: false)
 */
export function formatPrice(
  price: number,
  currency: string = "USD",
  locale: string = "en-US",
  fromSmallestUnit: boolean = false
): string {
  const amount = fromSmallestUnit ? price / 100 : price;
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number with locale-specific formatting
 */
export function formatNumber(
  value: number,
  locale: string = "en-US",
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Format a date with locale-specific formatting
 */
export function formatDate(
  date: Date | string,
  locale: string = "en-US",
  options: Intl.DateTimeFormatOptions = { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(d);
}
