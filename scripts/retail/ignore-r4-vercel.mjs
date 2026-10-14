// Vercel: 0 skips a build, 1 allows it. Only the explicitly enumerated
// isolated R4/H2 validation branches are suppressed; other branches retain
// their accepted deployment behavior.
const excludedBranches = new Set([
  "codex/retail-r4-checkout-20261013",
  "codex/retail-h2-taxonomy-20261014",
  "codex/retail-h2-r5-integration-20261014",
]);
process.exit(excludedBranches.has(process.env.VERCEL_GIT_COMMIT_REF ?? "") ? 0 : 1);
