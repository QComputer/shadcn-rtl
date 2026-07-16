import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relative: string): string {
  const resolved = `${projectRoot}${relative.startsWith("/") ? "" : "/"}${relative}`;
  if (!existsSync(resolved)) return "";
  return readFileSync(resolved, "utf8");
}

function add(name: string, ok: boolean, detail = "") {
  const status = ok ? "PASS" : "FAIL";
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${status} ${name}${suffix}`);
  return ok;
}

function gitOutput(args: string[]) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

const docPath = "docs/ai-media/AI_MEDIA_JOB_MIRROR_SOURCE_DESIGN.md";
const modulePath = "lib/ai-media/job-mirror.ts";
const testPath = "tests/unit/ai-media-job-mirror.test.ts";
const doc = read(docPath);
const moduleSource = read(modulePath);
const tests = read(testPath);
const packageJson = read("package.json");
const diffNames = gitOutput(["diff", "--name-only"]);
const stagedNames = gitOutput(["diff", "--cached", "--name-only"]);
const allowedPreviewFoundationMigration = "prisma/migrations/20260716000100_ai_media_preview_mock_write_foundation/migration.sql";
const migrationChanges = `${diffNames}\n${stagedNames}`
  .split(/\r?\n/)
  .map((line) => line.trim().replaceAll("\\", "/"))
  .filter((line) => line.includes("prisma/migrations/"));

const requiredEntities = [
  "AiMediaRequest",
  "AiMediaJobMirror",
  "AiMediaJobEvent",
  "AiMediaAsset",
  "AiMediaImport",
  "AiMediaUsageQuote",
  "AiMediaSpendHold",
  "WorkerContributionMirror",
];

const checks: Array<[string, boolean, string?]> = [];

checks.push(["design doc exists", existsSync(`${projectRoot}${docPath}`)]);
checks.push(["design doc mentions all future entities", requiredEntities.every((entity) => doc.includes(entity))]);
checks.push(["design doc says Bazar Baz owns imported asset boundary", /Bazar Baz[\s\S]*imported asset|imported asset[\s\S]*Bazar Baz|Bazar Baz[\s\S]*accepted import/i.test(doc)]);
checks.push(["design doc records wallet ledger later", /future Baz ledger|wallet\/ledger later|future wallet/i.test(doc)]);
checks.push(["design doc says Render is not wallet truth", /Render is not the source of wallet truth/i.test(doc)]);
checks.push(["design doc blocks cross-user jobs images files", /cross-user jobs\/images\/files|cross-user[\s\S]*jobs[\s\S]*images[\s\S]*files/i.test(doc)]);
checks.push(["design doc mentions SUPER_ADMIN later monitoring", /SUPER_ADMIN[\s\S]*later[\s\S]*monitor|SUPER_ADMIN[\s\S]*monitor[\s\S]*later/i.test(doc)]);
checks.push(["pure module exists", existsSync(`${projectRoot}${modulePath}`)]);
checks.push(["pure module has no DB Prisma storage or env imports", !/@\/lib\/db|@prisma|prisma|@vercel\/blob|process\.env|server-only/.test(moduleSource)]);
checks.push(["pure module has no fetch or Render write calls", !/\bfetch\s*\(|createAiMediaJob|cancelAiMediaJob|v1\/product-image-suggestions\/jobs/.test(moduleSource)]);
checks.push(["tests cover hold settlement and refund safety", /settles spend hold only after accepted Bazar Baz import/.test(tests) && /releases or refunds/.test(tests)]);
checks.push(["tests cover worker and Super Admin visibility", /worker operator visibility excludes prompts images and files/.test(tests) && /Super Admin visibility/.test(tests)]);
checks.push(["package exposes job mirror scripts", /test:ai-media:job-mirror-design/.test(packageJson) && /quality:ai-media-job-mirror-design/.test(packageJson)]);
checks.push(["only authorized Preview foundation migration changed", migrationChanges.every((path) => path === allowedPreviewFoundationMigration)]);
checks.push(["no Render write calls added in phase diff", !/\bcreateAiMediaJob\s*\(|\bcancelAiMediaJob\s*\(|\/v1\/product-image-suggestions\/jobs/.test(gitOutput(["diff"]))]);

const failed = checks.filter(([name, ok, detail]) => !add(name, ok, detail));

if (failed.length > 0) {
  console.error(`AI media job mirror design validation failed with ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("AI media job mirror design validation passed.");
}
