import { normalizeDigits } from "@/lib/integrations/inoti-ussd/parser";

export function safeParameterNames(searchParams: URLSearchParams) {
  return [...new Set(searchParams.keys())]
    .slice(0, 32)
    .map((name) => name.slice(0, 64))
    .sort();
}

export function safeCallSegmentDiagnostics(segments: string[]) {
  return segments.slice(0, 10).map((segment, index) => ({
    position: index + 1,
    length: segment.length,
    valueClass:
      index === 0 && segment === "6655"
        ? "PROVIDER_PREFIX"
        : index === 1
          ? "CODE_NAME_CANDIDATE"
          : index === 2 && segment === "1"
            ? "ORDER_STATUS_COMMAND"
            : index === 2 && segment === "2"
              ? "PAYMENT_COMMAND"
              : /^\d+$/.test(segment)
                ? "NUMERIC_INPUT"
                : /^[A-Za-z0-9_-]+$/.test(segment)
                  ? "SAFE_ASCII_INPUT"
                  : "OTHER",
    digitsOnly: /^\d+$/.test(segment),
  }));
}

export function diagnosticCall(searchParams: URLSearchParams) {
  const values = searchParams.getAll("call");
  if (!values.length) return { call: null, callState: "MISSING" } as const;
  if (values.length !== 1) return { call: null, callState: "DUPLICATE" } as const;
  const rawCall = values[0] ?? "";
  if (!rawCall) return { call: "", callState: "EMPTY" } as const;
  const normalized = normalizeDigits(rawCall).trim();
  const segments = normalized.replace(/^\*/, "").replace(/#$/, "").split("*");
  const structure = {
    callNormalizedLength: normalized.length,
    callSegmentCount: segments.length,
    callSegments: safeCallSegmentDiagnostics(segments),
  };
  if (rawCall.length > 256 || rawCall.includes("\0") || !/^[*#A-Za-z0-9_\-\s]+$/.test(rawCall) || segments.length > 2) {
    return { call: null, callState: "SUPPRESSED_USER_INPUT_OR_UNSAFE", ...structure } as const;
  }
  return { call: rawCall, callState: "EXACT_INITIAL", ...structure } as const;
}
