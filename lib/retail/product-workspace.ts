const RETAIL_PRODUCT_WORKSPACE_VERTICALS = new Set([
  "SHOE_STORE",
  "CLOTHING_STORE",
  "PHARMACY",
  "SUPERMARKET",
  "FLORIST",
]);

export function usesRetailProductWorkspace(membership: {
  organizationType?: string | null;
  organizationVertical?: string | null;
  organizationCapabilities?: readonly string[] | null;
} | null | undefined, legacyEditor = false) {
  return !legacyEditor
    && membership?.organizationType === "SHOP"
    && membership.organizationCapabilities?.includes("SHOP") === true
    && RETAIL_PRODUCT_WORKSPACE_VERTICALS.has(membership.organizationVertical ?? "");
}
