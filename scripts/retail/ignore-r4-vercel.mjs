// Vercel: 0 skips a build, 1 allows it. Only the isolated R4 feature branch
// is suppressed; the accepted deployment behavior of other branches remains.
process.exit(process.env.VERCEL_GIT_COMMIT_REF === "codex/retail-r4-checkout-20261013" ? 0 : 1);
