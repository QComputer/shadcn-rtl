import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const validatorPath = "scripts/quality/validate-db-legacy-migration-immutability.mjs";
const foundationPath = "prisma/migrations/20260628000300_export_hub_foundation/migration.sql";
const correctedPath = "prisma/migrations/20260707000200_export_hub_extend_data_types/migration.sql";
const recoveryDocPath = "docs/database/DATABASE_MIGRATION_CHAIN_RECOVERY.md";
const fixtureFiles = [validatorPath, foundationPath, correctedPath, recoveryDocPath];

function withFixture(run) {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "legacy-migration-validator-"));
  try {
    for (const relativePath of fixtureFiles) {
      const destination = path.join(fixtureRoot, relativePath);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(path.join(repositoryRoot, relativePath), destination);
    }
    run(fixtureRoot);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function runValidator(fixtureRoot) {
  return spawnSync(process.execPath, [path.join(fixtureRoot, validatorPath)], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
}

test("legacy migration validator accepts the reviewed source and recovery record", () => {
  withFixture((fixtureRoot) => {
    const result = runValidator(fixtureRoot);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /DB legacy migration immutability validation passed\./);
  });
});

test("legacy migration validator rejects changes to either migration's exact checksum", async (t) => {
  for (const migrationPath of [foundationPath, correctedPath]) {
    await t.test(migrationPath, () => {
      withFixture((fixtureRoot) => {
        const fixturePath = path.join(fixtureRoot, migrationPath);
        writeFileSync(fixturePath, `${readFileSync(fixturePath, "utf8")}\n-- changed fixture bytes\n`);
        const result = runValidator(fixtureRoot);
        assert.notEqual(result.status, 0);
        assert.ok(result.stdout.includes(`FAIL ${migrationPath} matches exact`), result.stdout);
      });
    });
  }
});

test("legacy migration validator rejects a recovery record that removes the CASE A rationale", () => {
  withFixture((fixtureRoot) => {
    const fixturePath = path.join(fixtureRoot, recoveryDocPath);
    const original = readFileSync(fixturePath, "utf8");
    writeFileSync(fixturePath, original.replace("CASE A — correct the not-yet-deployed migration in place.", "CASE A — undocumented fixture."));
    const result = runValidator(fixtureRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /recovery decision is explicitly CASE A/);
  });
});

test("legacy migration validator rejects an unguarded corrected enum migration", () => {
  withFixture((fixtureRoot) => {
    const fixturePath = path.join(fixtureRoot, correctedPath);
    const original = readFileSync(fixturePath, "utf8");
    writeFileSync(fixturePath, original.replace(/DO\s+\$\$[\s\S]*?\$\$;/, "SELECT 1;"));
    const result = runValidator(fixtureRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /corrected migration uses guarded enum blocks/);
  });
});

