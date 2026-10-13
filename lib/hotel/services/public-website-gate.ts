/** Public Hotel website reads stay disabled until an explicit controlled rollout. */
export function isHotelWebsitePublicReadAvailable(): boolean {
  return process.env.HOTEL_WEBSITE_PUBLIC_OPERATIONAL_ENABLED === "1";
}

export const HOTEL_WEBSITE_PUBLIC_GATE_MESSAGE = "Hotel website publication is not available";
