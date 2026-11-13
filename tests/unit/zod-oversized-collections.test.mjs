import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

test("oversized constrained arrays do not generate an issue per invalid element", () => {
  const result = z.array(z.number()).max(5).safeParse(Array(10_000).fill("invalid"));
  assert.equal(result.success, false);
  assert.equal(result.error.issues.length, 1);
  assert.equal(result.error.issues[0].code, "too_big");
});
