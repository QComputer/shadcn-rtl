import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
    "Γÿ╝",
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

test("Hotel stay-request translation source contains valid UTF-8 copy", async () => {
  const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)), "../..");
  const source = await readFile(resolve(repositoryRoot, "components/hotel-operations/hotel-stay-requests.tsx"), "utf8");
  assertCleanDamoonText(source, "hotel-stay-requests.tsx");
  for (const expected of ["درخواست هماهنگی اقامت", "طلبات تنسيق الإقامة", "Stay coordination requests"]) {
    assert.ok(source.includes(expected), `translation source includes ${expected}`);
  }
});
