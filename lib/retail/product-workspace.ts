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
  organizationRetailProductExperience?: boolean;
} | null | undefined, legacyEditor = false) {
  const vertical = membership?.organizationVertical ?? null;
  const hasSupportedVertical = RETAIL_PRODUCT_WORKSPACE_VERTICALS.has(vertical ?? "");
  const hasExplicitUnclassifiedRetailOptIn = !vertical && membership?.organizationRetailProductExperience === true;

  return !legacyEditor
    && membership?.organizationType === "SHOP"
    && membership.organizationCapabilities?.includes("SHOP") === true
    && (hasSupportedVertical || hasExplicitUnclassifiedRetailOptIn);
}
