/**
 * Persian (Farsi) Utilities for RTL applications
 * Includes Jalali calendar date formatting and Iranian Toman currency formatting
 */

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
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'
];

// Short Persian day names
export const persianDaysShort = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];

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
 * Based on astronomical algorithm
 */

// Days in each month for Jalali calendar
const jalaliMonthsDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

export interface JalaliDate {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

/**
 * Convert Gregorian date to Jalali date
 */
export function gregorianToJalali(gregorianDate: Date): JalaliDate {
  const year = gregorianDate.getFullYear();
  const month = gregorianDate.getMonth() + 1;
  const day = gregorianDate.getDate();

  const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Calculate days since March 1, 1970 (start of Iranian calendar)
  let jdn = 0;
  
  // Calculate Julian Day Number
  const gYear = year - 1600;
  const gMonth = month - 1;
  const gDay = day - 1;
  
  let days = 365 * gYear + Math.floor((gYear + 3) / 4) - Math.floor((gYear + 99) / 100) + Math.floor((gYear + 399) / 400);
  
  let m = 0;
  for (let i = 0; i < gMonth; i++) {
    days += gDaysInMonth[i];
  }
  days += gDay;
  
  jdn = days + 1721425;

  // Convert to Jalali
  const jd = jdn - 2124034 + 1;
  const cycle = Math.floor((jd - 1) / 1029983);
  const cyear = jd - 1 - 1029983 * cycle;
  
  let yearInCycle = cyear;
  if (cyear === 1029982) {
    yearInCycle = 2820;
  } else {
    const aux1 = Math.floor(cyear / 366);
    const aux2 = cyear % 366;
    yearInCycle = Math.floor((2134 * aux1 + 2816 * aux2 + 2815) / 1028522) + aux1 + 1;
  }
  
  const jYear = yearInCycle + 2826 * cycle + 474;
  const jdAtYearStart = jYear < 0 ? Math.floor((jYear - 1) / 1460) * 1460 + 474 : Math.floor((jYear - 1) / 1460) * 1460 + 474;
  const daysInJYear = jd - jdAtYearStart + 1;
  
  let jMonth = 1;
  let jDay = daysInJYear;
  
  for (let i = 0; i < 12; i++) {
    if (jDay <= jalaliMonthsDays[i]) {
      jMonth = i + 1;
      break;
    }
    jDay -= jalaliMonthsDays[i];
  }
  
  // Handle leap year
  const leapYears = [1, 5, 9, 13, 17, 22, 26, 30];
  const jalaliYear = jYear;
  const isLeap = leapYears.includes(jalaliYear % 33) || (jalaliYear % 33 === 0);
  if (isLeap && jMonth === 12 && jDay === 30) {
    jDay = 30;
  } else if (jMonth === 12 && jDay > 29) {
    jDay = isLeap ? 30 : 29;
  }
  
  return {
    year: jYear,
    month: jMonth,
    day: jDay
  };
}

/**
 * Convert Jalali date to Gregorian date
 */
export function jalaliToGregorian(jalaliDate: JalaliDate): Date {
  const jYear = jalaliDate.year;
  const jMonth = jalaliDate.month;
  const jDay = jalaliDate.day;
  
  const jd = (jYear <= 0 ? jYear - 1 : jYear) - 474 + Math.floor((jMonth - 1) * 31 + (jMonth > 6 ? 6 : jMonth - 1) * 30 + jDay);
  const jdn = jd + 1721425;
  
  // Convert to Gregorian
  const z = jdn + 32082;
  const a = Math.floor((4 * z + 3) / 146097);
  const b = z - Math.floor((146097 * a) / 4);
  const c = Math.floor((4 * b + 3) / 1461);
  const d = b - Math.floor((1461 * c) / 4);
  const e = Math.floor((5 * d + 2) / 153);
  const day = d - Math.floor((153 * e + 2) / 5) + 1;
  const month = e + 3 - 12 * Math.floor(e / 10);
  const year = 100 * a + c - 4800 + Math.floor(e / 10);
  
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
  
  const jDate = gregorianToJalali(d);
  
  const formatDate = (): string => {
    if (usePersianDigits) {
      return `${toPersianDigits(jDate.year)}/${toPersianDigits(jDate.month.toString().padStart(2, '0'))}/${toPersianDigits(jDate.day.toString().padStart(2, '0'))}`;
    }
    return `${jDate.year}/${jDate.month.toString().padStart(2, '0')}/${jDate.day.toString().padStart(2, '0')}`;
  };
  
  const formatTime = (): string => {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    
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
    return persianMonths[jDate.month - 1];
  };
  
  switch (format) {
    case 'full':
      return `${getDayName()} ${toPersianDigits(jDate.day)} ${getMonthName()} ${toPersianDigits(jDate.year)}`;
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
