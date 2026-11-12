const TRACE_HEADER = "x-bazar-product-route-trace-id";
const KEY_HEADER = "x-bazar-product-route-diagnostic-key";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isProductPath(pathname: string) {
  return /(?:^|\/)shop\/product\/[^/]+\/?$/.test(pathname);
}

/** Only the proxy may forward the trace ID, after validating the temporary diagnostic key. */
export function authorizedProductRouteTraceId(
  requestHeaders: Headers,
  pathname: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!isProductPath(pathname)) return null;
  const configuredKey = env.BAZARBAAZ_PRODUCT_ROUTE_DIAGNOSTIC_KEY;
  const suppliedKey = requestHeaders.get(KEY_HEADER);
  const traceId = requestHeaders.get(TRACE_HEADER);
  if (!configuredKey || configuredKey.length < 32 || suppliedKey !== configuredKey || !traceId || !UUID_PATTERN.test(traceId)) {
    return null;
  }
  return traceId;
}

export function productRouteTraceId(requestHeaders: Headers) {
  const traceId = requestHeaders.get(TRACE_HEADER);
  return traceId && UUID_PATTERN.test(traceId) ? traceId : null;
}

export function logProductRouteDiagnostic(traceId: string | null, stage: string, details: Record<string, string | number | boolean | null> = {}) {
  if (!traceId) return;
  console.info(JSON.stringify({ event: "product-route-diagnostic", traceId, stage, ...details }));
}
