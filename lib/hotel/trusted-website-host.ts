/**
 * Resolves the host used by server-rendered Hotel website context.
 * The proxy strips caller-supplied x-bazar-* values and sets these only after
 * resolving an active tenant domain; custom-domain rewrites can otherwise
 * expose the platform's internal Host value to App Router pages.
 */
export function trustedHotelWebsiteHost(input: {
  requestHost: string | null;
  isCustomDomain: string | null;
  tenantDomain: string | null;
}): string | null {
  if (input.isCustomDomain === "true") return input.tenantDomain;
  return input.requestHost;
}
