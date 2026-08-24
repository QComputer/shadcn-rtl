import { normalizeDigits } from "@/lib/integrations/inoti-ussd/parser";

export function safeParameterNames(searchParams: URLSearchParams) {
  return [...new Set(searchParams.keys())]
    .slice(0, 32)
    .map((name) => name.slice(0, 64))
    .sort();
}

export function diagnosticCall(searchParams: URLSearchParams) {
  const values = searchParams.getAll("call");
  if (!values.length) return { call: null, callState: "MISSING" } as const;
  if (values.length !== 1) return { call: null, callState: "DUPLICATE" } as const;
  const rawCall = values[0] ?? "";
  if (!rawCall) return { call: "", callState: "EMPTY" } as const;
  const normalized = normalizeDigits(rawCall).trim();
  const segments = normalized.replace(/^\*/, "").replace(/#$/, "").split("*").filter(Boolean);
  if (rawCall.length > 256 || rawCall.includes("\0") || !/^[*#A-Za-z0-9_\-\s]+$/.test(rawCall) || segments.length > 2) {
    return { call: null, callState: "SUPPRESSED_USER_INPUT_OR_UNSAFE" } as const;
  }
  return { call: rawCall, callState: "EXACT_INITIAL" } as const;
}
