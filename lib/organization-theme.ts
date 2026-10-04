export type OrganizationTheme = {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  primaryText: string;
  secondaryText: string;
};

const defaults: OrganizationTheme = {
  primary: "#2F5BFF",
  secondary: "#64748B",
  background: "#FFFFFF",
  surface: "#FFFFFF",
  primaryText: "#FFFFFF",
  secondaryText: "#FFFFFF",
};

function validHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function contrastText(hex: string) {
  const rgb = hex.slice(1).match(/.{2}/g)!.map((part) => Number.parseInt(part, 16) / 255);
  const linear = rgb.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.179 ? "#0F172A" : "#FFFFFF";
}

export function resolveOrganizationTheme(value: unknown): OrganizationTheme {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const primary = validHex(source.primary) ? source.primary : defaults.primary;
  const secondary = validHex(source.secondary) ? source.secondary : defaults.secondary;
  const background = validHex(source.background) ? source.background : defaults.background;
  const surface = validHex(source.surface) ? source.surface : defaults.surface;
  return { primary, secondary, background, surface, primaryText: contrastText(primary), secondaryText: contrastText(secondary) };
}

export function organizationThemeCss(theme: OrganizationTheme) {
  return `--primary: ${theme.primary}; --primary-foreground: ${theme.primaryText}; --secondary: ${theme.secondary}; --secondary-foreground: ${theme.secondaryText}; --background: ${theme.background}; --card: ${theme.surface}; --popover: ${theme.surface};`;
}
