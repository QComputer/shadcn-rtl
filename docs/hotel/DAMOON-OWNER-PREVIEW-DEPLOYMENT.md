# Damoon protected owner preview — deployed acceptance

Verdict: **DAMOON_PROTECTED_PREVIEW_LIVE_VERIFIED**.

- URL: https://damoon-hotel-owner-preview-qpcvtmw8u-ahmads-projects-1b4ce1dc.vercel.app/fa/
- Locales: `/fa/`, `/en/`, `/ar/`; root redirects to Persian.
- Vercel deployment: `dpl_DKQTyDXgKnQyWGmCpWeUmgWEJDnH`, READY, Preview (`target=null`), aliases `[]`.
- Approved project: `damoon-hotel-owner-preview`, `prj_mdMJzn5Jn6oTxDyVW5GrsnvqGPaC`, team `team_SXzXqmBelw5uJhsXMckCDajv`.
- Deployed source: `223b4071800bdf5461686df97145e43131f4cc3c`, following implementation `cbcf30c2c64017de32370362361248ec43a719a9` on `codex/platform-combined-integration-20261015`.
- Deployment metadata independently confirms `sourceCommit` and `contentMode=SYNTHETIC_PREVIEW`. The downloaded manifest equals the local reviewed manifest; the downloaded JavaScript bundle SHA-256 matches that manifest.

## Scope and build

The isolated static package reuses accepted Hotel presentation/calendar/guest/gallery components and existing conceptual images/fonts. It contains 19 hashed entries (18 static files plus routing configuration), 980,471 bytes before the self-describing manifest. No Next.js app deployment, dependency installation, database, functions, API runtime, provider clients or environment files are included. Shared component support for concept cards is explicitly gated to a supplied `SYNTHETIC_PREVIEW`; public and authenticated CMS paths ignore it. Three sample room cards are labeled conceptual, with no capacity/price/amenity assertions. Hotel data, real photography and owner-approved public content remain separate.

Build command: `node scripts/ops/build-damoon-owner-preview.mjs`. The generated output is `.tmp/damoon-owner-preview-package/.vercel/output/`; its project link identifies only the approved owner-preview project. Deployment used `--prebuilt --target preview`, explicit project/team and source metadata. No `--prod`, aliases, project protection changes, GitHub push or custom domains were used.

Local TypeScript passed; targeted ESLint passed with zero warnings/errors. Static production bundle passed six local Chromium cases (fa/en/ar × desktop/mobile). Existing shared Hotel presentation browser regressions passed 15/15 after supplying concept-card input to prove no public/CMS leakage. No migration or database suite was repeated for this schema-free static package.

## Actual deployed browser acceptance

Same-project short-lived Vercel development OIDC authentication was passed in memory only to the exact deployment origin. It did not disable SSO, create a share link, change Trusted Sources or reveal/persist a token. Six deployed Chromium cases passed:

| Locale | Desktop 1440×900 | Mobile 390×844 | Direction |
| --- | --- | --- | --- |
| Persian | PASS | PASS | RTL |
| English | PASS | PASS | LTR |
| Arabic | PASS | PASS | RTL |

Each case verified visible synthetic disclosure, hero, three concept cards and zero published cards, gallery/image delivery (seven loaded images), localized date/guest controls, correct language/direction, no horizontal overflow and noindex. All mobile cases verified menu focus/Escape behavior. Captured six real remote screenshots. Browser errors and unexpected API/external requests were empty.

Durable remote evidence: `.tmp/damoon-owner-preview-remote-browser/result.json` (`status=PASSED`, `exitCode=0`, six completed pages) and `{fa,en,ar}-{desktop,mobile}.png`. Local evidence is separately retained at `.tmp/damoon-owner-preview-browser/`. These are synthetic owner-preview acceptance, not real Hotel content, CMS runtime, bookings or physical-device acceptance.

## Protection and isolation

Post-deployment project metadata retains `ssoProtection.deploymentType=all_except_custom_domains`. Anonymous HEAD to the new generated URL redirects HTTP 302 to Vercel authentication. Authenticated HTTP returns 200 and correct HTML MIME, `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: private, no-store`, CSP including `connect-src 'none'` and `form-action 'none'`. HTML robots metadata and `robots.txt` also disallow indexing. Reviewers must authenticate with an account permitted by the existing project protection; no new invitation/audience grant was made.

The Bazarbaaz Production target remains `dpl_7hwJXyte1mLxQ7P7qa7AKorx4nuK` in project `prj_CVf08NTiNcwtUPHGfGEwfyKHXoZL`. The preview project's Production target remains null. No Production credentials were included in the static bundle, no Production data was queried or changed, and no payment/SMS/booking/invitation calls occurred. Main remained at `ddd414184caadf479e357c5a7e19238592c08b40` with 378 dirty paths; Hotel/Retail worktrees and inherited artifacts were untouched.

## Troubleshooting and rollback

The initial CLI attempt rejected `--skip-domain` because it is Production-only; it created no deployment. The corrected command retained Preview and yielded the READY deployment above. PowerShell's CLI wrapper dropped the `env run --` command separator; invoking the installed `vc.js` directly restored supported OIDC authentication. `vercel curl` required the linked project's scope rather than forwarding `--scope` to native curl. No security control was weakened for these fixes.

This document records the existing deployment; it does not authorize another deployment. Future approved updates must preserve protection and explicit synthetic mode, rebuild from a reviewed commit, verify file hashes and record the new immutable URL. To withdraw the preview, remove only this task's exact deployment through the normal authorized project workflow; retain historical deployment `dpl_FiNoJuSM3g3sRN8XCiK6Rg3rpUgC` and do not promote or alter Production. Real Hotel account activation, owner content approval, Production lineage and public launch remain separate milestones.
