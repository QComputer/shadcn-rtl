import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retailBrandPalette, retailBrandStyle } from "@/lib/retail/brand-color";

function luminance(hex: string) {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(left: string, right: string) {
  const a = luminance(left), b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("retail storefront brand color", () => {
  it("rejects invalid colors and CSS injection without emitting style tokens", () => {
    for (const value of ["red", "#12345", "#12345678", " #123456", "#123456; color: red", "url(javascript:alert(1))"]) {
      assert.equal(retailBrandPalette(value), undefined);
      assert.equal(retailBrandStyle(value), undefined);
    }
    for (const value of [null, undefined]) {
      assert.equal(retailBrandPalette(value), undefined);
      assert.equal(retailBrandStyle(value), undefined);
    }
  });

  it("keeps primary and foreground contrast accessible for extreme and saturated colors in both modes", () => {
    const surfaces = { light: "#f8f7f4", dark: "#202224" } as const;
    const colors = ["#ffffff", "#000000", "#ffff00", "#ff0000", "#0000ff"];

    for (const mode of ["light", "dark"] as const) {
      for (const color of colors) {
        const palette = retailBrandPalette(color, mode);
        assert.ok(palette, `${mode} palette should exist for ${color}`);
        for (const value of Object.values(palette)) assert.match(value, /^#[0-9a-f]{6}$/i);
        assert.ok(contrast(palette.primary, surfaces[mode]) >= 4.5, `${mode} primary should contrast with its surface for ${color}`);
        assert.ok(contrast(palette.foreground, palette.primary) >= 4.5, `${mode} foreground should contrast with primary for ${color}`);
      }
    }
  });

  it("returns isolated derived values without mutating inputs or prior results", () => {
    const color = "#5A9B42";
    const light = retailBrandPalette(color, "light");
    const dark = retailBrandPalette(color, "dark");
    const lightSnapshot = structuredClone(light);
    const darkSnapshot = structuredClone(dark);

    retailBrandStyle(color, "dark");
    retailBrandPalette("#ffffff", "light");

    assert.equal(color, "#5A9B42");
    assert.deepEqual(light, lightSnapshot);
    assert.deepEqual(dark, darkSnapshot);
    assert.notEqual(light, dark);
    assert.notEqual(light?.primary, dark?.primary);
  });
});
