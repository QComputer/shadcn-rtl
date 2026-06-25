#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const valueAfter = (name, fallback) => {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
};

const outArg = valueAfter("--out", ".release/bazar-baz-clean-source");
const zipArg = valueAfter("--zip-out", ".release/bazar-baz-clean-source.zip");
const outDir = path.resolve(root, outArg);
const zipOut = path.resolve(root, zipArg);
const shouldZip = args.has("--zip");

const normalize = (p) => p.replaceAll(path.sep, "/");
const relFromRoot = (abs) => normalize(path.relative(root, abs));

const blockedDirs = new Set([
  ".git",
  ".next",
  ".vercel",
  ".vscode",
  ".idea",
  ".release",
  ".turbo",
  ".kilo",
  "node_modules",
  "node_modules2",
  "coverage",
  "test-results",
  "playwright-report",
  "public/uploads",
  "uploads",
  "lib/generated/prisma",
  "db-backups",
  "New Folder",
  "signaling-server",
  "build",
  "out",
]);

const blockedExactFiles = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
  "prisma/dev.db",
  "public/myResume.pdf",
  "test-results/.last-run.json",
  "tsconfig.tsbuildinfo",
  "bazar-baz-current.dump",
]);

const blockedExtensionPatterns = [/\.pem$/i, /\.sqlite$/i, /\.db$/i, /\.zip$/i, /\.rar$/i, /\.7z$/i, /\.dump$/i, /\.backup$/i];

function isEnvFile(rel) {
  const base = path.basename(rel);
  return base.startsWith(".env") && base !== ".env.example";
}

function isBlocked(rel, dirent) {
  const cleanRel = normalize(rel);
  const parts = cleanRel.split("/");
  for (let i = 0; i < parts.length; i += 1) {
    const prefix = parts.slice(0, i + 1).join("/");
    if (blockedDirs.has(prefix) || blockedDirs.has(parts[i])) return true;
  }
  if (!dirent?.isDirectory()) {
    if (blockedExactFiles.has(cleanRel)) return true;
    if (isEnvFile(cleanRel)) return true;
    if (blockedExtensionPatterns.some((pattern) => pattern.test(cleanRel))) return true;
  }
  return false;
}

function copyTree(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(src, entry.name);
    const rel = relFromRoot(sourcePath);
    if (isBlocked(rel, entry)) continue;

    const targetPath = path.join(dest, path.relative(root, sourcePath));
    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyTree(sourcePath, dest);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
    } else if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(sourcePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.symlinkSync(linkTarget, targetPath);
    }
  }
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${result.status}`);
  }
}

function createZip() {
  fs.mkdirSync(path.dirname(zipOut), { recursive: true });
  fs.rmSync(zipOut, { force: true });

  if (process.platform === "win32") {
    const sourceGlob = path.join(outDir, "*");
    run("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -LiteralPath '${sourceGlob.replaceAll("'", "''")}' -DestinationPath '${zipOut.replaceAll("'", "''")}' -Force`,
    ]);
    return;
  }

  const zipResult = spawnSync("zip", ["-qr", zipOut, "."], {
    cwd: outDir,
    stdio: "inherit",
    shell: false,
  });
  if (zipResult.error || zipResult.status !== 0) {
    console.warn("Zip creation was skipped because the `zip` command is unavailable or failed.");
    console.warn(`Create it manually from the staged directory: ${path.relative(root, outDir)}`);
    if (zipResult.error) console.warn(zipResult.error.message);
    return;
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
copyTree(root, outDir);

run(process.execPath, ["scripts/quality/validate-release-artifact.mjs", outDir]);

console.log(`Clean release source staged at: ${path.relative(root, outDir)}`);

if (shouldZip) {
  createZip();
  if (fs.existsSync(zipOut)) {
    console.log(`Clean release ZIP created at: ${path.relative(root, zipOut)}`);
  }
} else {
  console.log("To create a ZIP on Windows:");
  console.log(`Compress-Archive -LiteralPath ${path.relative(root, outDir).replaceAll("/", "\\")}\\* -DestinationPath ${path.relative(root, zipOut).replaceAll("/", "\\")} -Force`);
}
