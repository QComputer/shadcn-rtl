import test from "node:test";
import assert from "node:assert/strict";
import { automaticPublicCapabilityLabel } from "../../lib/organization-capability-label.ts";

test("automatic public-home label falls back for missing, unknown, or multiple capabilities", () => {
  const labels = { SHOP: "فروشگاه" };
  assert.equal(automaticPublicCapabilityLabel([], labels, "صفحه عمومی سازمان"), "صفحه عمومی سازمان");
  assert.equal(automaticPublicCapabilityLabel(["MISSING"], labels, "صفحه عمومی سازمان"), "صفحه عمومی سازمان");
  assert.equal(automaticPublicCapabilityLabel(["SHOP", "APPOINTMENT"], labels, "صفحه عمومی سازمان"), "صفحه عمومی سازمان");
  assert.equal(automaticPublicCapabilityLabel(["SHOP"], labels, "صفحه عمومی سازمان"), "خودکار: فروشگاه");
});
