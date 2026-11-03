import assert from "node:assert/strict";
import { test } from "node:test";
import { retailEditorSnapshot } from "../../lib/retail/editor-snapshot";

test("reopened editor is clean despite numeric base price and option key insertion order", () => {
  const saved = { basePrice: 2500000, variants: [{ options: { size: "40", color: "black" }, inventory: "4" }], images: ["a", "b"] };
  const editor = { images: ["a", "b"], variants: [{ inventory: "4", options: { color: "black", size: "40" } }], basePrice: "2500000" };
  assert.equal(retailEditorSnapshot(saved), retailEditorSnapshot(editor));
  assert.notEqual(retailEditorSnapshot(saved), retailEditorSnapshot({ ...editor, variants: [{ ...editor.variants[0], inventory: "5" }] }));
  assert.notEqual(retailEditorSnapshot(saved), retailEditorSnapshot({ ...editor, images: ["b", "a"] }));
});
