import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relative: string): string {
  const resolved = `${projectRoot}${relative.startsWith("/") ? "" : "/"}${relative}`;
  if (!existsSync(resolved)) return "";
  return readFileSync(resolved, "utf8");
}

function gitOutput(args: string[]) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function add(name: string, ok: boolean, detail = "") {
  const status = ok ? "PASS" : "FAIL";
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${status} ${name}${suffix}`);
  return ok;
}

const modulePaths = [
  "lib/ai-media/platform-domain.ts",
  "lib/ai-media/import-planning.ts",
  "lib/ai-media/baz-spend-planning.ts",
  "lib/ai-media/contribution-mirror.ts",
];
const modules = modulePaths.map((path) => read(path)).join("\n");
const schemaProposal = read("docs/ai-media/AI_MEDIA_PLATFORM_DOMAIN_SCHEMA_PROPOSAL.md");
const tests = read("tests/unit/ai-media-platform-domain.test.ts");
const packageJson = read("package.json");
const diffNames = `${gitOutput(["diff", "--name-only"])}\n${gitOutput(["diff", "--cached", "--name-only"])}`;
const diff = gitOutput(["diff"]);
const allowedPreviewFoundationMigration = "prisma/migrations/20260716000100_ai_media_preview_mock_write_foundation/migration.sql";
const allowedRecoveredMigration = "prisma/migrations/20260707000200_export_hub_extend_data_types/migration.sql";
const migrationChanges = diffNames
  .split(/\r?\n/)
  .map((line) => line.trim().replaceAll("\\", "/"))
  .filter((line) => line === allowedPreviewFoundationMigration || line === allowedRecoveredMigration);

const checks: Array<[string, boolean, string?]> = [];

checks.push(["platform domain modules exist", modulePaths.every((path) => existsSync(`${projectRoot}${path}`))]);
checks.push(["schema proposal doc exists", existsSync(`${projectRoot}docs/ai-media/AI_MEDIA_PLATFORM_DOMAIN_SCHEMA_PROPOSAL.md`)]);
checks.push(["schema proposal records migration source boundary", /migration source now exist/i.test(schemaProposal) && /has not been applied to Production/i.test(schemaProposal)]);
checks.push(["modules do not import Prisma DB server-only storage env or fetch", !/@\/lib\/db|@prisma|prisma|server-only|@vercel\/blob|process\.env|\bfetch\s*\(/.test(modules)]);
checks.push(["modules do not add Render write helpers", !/\bcreateAiMediaJob\s*\(|\bcancelAiMediaJob\s*\(|\/v1\/product-image-suggestions\/jobs/.test(modules)]);
checks.push(["docs mention Bazar Baz owns wallet and imported media", /Bazar Baz owns wallet planning, imported media/i.test(schemaProposal)]);
checks.push(["docs mention ai-media-service emits contribution facts only", /ai-media-service emits contribution facts only/i.test(schemaProposal)]);
checks.push(["docs mention worker operators cannot see cross-user media", /Worker operators cannot see cross-user media/i.test(schemaProposal)]);
checks.push(["docs mention SUPER_ADMIN full monitoring later", /SUPER_ADMIN full monitoring is a later/i.test(schemaProposal)]);
checks.push(["tests cover import planning", /RESULT_READY plans import pending/.test(tests) && /failed import hides raw worker output/.test(tests)]);
checks.push(["tests cover Baz hold planning", /hold does not settle on RESULT_READY/.test(tests) && /hold settles on IMPORTED only/.test(tests)]);
checks.push(["tests cover contribution mirror", /accepted imported contribution is pending-reward eligible/.test(tests) && /sanitized contribution fact exposes no raw/.test(tests)]);
checks.push(["package exposes platform domain scripts", /test:ai-media:platform-domain/.test(packageJson) && /quality:ai-media-platform-domain/.test(packageJson)]);
checks.push(["only authorized Preview foundation / recovered migration changed", migrationChanges.every((path) => path === allowedPreviewFoundationMigration || path === allowedRecoveredMigration)]);
checks.push(["no Render write call added in phase diff", !/\bcreateAiMediaJob\s*\(|\bcancelAiMediaJob\s*\(|\/v1\/product-image-suggestions\/jobs/.test(diff)]);

const failed = checks.filter(([name, ok, detail]) => !add(name, ok, detail));

if (failed.length > 0) {
  console.error(`AI media platform domain foundation validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("AI media platform domain foundation validation passed.");
}
