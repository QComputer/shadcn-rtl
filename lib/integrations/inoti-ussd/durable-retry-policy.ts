export type DurableFailureClass =
  | "TEMPORARY_NOT_FOUND"
  | "PROVIDER_TIMEOUT"
  | "TRANSPORT_ERROR"
  | "MALFORMED_PROVIDER_RESPONSE"
  | "AMBIGUOUS_MATCH"
  | "CORRELATION_MISMATCH";

export type DurableRetryStatus = "RETRY" | "MANUAL_REVIEW" | "EXHAUSTED";

export function durableRetryDecision(code: string, attemptCount: number): {
  failureClass: DurableFailureClass;
  status: DurableRetryStatus;
  retryAfterSeconds: number | null;
} {
  const failureClass: DurableFailureClass = code === "NOT_FOUND"
    ? "TEMPORARY_NOT_FOUND"
    : code === "TIMEOUT"
      ? "PROVIDER_TIMEOUT"
      : code === "PROVIDER_ERROR" || code === "NOT_READY"
        ? "TRANSPORT_ERROR"
        : code === "MALFORMED_RESPONSE"
          ? "MALFORMED_PROVIDER_RESPONSE"
          : code === "AMBIGUOUS_MATCH"
            ? "AMBIGUOUS_MATCH"
            : "CORRELATION_MISMATCH";
  const manual = failureClass === "AMBIGUOUS_MATCH" || failureClass === "CORRELATION_MISMATCH";
  const exhausted = !manual && attemptCount >= 5;
  const delays = [30, 120, 600, 1_800, 3_600];
  return {
    failureClass,
    status: manual ? "MANUAL_REVIEW" : exhausted ? "EXHAUSTED" : "RETRY",
    retryAfterSeconds: manual || exhausted ? null : delays[Math.min(Math.max(attemptCount - 1, 0), delays.length - 1)]!,
  };
}
