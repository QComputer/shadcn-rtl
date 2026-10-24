# RunFlare build OOM correction

RunFlare service 85798 image v10 (604462) explicitly rebuilt main commit `d27432e2abbbccc4f3d0cedc3150a5e74c345e15`. Its log labels the operation "Reverting Commit" but identifies the accepted main SHA, not a Git revert or an older application source. The configured Git branch remains main. v8 (604356) exposes only repository/scan/queue messages; do not assign it an unobserved failure cause.

v10 installed the frozen pnpm 10.15.0 dependency tree (856 packages), generated Prisma Client 6.19.3 and compiled Next.js 16.2.7 successfully. After "Running TypeScript", RunFlare explicitly reported container OOMKilled. The preceding vulnerability summary is not evidence that scanning caused the failure.

The service resource UI showed 2.51 GB runtime RAM. It exposes no separate build-memory allocation. This is not proof of the builder's memory limit. The next opt-in prebuild prints only the cgroup memory-limit number (or an explicit unavailable/unlimited result), allowing actual build-container evidence without dumping environment variables. No plan purchase or resource increase is made.

## Narrow correction

`RUNFLARE_SKIP_DUPLICATE_TYPECHECK=1` enables `typescript.ignoreBuildErrors` only outside Vercel. With the flag unset, Next's built-in checking remains enabled. Vercel retains it even if the flag is accidentally present.

The prebuild gate requires a completed successful GitHub Actions check named `RunFlare TypeScript` for the exact local Git HEAD. That independent workflow installs the frozen lockfile on Node 24, generates Prisma and Next route types, and runs `tsc --noEmit`. A skipped, failed, canceled, missing, mismatched-SHA or inaccessible result blocks the image build. Pending checks are polled for a bounded interval. No authentication token is required for the public repository query, and neither origin credentials nor environment values are printed.

The gate deliberately fails if the provider removes Git checkout metadata or cannot access GitHub. Do not replace it with an unverified boolean assertion or claim a previously tested SHA covers a different source commit. Compilation, prerendering, image completion and actual startup must still pass separately.

No dependency, Prisma schema, tenant route, database connection or application secret is changed by this correction. It does not authorize restoration, media transfer or DNS cutover.
