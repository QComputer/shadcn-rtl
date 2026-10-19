/** Operational rollout remains disabled unless explicitly enabled in a controlled environment. */
export function isApprovedHotelPublicationAvailable(): boolean { return process.env.HOTEL_PUBLICATION_OPERATIONAL_ENABLED === "1"; }
export const HOTEL_PUBLICATION_GATE_MESSAGE = "Hotel public publication is not approved";
