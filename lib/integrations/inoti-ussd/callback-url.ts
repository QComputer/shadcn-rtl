export const INOTI_USSD_CANONICAL_CALLBACK_ORIGIN = "https://bazarbaaz.ir";

const INOTI_USSD_PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidInotiUssdPublicIntegrationId(publicIntegrationId: string) {
  return INOTI_USSD_PUBLIC_ID_PATTERN.test(publicIntegrationId);
}

export function buildInotiUssdCallbackPath(publicIntegrationId: string) {
  if (!isValidInotiUssdPublicIntegrationId(publicIntegrationId)) {
    throw new Error("Invalid iNoti USSD public integration ID");
  }
  return `/api/integrations/inoti/ussd/${publicIntegrationId}`;
}

export function buildInotiUssdCallbackUrl(publicIntegrationId: string) {
  return `${INOTI_USSD_CANONICAL_CALLBACK_ORIGIN}${buildInotiUssdCallbackPath(publicIntegrationId)}`;
}
