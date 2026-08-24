import { normalizeDigits } from "@/lib/integrations/inoti-ussd/parser";

export type SessionIdSyntaxMetadata = {
  sessionidPresent: boolean;
  sessionidCount: number;
  sessionidValueCount: number;
  sessionidState: "MISSING" | "DUPLICATE" | "EMPTY" | "PRESENT";
  sessionidRawLength: number | null;
  sessionidTrimmedLength: number | null;
  sessionidEmptyRaw: boolean | null;
  sessionidEmptyAfterTrim: boolean | null;
  sessionidContainsWhitespace: boolean | null;
  sessionidContainsAsciiDigits: boolean | null;
  sessionidDigitsOnlyRaw: boolean | null;
  sessionidDigitsOnlyAfterNormalization: boolean | null;
  sessionidNormalizedDigitLength: number | null;
  sessionidContainsAsciiLetters: boolean | null;
  sessionidContainsHyphen: boolean | null;
  sessionidContainsUnderscore: boolean | null;
  sessionidContainsDot: boolean | null;
  sessionidContainsColon: boolean | null;
  sessionidContainsPlus: boolean | null;
  sessionidContainsSlash: boolean | null;
  sessionidContainsEquals: boolean | null;
  sessionidContainsNonAscii: boolean | null;
  sessionidContainsControlCharacter: boolean | null;
  sessionidContainsNul: boolean | null;
  sessionidUuidLike: boolean | null;
  sessionidHexLike: boolean | null;
  sessionidBase64Like: boolean | null;
  sessionidAlphanumericLike: boolean | null;
  sessionidShape: "MISSING" | "DUPLICATE" | "EMPTY" | "DIGITS" | "NORMALIZED_DIGITS" | "UUID" | "HEX" | "BASE64_LIKE" | "ALPHANUMERIC" | "MIXED_ASCII" | "NON_ASCII" | "UNKNOWN";
};

function classifyShape(input: {
  emptyAfterTrim: boolean;
  digitsOnlyRaw: boolean;
  digitsOnlyAfterNormalization: boolean;
  uuidLike: boolean;
  hexLike: boolean;
  base64Like: boolean;
  alphanumericLike: boolean;
  containsNonAscii: boolean;
  containsControlCharacter: boolean;
}): SessionIdSyntaxMetadata["sessionidShape"] {
  if (input.emptyAfterTrim) return "EMPTY";
  if (input.uuidLike) return "UUID";
  if (input.digitsOnlyRaw) return "DIGITS";
  if (input.digitsOnlyAfterNormalization) return "NORMALIZED_DIGITS";
  if (input.hexLike) return "HEX";
  if (input.base64Like) return "BASE64_LIKE";
  if (input.alphanumericLike) return "ALPHANUMERIC";
  if (input.containsNonAscii) return "NON_ASCII";
  if (!input.containsControlCharacter) return "MIXED_ASCII";
  return "UNKNOWN";
}

export function describeSessionIdSyntax(searchParams: URLSearchParams): SessionIdSyntaxMetadata {
  const values = searchParams.getAll("sessionid");
  const count = values.length;
  const common = {
    sessionidPresent: count > 0,
    sessionidCount: count,
    sessionidValueCount: count,
  };
  if (!count) {
    return {
      ...common,
      sessionidState: "MISSING",
      sessionidRawLength: null,
      sessionidTrimmedLength: null,
      sessionidEmptyRaw: null,
      sessionidEmptyAfterTrim: null,
      sessionidContainsWhitespace: null,
      sessionidContainsAsciiDigits: null,
      sessionidDigitsOnlyRaw: null,
      sessionidDigitsOnlyAfterNormalization: null,
      sessionidNormalizedDigitLength: null,
      sessionidContainsAsciiLetters: null,
      sessionidContainsHyphen: null,
      sessionidContainsUnderscore: null,
      sessionidContainsDot: null,
      sessionidContainsColon: null,
      sessionidContainsPlus: null,
      sessionidContainsSlash: null,
      sessionidContainsEquals: null,
      sessionidContainsNonAscii: null,
      sessionidContainsControlCharacter: null,
      sessionidContainsNul: null,
      sessionidUuidLike: null,
      sessionidHexLike: null,
      sessionidBase64Like: null,
      sessionidAlphanumericLike: null,
      sessionidShape: "MISSING",
    };
  }
  if (count !== 1) {
    return {
      ...common,
      sessionidState: "DUPLICATE",
      sessionidRawLength: null,
      sessionidTrimmedLength: null,
      sessionidEmptyRaw: null,
      sessionidEmptyAfterTrim: null,
      sessionidContainsWhitespace: null,
      sessionidContainsAsciiDigits: null,
      sessionidDigitsOnlyRaw: null,
      sessionidDigitsOnlyAfterNormalization: null,
      sessionidNormalizedDigitLength: null,
      sessionidContainsAsciiLetters: null,
      sessionidContainsHyphen: null,
      sessionidContainsUnderscore: null,
      sessionidContainsDot: null,
      sessionidContainsColon: null,
      sessionidContainsPlus: null,
      sessionidContainsSlash: null,
      sessionidContainsEquals: null,
      sessionidContainsNonAscii: null,
      sessionidContainsControlCharacter: null,
      sessionidContainsNul: null,
      sessionidUuidLike: null,
      sessionidHexLike: null,
      sessionidBase64Like: null,
      sessionidAlphanumericLike: null,
      sessionidShape: "DUPLICATE",
    };
  }

  const raw = values[0] ?? "";
  const trimmed = raw.trim();
  const normalized = normalizeDigits(trimmed);
  const emptyRaw = raw.length === 0;
  const emptyAfterTrim = trimmed.length === 0;
  const digitsOnlyRaw = /^[0-9]+$/.test(raw);
  const digitsOnlyAfterNormalization = /^[0-9]+$/.test(normalized);
  const containsNonAscii = /[^\x00-\x7f]/.test(raw);
  const containsControlCharacter = /[\u0000-\u001f\u007f-\u009f]/.test(raw);
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  const hexLike = /^[0-9a-f]+$/i.test(trimmed);
  const base64Like = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(trimmed) && trimmed.length > 0;
  const alphanumericLike = /^[A-Za-z0-9]+$/.test(trimmed);

  return {
    ...common,
    sessionidState: emptyAfterTrim ? "EMPTY" : "PRESENT",
    sessionidRawLength: raw.length,
    sessionidTrimmedLength: trimmed.length,
    sessionidEmptyRaw: emptyRaw,
    sessionidEmptyAfterTrim: emptyAfterTrim,
    sessionidContainsWhitespace: /\s/.test(raw),
    sessionidContainsAsciiDigits: /[0-9]/.test(raw),
    sessionidDigitsOnlyRaw: digitsOnlyRaw,
    sessionidDigitsOnlyAfterNormalization: digitsOnlyAfterNormalization,
    sessionidNormalizedDigitLength: (normalized.match(/[0-9]/g) ?? []).length,
    sessionidContainsAsciiLetters: /[A-Za-z]/.test(raw),
    sessionidContainsHyphen: raw.includes("-"),
    sessionidContainsUnderscore: raw.includes("_"),
    sessionidContainsDot: raw.includes("."),
    sessionidContainsColon: raw.includes(":"),
    sessionidContainsPlus: raw.includes("+"),
    sessionidContainsSlash: raw.includes("/"),
    sessionidContainsEquals: raw.includes("="),
    sessionidContainsNonAscii: containsNonAscii,
    sessionidContainsControlCharacter: containsControlCharacter,
    sessionidContainsNul: raw.includes("\0"),
    sessionidUuidLike: uuidLike,
    sessionidHexLike: hexLike,
    sessionidBase64Like: base64Like,
    sessionidAlphanumericLike: alphanumericLike,
    sessionidShape: classifyShape({
      emptyAfterTrim,
      digitsOnlyRaw,
      digitsOnlyAfterNormalization,
      uuidLike,
      hexLike,
      base64Like,
      alphanumericLike,
      containsNonAscii,
      containsControlCharacter,
    }),
  };
}

export function sessionIdParseFailureReason(errorCode: string, syntax: SessionIdSyntaxMetadata) {
  if (errorCode !== "INVALID_SESSIONID") return null;
  if (syntax.sessionidCount !== 1) return "SESSIONID_COUNT_INVALID";
  if (syntax.sessionidEmptyAfterTrim) return "SESSIONID_EMPTY";
  if ((syntax.sessionidTrimmedLength ?? 0) > 64) return "SESSIONID_TOO_LONG";
  if (syntax.sessionidContainsNul) return "SESSIONID_NUL";
  if (!syntax.sessionidDigitsOnlyAfterNormalization) return "SESSIONID_NOT_NUMERIC_AFTER_NORMALIZATION";
  return "SESSIONID_OTHER_INVALID";
}
