import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJsonPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));

pkg.scripts ??= {};

const scriptsToAdd = {
  "env:push:vercel": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops/push-vercel-env.ps1 -EnvFile .env -Targets production",
  "env:push:vercel:preview": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops/push-vercel-env.ps1 -EnvFile .env -Targets preview",
  "env:push:vercel:all": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops/push-vercel-env.ps1 -EnvFile .env -Targets production,preview,development",
  "env:push:vercel:dry-run": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops/push-vercel-env.ps1 -EnvFile .env -Targets production -DryRun",
  "quality:vercel-env-push": "node scripts/quality/validate-vercel-env-push.mjs"
};

let changed = false;

for (const [name, command] of Object.entries(scriptsToAdd)) {
  if (pkg.scripts[name] !== command) {
    pkg.scripts[name] = command;
    changed = true;
  }
}

if (changed) {
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log("Registered Vercel env push package scripts.");
} else {
  console.log("Vercel env push package scripts were already registered.");
}
