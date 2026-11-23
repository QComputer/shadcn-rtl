export const DAMOON_PUBLIC_BOOKING_ACTIVATION = Object.freeze({
  enabled: false,
  property: "damoon-hotel",
  ownerApproval: null,
});

// Owner-authorized demonstration is isolated to the separate synthetic property.
// Normal Damoon booking stays request-only until its independent approval gate opens.
export const DAMOON_DEMO_BOOKING_ACTIVATION = Object.freeze({
  enabled: true,
  organization: "damoon-hotel",
  property: "damoon-demo",
  hosts: ["damoon-hotel.ir", "www.damoon-hotel.ir"],
});

export function isDamoonDemoBookingActivated(hostname, activation = DAMOON_DEMO_BOOKING_ACTIVATION) {
  return activation?.enabled === true
    && activation.organization === "damoon-hotel"
    && activation.property === "damoon-demo"
    && Array.isArray(activation.hosts)
    && activation.hosts.includes(String(hostname || "").trim().toLowerCase());
}

export function isDamoonPublicBookingActivated(activation = DAMOON_PUBLIC_BOOKING_ACTIVATION) {
  const approval = activation?.ownerApproval;
  if (activation?.enabled !== true || activation.property !== "damoon-hotel") return false;
  if (approval?.approvedBy !== "property_owner") return false;
  if (typeof approval.reference !== "string" || !/^DAMOON-BOOKING-[A-Z0-9-]{6,40}$/.test(approval.reference)) return false;
  if (typeof approval.approvedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(approval.approvedAt)) return false;
  return Number.isFinite(Date.parse(approval.approvedAt)) && new Date(approval.approvedAt).toISOString() === approval.approvedAt;
}
