// Vercel: 0 skips a build, 1 allows it. Only the isolated R4 feature branch
// is suppressed; the accepted deployment behavior of other branches remains.
const excludedBranches = new Set([
  "codex/retail-r4-checkout-20261013",
  "codex/retail-h2-taxonomy-20261014",
]);
process.exit(excludedBranches.has(process.env.VERCEL_GIT_COMMIT_REF ?? "") ? 0 : 1);
