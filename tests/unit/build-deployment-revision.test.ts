import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeBuildRevision, resolveBuildRevision } from "@/scripts/build/deployment-revision";

const sourceSha = "ABCDEF0123456789ABCDEF0123456789ABCDEF01";

test("build revision is abbreviated from the exact Git checkout", () => {
  assert.equal(resolveBuildRevision({ env: {}, readGitHead: () => sourceSha }), "abcdef012345");
});

test("documented GitHub Actions SHA is used only in Actions when Git metadata is absent", () => {
  const env = { GITHUB_ACTIONS: "true", GITHUB_SHA: sourceSha } as NodeJS.ProcessEnv;
  assert.equal(resolveBuildRevision({ env, readGitHead: () => null }), "abcdef012345");
  assert.equal(resolveBuildRevision({ env: { ...env, GITHUB_ACTIONS: "false" }, readGitHead: () => null }), "");
});

test("revision disagreement and missing or malformed metadata fail closed", () => {
  const env = { GITHUB_ACTIONS: "true", GITHUB_SHA: "1".repeat(40) } as NodeJS.ProcessEnv;
  assert.throws(() => resolveBuildRevision({ env, readGitHead: () => sourceSha }), /does not match/);
  assert.equal(resolveBuildRevision({ env: {}, readGitHead: () => null }), "");
  assert.equal(normalizeBuildRevision("unknown"), null);
  assert.equal(normalizeBuildRevision("1".repeat(39)), null);
  assert.equal(normalizeBuildRevision("1".repeat(40)), "1".repeat(12));
});
