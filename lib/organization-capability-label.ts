/** Builds a safe label for automatic public-home selection when old or partial
 * capability data contains no matching localized label. */
export function automaticPublicCapabilityLabel(
  capabilities: readonly string[],
  labels: Readonly<Record<string, string | undefined>>,
  fallback: string,
  prefix = "خودکار: ",
): string {
  if (capabilities.length !== 1) return fallback;
  const label = labels[capabilities[0]!]?.trim();
  return label ? `${prefix}${label}` : fallback;
}
