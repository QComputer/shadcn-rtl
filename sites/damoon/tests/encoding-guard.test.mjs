import assert from "node:assert/strict";
import test from "node:test";
import { assertCleanDamoonText } from "../encoding-guard.mjs";

test("accepts intact Persian, Arabic, English, and typography", () => {
  assert.doesNotThrow(() => assertCleanDamoonText(
    "هتل دامون · فندق دامون · Damoon Hotel © 2026 ← →",
  ));
});

test("rejects known mojibake in generated UI copy", () => {
  for (const sample of [
    "╪▒┘ü╪¬┘å",
    "┘ç╪¬┘ä",
    "ΓÇî",
    "┬╖",
    "├ù",
    "█│█▒",
    "█▓█░",
    "�",
    "Ã©",
    "Â£",
  ]) {
    assert.throws(() => assertCleanDamoonText(sample, "fixture"), /known mojibake signature/);
  }
});
