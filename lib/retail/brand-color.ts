import type { CSSProperties } from "react";

type RGB = [number, number, number];
const hexPattern = /^#[\da-f]{6}$/i;
function rgb(hex: string): RGB {
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) as RGB;
}
function hex(values: RGB) {
  return `#${values.map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}
function mix(color: string, target: string, amount: number) {
  const left = rgb(color), right = rgb(target);
  return hex(left.map((channel, index) => channel * (1 - amount) + right[index] * amount) as RGB);
}
function luminance(color: string) {
  const linear = rgb(color).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(left: string, right: string) {
  const a = luminance(left), b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Derive readable accents without changing the merchant's stored brand color. */
export function retailBrandPalette(color: string | null | undefined, mode: "light" | "dark" = "light") {
  if (!color || !hexPattern.test(color)) return undefined;
  const surface = mode === "dark" ? "#202224" : "#f8f7f4";
  const target = mode === "dark" ? "#ffffff" : "#000000";
  let primary = color.toLowerCase();
  for (let step = 1; contrast(primary, surface) < 4.5 && step <= 100; step++) {
    primary = mix(color, target, step / 100);
  }
  const foreground = contrast(primary, "#ffffff") >= contrast(primary, "#000000") ? "#ffffff" : "#000000";
  return { primary, foreground, ring: primary, accent: mix(primary, surface, 0.9) };
}

export function retailBrandStyle(color: string | null | undefined, mode: "light" | "dark" = "light"): CSSProperties | undefined {
  const palette = retailBrandPalette(color, mode);
  if (!palette) return undefined;
  return {
    "--primary": palette.primary,
    "--primary-foreground": palette.foreground,
    "--ring": palette.ring,
    "--accent": palette.accent,
    "--accent-foreground": palette.primary,
    "--retail-primary": palette.primary,
    "--retail-primary-foreground": palette.foreground,
    "--retail-primary-ring": palette.ring,
    "--retail-primary-accent": palette.accent,
  } as CSSProperties;
}
