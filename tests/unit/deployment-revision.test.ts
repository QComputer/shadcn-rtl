import assert from "node:assert/strict";
import { test } from "node:test";
import { getDeploymentRevision } from "@/lib/deployment-context";

test("release revision exposes only a complete hexadecimal commit", () => {
  const keys = ["RUNFLARE_GIT_COMMIT_SHA", "COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA"] as const;
  const saved = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(getDeploymentRevision(), null);
    process.env.RUNFLARE_GIT_COMMIT_SHA = "A".repeat(40);
    assert.equal(getDeploymentRevision(), "a".repeat(40));
    process.env.RUNFLARE_GIT_COMMIT_SHA = "not-a-valid-commit-secret";
    assert.equal(getDeploymentRevision(), null);
  } finally {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    });
  }
});
