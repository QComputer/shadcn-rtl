import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relative: string): string {
  const resolved = `${projectRoot}${relative.startsWith("/") ? "" : "/"}${relative}`;
  if (!existsSync(resolved)) return "";
  return readFileSync(resolved, "utf8");
}

function add(name: string, ok: boolean, detail = "") {
  const status = ok ? "OK" : "FAIL";
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`${status} ${name}${suffix}`);
  return ok;
}

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean) {
  if (ok) passed += 1;
  else failed += 1;
  add(name, ok);
}

const currentState = read("docs/AI_HANDOFF_CURRENT_STATE.md");
const nextPrompt = read("docs/AI_HANDOFF_NEXT_PROMPT.md");
const validation = read("docs/AI_HANDOFF_VALIDATION.md");
const snapshotScript = read("scripts/release/create-clean-source.mjs");

check("docs/AI_HANDOFF_CURRENT_STATE.md exists", existsSync(`${projectRoot}docs/AI_HANDOFF_CURRENT_STATE.md`));
check("docs/AI_HANDOFF_NEXT_PROMPT.md exists", existsSync(`${projectRoot}docs/AI_HANDOFF_NEXT_PROMPT.md`));
check("docs/AI_HANDOFF_VALIDATION.md exists", existsSync(`${projectRoot}docs/AI_HANDOFF_VALIDATION.md`));

check("current-state mentions shadcn-rtl ownership", /shadcn-rtl/.test(currentState));
check("current-state mentions ai-media-service ownership", /bazar-baz-ai-media-service/.test(currentState));
check("current-state mentions P07 not ready", /P07 not ready/.test(currentState));
check("validation mentions build/typecheck/source-baseline", /build/.test(validation) && /typecheck/.test(validation) && /source-baseline/.test(validation));
check("next prompt mentions no write flow", /no write flow|no AI writes|no Blob writes/i.test(nextPrompt));
check("snapshot script exists", existsSync(`${projectRoot}scripts/release/create-clean-source.mjs`));
check("snapshot script excludes env files", /isEnvFile|\.env/.test(snapshotScript) && /\.env\.example/.test(snapshotScript));
check("snapshot script excludes node_modules", /node_modules/.test(snapshotScript));

check("snapshot directory is gitignored", (() => {
  const gitignore = read(".gitignore");
  return /^\/?\.tmp\//.test(gitignore) || /\.tmp/.test(gitignore);
})());

console.log(`\nresults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exitCode = 1;
}
