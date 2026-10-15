# Retail R6 Platform Integration Status

## Source and isolation

- Platform integration base: `9861ab3b4ce74e2c09321bae48b40900dae9b3a5`.
- Accepted Retail source: `d1680a1d57e4b12180d7d09c28a8c5038e49675d`.
- R6 UX source was cherry-picked without merging its branch ancestry; this worktree records the resulting cherry-pick as `21ee601e094520463dd7fe873d8a9965c47334de`.
- Work is isolated on `codex/bb-pwa-r6-platform-integration-20261015`. The Retail input worktree and Platform/P14 worktrees remain separate and preserved.

## Integrated behavior

- Persisted organization name, logo, PWA icons, theme colors, locale, Retail theme, and active `SHOP` capability drive install identity and Retail manifest routing.
- A verified tenant host uses its canonical `/fa/shop` route. A path-based Retail manifest uses `/{locale}/{organizationSlug}/shop`, so the installed app opens the published catalog with the existing cart, profile, and checkout routes inside its tenant path scope.
- Manifest lookups are tenant/host checked, private and non-cacheable. Missing tenant icons remain missing; the install invitation is suppressed unless all required tenant icons are configured and load successfully.
- The existing shared Service Worker remains unchanged. Its tests confirm that tenant manifests and identity are not cached and that one origin's cache cleanup does not remove another app scope's offline cache.
- Retail live routes render the existing persisted catalog. R6 offline/reconnect presentation remains client-side and does not modify order or payment behavior.

## Evidence

- Focused manifest, Retail start-path, install-manager, Service Worker, and approved-asset tests: 19 passed.
- E2E script syntax: `node --check tests/e2e/tenant-pwa-branding-ci.mjs` passed. The script now has a strict disposable PostgreSQL 17 CI target guard and synthetic Aka Shoes, Electronics, and Restaurant tenant coverage.
- Targeted ESLint: exit 0, zero errors. Three warnings remain: two existing `any` warnings in the shared locale layout and the R6 offline-state initialization warning.
- Existing organization-branding suite: 14 passed, 1 failed because its platform fallback assertion expects English `Bazarbaaz` while the current implementation returns Persian `بازارباز`. This is unrelated to R6 changes and is not hidden.
- Full typecheck, production build, DB-backed browser E2E, screenshots, and genuine browser/OS installation were not run. Local free disk was about 1.73 GiB, and another Platform build process was active; remote CI would require a push, which is outside this task's authorization.

## Remaining acceptance gates

1. Run the isolated PostgreSQL 17 browser workflow on an approved CI runner. Its install invitation test dispatches a synthetic `beforeinstallprompt`; it is UI evidence, not proof of a genuine operating-system installation.
2. Run full typecheck and production build after the active Platform build completes and adequate disk is available.
3. Verify actual Chromium installation and standalone launch, plus any supported second browser, on a real tenant/custom-domain or trusted `/app` deployment.
4. Verify Aka Shoes and a separately branded Electronics fixture screenshots, manifest, icons, deep links, offline and reconnect in that browser run.

## Ownership and preservation

After those gates pass and Platform accepts this integration, Platform owns the integrated Retail UI, tenant manifest identity, and shared PWA infrastructure. No Retail branch/worktree cleanup is performed here. The R6 input commit, handoff, other worktrees, and evidence remain preserved. No safe disk cleanup candidate was verified during this integration.

No Production data, provider, deployment, DNS, or remote Git operations were used.
