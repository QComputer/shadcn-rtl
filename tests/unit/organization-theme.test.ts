import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { organizationThemeCss, resolveOrganizationTheme } from "@/lib/organization-theme";

describe("organization theme", () => {
  it("sanitizes colors and calculates readable foregrounds", () => {
    const theme = resolveOrganizationTheme({ primary: "#ffffff", secondary: "#000000", background: "#fefefe", surface: "invalid" });
    assert.equal(theme.primaryText, "#0F172A");
    assert.equal(theme.secondaryText, "#FFFFFF");
    assert.equal(theme.surface, "#FFFFFF");
    assert.match(organizationThemeCss(theme), /--primary: #ffffff/);
  });
});
