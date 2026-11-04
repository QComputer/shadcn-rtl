# PWA chrome follows storefront branding

The owner reported green Aka Shoes UI but blue Android installed-app system bars.
Public preflight confirmed both `akashoes.ir` and `www.akashoes.ir` returned
`theme_color: #2F5BFF` from `/manifest.webmanifest` and no theme-color meta tag
from `/shop`. The previous tenant header/footer release is now live, as the
owner confirmed; this PWA correction is a separate release.

## Change

`resolveTenantPwaBranding` now derives effective `themeColor` from a valid
six-digit `storefrontPrimaryColor`, then the legacy PWA `themeColor`. The owner
explicitly expects the selected storefront color to color installed app chrome.
Neither persisted field is rewritten. Clearing the storefront color restores
the existing legacy fallback. The tenant ownership check runs before selecting
either value; invalid values cannot enter the manifest or viewport.

Both tenant PWA query boundaries select the storefront color. The existing
manifest builder therefore receives the effective brand color through its
existing themeColor field. A dynamic Next viewport emits the same theme-color
on tenant hosts; the shop layout also emits it for path-based shop pages.
Metadata and viewport share a request-cached shop lookup. The platform retains
its blue default. Manifest identity, URLs, scope, icon assets and background
color are unchanged. No migration or production data mutation is needed.

## Verification

- 27 focused tests passed across manifest, organization branding and Retail PWA.
  New regression cases cover green overriding legacy blue, non-mutation/reset,
  invalid colors and two-tenant/foreign-record isolation.
- Local full TypeScript passed with durable exit 0 in the external
  `hero-release/pwa-color-typecheck-exit.txt` artifact. Scoped ESLint passed with
  two inherited explicit-any warnings in the root locale layout.
- Inexpensive subagent reviewed contracts and implementation. Kilo auto/free
  performed a bounded design review at cost 0. Its suggestion that reinstall is
  mandatory was rejected: Chrome's official manifest-update documentation
  describes automatic updates and the Android WebAPK update workflow.

## Publication continuation

Source/CI identifiers will be recorded after commit. Publication is not yet
performed: Browser inventory sees Chrome 3 and RunFlare tab 561100727, but
tab read/control/screenshot/CDP calls fail in the browser SDK with an internal
undefined timeoutMs error. The documented browser troubleshooting path and
alternate documented APIs were checked; no raw browser transport was used.
The installed RunFlare CLI's explicit-selection read-only event command was
tried after rejecting cached-project reuse. Login was expired; its email prompt
was aborted. No credentials were entered, no cached deployment was run, and no
provider variables/release request were changed for this PWA patch.

Once browser control works: verify the active release, pin the exact green-CI
source SHA, reread the pin, and deploy that commit using the existing Git UI.
Then verify both host manifests and page meta colors, the advertised tenant
manifest route, and unchanged platform defaults/manifest identity. Saving a
pin restarts the existing image; it is not publication/source proof.

Physical Android acceptance remains pending. Existing WebAPKs can retain old
manifest colors until Chrome updates them; do not change manifest id/location
or force a data reset/reinstall as a workaround. Reference:
https://web.dev/articles/manifest-updates
