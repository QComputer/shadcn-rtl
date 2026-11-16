import assert from "node:assert/strict";
import { test } from "node:test";
import { getDeploymentRevision } from "@/lib/deployment-context";

test("release revision exposes only a valid abbreviated commit identifier", () => {
  const keys = ["APP_BUILD_REVISION", "RUNFLARE_GIT_COMMIT_SHA", "COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA"] as const;
  const saved = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(getDeploymentRevision(), null);
    process.env.RUNFLARE_GIT_COMMIT_SHA = "A".repeat(40);
    assert.equal(getDeploymentRevision(), null);
    process.env.VERCEL_GIT_COMMIT_SHA = "A".repeat(40);
    assert.equal(getDeploymentRevision(), "a".repeat(12));
    process.env.VERCEL_GIT_COMMIT_SHA = "not-a-valid-commit-secret";
    assert.equal(getDeploymentRevision(), null);
    process.env.APP_BUILD_REVISION = "0123456789abcdef0123456789abcdef01234567";
    assert.equal(getDeploymentRevision(), "0123456789ab");
    process.env.APP_BUILD_REVISION = "not-a-valid-commit-secret";
    assert.equal(getDeploymentRevision(), null);
  } finally {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    });
  }
});
