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
  ]} onUpdate={() => {}} onOpenDetails={() => {}} onRequestDelete={() => {}} />);
  assert.equal((html.match(/id="retail-inventory-/g) ?? []).length, 4, "every variant remains editable");
  assert.match(html, /value="۰"/);
  assert.match(html, /value="۷"/);
  assert.match(html, /۳۹\.۵/);
  assert.match(html, /تعریف نشده/);
  assert.ok(html.indexOf('>۳۸</span>') < html.indexOf('>۳۹.۵</span>'), "numeric sizes are sorted");
});

test("matrix normalizes localized half sizes while retaining exact duplicate variant identities", () => {
  const html = renderToStaticMarkup(<RetailVariantMatrix locale="fa" basePrice={2000000}
    definitions={[{ id: "color", key: "shoe_color", label: "رنگ سفارشی" }, { id: "size", key: "shoe_size", label: "مقاس" }]}
    variants={["39.5", "۳۹٫۵", "٣٩.٥"].map((size, index) => ({
      id: `legacy-${index}`, name: "navy", sku: `EXACT-${index}`, price: "", inventory: "4", reservedQuantity: 0,
      options: { color: "آبی نفتی", size }, manuallyUnavailable: false,
    }))} onUpdate={() => {}} onOpenDetails={() => {}} onRequestDelete={() => {}} />);
  assert.equal((html.match(/scope="col"/g) ?? []).length, 2, "one normalized size column plus its color heading");
  assert.equal((html.match(/id="retail-inventory-/g) ?? []).length, 3, "duplicate combinations retain separate editable rows");
  for (const sku of ["EXACT-0", "EXACT-1", "EXACT-2"]) assert.ok(html.includes(sku), "each duplicate has an identifiable SKU");
});
