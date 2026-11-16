import { execFileSync } from "node:child_process";

const FULL_COMMIT_SHA = /^[a-f0-9]{40}$/i;

export function normalizeBuildRevision(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const sha = value.trim();
  return FULL_COMMIT_SHA.test(sha) ? sha.toLowerCase().slice(0, 12) : null;
}

function readGitHead(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Resolve provenance from this exact build checkout. GitHub's documented
 * GITHUB_SHA is a fallback only inside an Actions runner. Unknown builds stay
 * unknown; this never substitutes a branch tip or a manually copied SHA.
 */
export function resolveBuildRevision(input?: {
  env?: NodeJS.ProcessEnv;
  readGitHead?: () => string | null;
}): string {
  const env = input?.env ?? process.env;
  const gitRevision = normalizeBuildRevision((input?.readGitHead ?? readGitHead)());
  const actionsRevision = env.GITHUB_ACTIONS === "true"
    ? normalizeBuildRevision(env.GITHUB_SHA)
    : null;

  if (gitRevision && actionsRevision && gitRevision !== actionsRevision) {
    throw new Error("Build source revision does not match GitHub Actions GITHUB_SHA.");
  }

  return gitRevision ?? actionsRevision ?? "";
}
