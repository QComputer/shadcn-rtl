/**
 * Persian (Farsi) Utilities for RTL applications
 * Includes Jalali calendar date formatting and Iranian Toman currency formatting
 */

import dayjs, { Dayjs } from "dayjs";
import { toJalali } from "./jalali-adapter";

// Persian digits mapping
const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Persian month names
export const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

// Persian day names
export const persianDays = [
  'شنبه','یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'
];

// Short Persian day names
export const persianDaysShort = ['ش','ی', 'د', 'س', 'چ', 'پ', 'ج'];

/**
 * Convert English digits to Persian digits
 */
export function toPersianDigits(num: number | string): string {
  const numStr = String(num);
  let result = '';
  for (let i = 0; i < numStr.length; i++) {
    const char = numStr[i];
    const digitIndex = englishDigits.indexOf(char);
    result += digitIndex >= 0 ? persianDigits[digitIndex] : char;
  }
  return result;
}

/**
 * Convert Persian digits to English digits
 */
export function toEnglishDigits(num: string): string {
  let result = '';
  for (let i = 0; i < num.length; i++) {
    const char = num[i];
    const digitIndex = persianDigits.indexOf(char);
    result += digitIndex >= 0 ? englishDigits[digitIndex] : char;
  }
  return result;
}

/**
 * Jalali calendar conversion utilities
 * Based on accurate astronomical algorithm
 */

export interface JalaliDate {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}
export interface JalaliDateTime {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  sec: number; // 0-59
}
export interface JalaliTime {
  hour: number; // 0-23
  minute: number; // 0-59
  sec: number; // 0-59
}

// Calculate Gregorian date from Julian Day Number
function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  
  return { year, month, day };
}

/**
 * Convert Gregorian date to Jalali date
 */
export function gregorianToJalaliDateTime(gregorianDate: Date): JalaliDateTime {
  const jalaliDate = toJalali(gregorianDate);
  return {
    year: jalaliDate.year(),
    month: jalaliDate.month() + 1,
    day: jalaliDate.date(),
    hour: jalaliDate.hour(),
    minute: jalaliDate.minute(),
    sec: jalaliDate.second(),
  };
}

export function gregorianToJalaliDate(gregorianDate: Date): JalaliDate {
    const jalaliDate = toJalali(gregorianDate);
    return {
      year: jalaliDate.year(),
      month: jalaliDate.month() + 1,
      day: jalaliDate.date(),
    };
}

export function gregorianToJalaliTime(gregorianDate: Date): JalaliTime {
  const jalaliDate = toJalali(gregorianDate);
  return {
    hour: jalaliDate.hour(),
    minute: jalaliDate.minute(),
    sec: jalaliDate.second(),
  };
}
/**
 * Convert Jalali date to Gregorian date
 */
export function jalaliToGregorian(jalaliDate: JalaliDate): Date {
  const jYear = jalaliDate.year;
  const jMonth = jalaliDate.month;
  const jDay = jalaliDate.day;
  
  // Calculate Julian Day Number for Jalali date
  const jdn = (jYear - 1) * 365 + 
              Math.floor((jYear - 1) / 33) * 8 + 
              Math.floor((jYear - 1) % 33 / 4) + 
              jDay +
              (jMonth <= 7 ? (jMonth - 1) * 31 : (jMonth - 7) * 30 + 186) + 
              1948320.5 - 1;
  
  const jdnInt = Math.floor(jdn);
  const { year, month, day } = jdnToGregorian(jdnInt);
  
  return new Date(year, month - 1, day);
}

/**
 * Format a date in Persian (Jalali) calendar
 * @param date - The date to format
 * @param format - Format string (default: 'full')
 * @param usePersianDigits - Whether to use Persian digits (default: true)
 */
export function formatPersianDate(
  date: Date | string | number,
  format: 'full' | 'short' | 'date' | 'time' | 'datetime' = 'full',
  usePersianDigits: boolean = true
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return '';
  }
  
  const jDateTime = gregorianToJalaliDateTime(d);
  
  const formatDate = (): string => {
    if (usePersianDigits) {
      return `${toPersianDigits(jDateTime.year)}/${toPersianDigits(String(jDateTime.month).padStart(2, '0'))}/${toPersianDigits(String(jDateTime.day).padStart(2, '0'))}`;
    }
    return `${jDateTime.year}/${String(jDateTime.month).padStart(2, '0')}/${String(jDateTime.day).padStart(2, '0')}`;
  };
  
  const formatTime = (): string => {
    const hours = jDateTime.hour.toString().padStart(2, '0');
    const minutes = jDateTime.minute.toString().padStart(2, "0");
    const seconds = jDateTime.sec.toString().padStart(2, "0");
    
    if (usePersianDigits) {
      return `${toPersianDigits(hours)}:${toPersianDigits(minutes)}:${toPersianDigits(seconds)}`;
    }
    return `${hours}:${minutes}:${seconds}`;
  };
  
  const getDayName = (): string => {
    const dayIndex = d.getDay();
    return persianDays[dayIndex];
  };
  
  const getMonthName = (): string => {
    return persianMonths[jDateTime.month - 1];
  };
  
  switch (format) {
    case 'full':
      return `${getDayName()} ${toPersianDigits(jDateTime.day)} ${getMonthName()} ${toPersianDigits(jDateTime.year)}`;
    case 'short':
      return formatDate();
    case 'date':
      return formatDate();
    case 'time':
      return formatTime();
    case 'datetime':
      return `${formatDate()} - ${formatTime()}`;
    default:
      return formatDate();
  }
}

/**
 * Format a relative Persian date (e.g., "امروز", "دیروز", "۳ روز پیش")
 */
export function formatRelativePersianDate(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return '';
  }
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Check if it's today
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) {
        return 'همین الان';
      }
      return `${toPersianDigits(diffMinutes)} دقیقه پیش`;
    }
    return `${toPersianDigits(diffHours)} ساعت پیش`;
  } else if (diffDays === 1) {
    return 'دیروز';
  } else if (diffDays === 2) {
    return 'پریروز';
  } else if (diffDays < 7) {
    return `${toPersianDigits(diffDays)} روز پیش`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${toPersianDigits(weeks)} هفته پیش`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${toPersianDigits(months)} ماه پیش`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${toPersianDigits(years)} سال پیش`;
  }
}

export function formatRelativePersianTime(
  date: Dayjs | Date | string | number,
): string {
  const d = dayjs(date);

  let diffMs = d.diff();
  const isPassed: boolean = diffMs > 0;
  if (!isPassed) {
    diffMs = -1 * diffMs;
  }
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const intraDayDiffMs = diffMs % (1000 * 60 * 60 * 24);
  const diffHours = Math.floor(intraDayDiffMs / (1000 * 60 * 60));
  const intraHourDiffMs = diffMs % (1000 * 60 * 60);
  const diffMinutes = Math.floor(intraHourDiffMs / (1000 * 60));
  let formatted = "";

  if (diffDays > 0) {
    if (diffDays === 1) formatted + "دیروز، ";
    else if (diffDays === 2) formatted + "پریروز، ";
    else formatted += `${toPersianDigits(diffDays)} روز و`;
  }
  if (diffHours > 0) {
    formatted += `${toPersianDigits(diffHours)} ساعت `;
  }
  if (diffMinutes > 0) {
    formatted += " و ";
    formatted += `${toPersianDigits(diffMinutes)} دقیقه `;
  }
  formatted += isPassed ? "پیش" : "دیگر";

  return formatted;
}
/*
export function addMinutes(date: Date , minutes: number): {gdate: Date, jDate:string} {
  const gdate = date.
}
*/
/**
 * Iranian Toman currency formatting
 * Uses Persian numerals and appropriate formatting
 */
export interface CurrencyOptions {
  /** Number of decimal places (default: 0 for Toman) */
  decimals?: number;
  /** Whether to add "تومان" suffix (default: true) */
  showCurrency?: boolean;
  /** Whether to use Persian digits (default: true) */
  usePersianDigits?: boolean;
  /** Whether to add thousand separators (default: true) */
  useSeparators?: boolean;
}

/**
 * Format a number as Iranian Toman currency
 * @param amount - The amount to format
 * @param options - Formatting options
 */
export function formatToman(
  amount: number | string,
  options: CurrencyOptions = {}
): string {
  const {
    decimals = 0,
    showCurrency = true,
    usePersianDigits = true,
    useSeparators = true
  } = options;
  
  // Convert to number if string
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    return '';
  }
  
  // Format the number
  let formatted: string;
  
  if (useSeparators) {
    // Add thousand separators
    formatted = num.toLocaleString('fa-IR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  } else {
    formatted = num.toFixed(decimals);
    if (usePersianDigits) {
      formatted = toPersianDigits(formatted);
    }
  }
  
  // If not using separators with Persian digits, convert manually
  if (usePersianDigits && useSeparators) {
    // The locale string already handles it
  } else if (usePersianDigits) {
    formatted = toPersianDigits(formatted);
  }
  
  // Add currency suffix
  if (showCurrency) {
    formatted += ' تومان';
  }
  
  return formatted;
}

/**
 * Format a number with thousand separators (Persian style)
 */
export function formatNumber(num: number | string, usePersianDigits: boolean = true): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  
  if (isNaN(n)) {
    return '';
  }
  
  const formatted = n.toLocaleString('fa-IR');
  
  return usePersianDigits ? formatted : toEnglishDigits(formatted);
}

/**
 * Format a phone number in Iranian format
 */
export function formatIranianPhone(phone: string): string {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    // 0912 345 6789 -> ۰۹۱۲ ۳۴۵ ۶۷۸۹
    const match = cleaned.match(/^0(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return toPersianDigits(`${match[1]} ${match[2]} ${match[3]}`);
    }
  } else if (cleaned.startsWith('+98') && cleaned.length === 12) {
    // +98 912 345 6789 -> +۹۸ ۹۱۲ ۳۴۵ ۶۷۸۹
    const match = cleaned.match(/^\+98(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return toPersianDigits(`+98 ${match[1]} ${match[2]} ${match[3]}`);
    }
  }
  
  return toPersianDigits(phone);
}

/**
 * Get Persian ordinal suffix
 */
export function getOrdinalSuffix(num: number): string {
  const lastTwoDigits = num % 100;
  const lastDigit = num % 10;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'ام';
  }
  
  switch (lastDigit) {
    case 1:
      return 'ام';
    case 2:
      return 'وم';
    case 3:
      return 'ام';
    case 4:
      return 'ام';
    case 5:
      return 'ام';
    case 6:
      return 'ام';
    case 7:
      return 'ام';
    case 8:
      return 'ام';
    case 9:
      return 'ام';
    default:
      return 'ام';
  }
}

/**
 * Format a number as Persian ordinal
 */
export function formatOrdinal(num: number, usePersianDigits: boolean = true): string {
  const ordinal = `${num}${getOrdinalSuffix(num)}`;
  return usePersianDigits ? toPersianDigits(ordinal) : ordinal;
}

/**
 * Check if text contains Persian characters
 */
export function containsPersian(text: string): boolean {
  const persianRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return persianRegex.test(text);
}

/**
 * Get text direction based on content
 */
export function getTextDirection(text: string): 'rtl' | 'ltr' {
  if (!text || text.trim().length === 0) {
    return 'ltr';
  }
  
  // If text contains Persian, Arabic, or Hebrew characters, use RTL
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  return rtlRegex.test(text) ? 'rtl' : 'ltr';
}
