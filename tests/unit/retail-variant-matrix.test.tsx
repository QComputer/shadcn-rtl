import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import RetailVariantMatrix from "../../components/dashboard/retail-variant-matrix";

test("matrix retains duplicate and incomplete variants and distinguishes missing combinations from zero stock", () => {
  const variant = (options: Record<string, string>, inventory = "0") => ({ name: "fixture", sku: "test", price: "", inventory, reservedQuantity: 0, options, manuallyUnavailable: false });
  const html = renderToStaticMarkup(<RetailVariantMatrix locale="fa" basePrice={2000000} definitions={[{ id: "color", key: "color", label: "رنگ" }, { id: "size", key: "size", label: "سایز" }]} variants={[
    variant({ color: "مشکی", size: "39.5" }),
    variant({ color: "مشکی", size: "39.5" }, "7"),
    variant({ color: "سفید", size: "38" }, "2"),
    variant({ size: "40" }, "3"),
  ]} onUpdate={() => {}} onOpenDetails={() => {}} />);
  assert.equal((html.match(/id="retail-inventory-/g) ?? []).length, 4, "every variant remains editable");
  assert.match(html, /value="۰"/);
  assert.match(html, /value="۷"/);
  assert.match(html, /۳۹\.۵/);
  assert.match(html, /تعریف نشده/);
  assert.ok(html.indexOf('>۳۸</th>') < html.indexOf('>۳۹.۵</th>'), "numeric sizes are sorted");
});
