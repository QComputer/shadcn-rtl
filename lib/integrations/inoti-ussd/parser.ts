import type { ParsedUssdRequest } from "@/lib/integrations/inoti-ussd/types";

const DIGIT_MAP: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export class UssdParseError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function normalizeDigits(value: string) {
  return Array.from(value, (character) => DIGIT_MAP[character] ?? character).join("");
}

export function normalizeIranianMobile(value: string): string | null {
  const compact = normalizeDigits(value).trim().replace(/[\s-]/g, "");
  let normalized = compact;
  if (normalized.startsWith("+98")) normalized = `0${normalized.slice(3)}`;
  else if (normalized.startsWith("0098")) normalized = `0${normalized.slice(4)}`;
  else if (normalized.startsWith("98")) normalized = `0${normalized.slice(2)}`;
  else if (/^9\d{9}$/.test(normalized)) normalized = `0${normalized}`;
  return /^09\d{9}$/.test(normalized) ? normalized : null;
}

function readSingleQueryValue(searchParams: URLSearchParams, key: string, maxLength: number) {
  const values = searchParams.getAll(key);
  if (values.length !== 1) throw new UssdParseError(`INVALID_${key.toUpperCase()}`);
  const value = values[0]?.trim() ?? "";
  if (!value || value.length > maxLength || value.includes("\0")) {
    throw new UssdParseError(`INVALID_${key.toUpperCase()}`);
  }
  return value;
}

export function parseUssdQuery(searchParams: URLSearchParams, codeName: string): ParsedUssdRequest {
  const mobileRaw = readSingleQueryValue(searchParams, "mobile", 32);
  const sessionRaw = normalizeDigits(readSingleQueryValue(searchParams, "sessionid", 64));
  const callRaw = normalizeDigits(readSingleQueryValue(searchParams, "call", 256));
  const rrnValues = searchParams.getAll("RRN").length
    ? searchParams.getAll("RRN")
    : searchParams.getAll("rrn");

  const mobile = normalizeIranianMobile(mobileRaw);
  if (!mobile) throw new UssdParseError("INVALID_MOBILE");
  if (!/^\d{1,64}$/.test(sessionRaw)) throw new UssdParseError("INVALID_SESSIONID");

  const call = callRaw.replace(/^\*/, "").replace(/#$/, "");
  if (!call || call.length > 256 || !/^[A-Za-z0-9_-]+(?:\*[A-Za-z0-9_-]+)*$/.test(call)) {
    throw new UssdParseError("INVALID_CALL");
  }
  const segments = call.split("*");
  if (segments.length < 2 || segments.length > 10 || segments[0] !== "6655" || segments[1] !== codeName) {
    throw new UssdParseError("INVALID_CALL_SCOPE");
  }

  let rrn: string | null = null;
  if (rrnValues.length) {
    if (rrnValues.length !== 1) throw new UssdParseError("INVALID_RRN");
    rrn = normalizeDigits(rrnValues[0]?.trim() ?? "");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(rrn)) throw new UssdParseError("INVALID_RRN");
  }

  return { mobile, sessionId: sessionRaw, call, segments, rrn };
}
