# Bazarbaaz corrected brand asset verification

The owner-provided October 13 corrected archives were integrated into the isolated platform-combined candidate. The archives themselves contain no approval README or asset manifest; this note records the provided package hashes and the verified source-to-worktree mapping. This records package provenance, not a Production deployment or live-tenant configuration approval.

| Source package | SHA-256 | Entries copied and verified |
| --- | --- | ---: |
| `brand-corrected.zip` | `6DFC8AE228116E0EB74373065F2594CD709BD930D69269DDEB7808288FC6EF0B` | 42/42 under `public/brand/` |
| `icons-corrected.zip` | `277CE505BACEF75711AB966C2B89EA7C4401FB63530BC8EBC0CFBB6F7A22DE19` | 17/17 under `public/icons/` (the archive's leading `icons/` directory is stripped) |

Every non-directory archive entry was SHA-256 compared with its candidate destination: zero mismatches and zero missing entries. `brand-corrected.zip` supplies `marks/bazarbaaz-mark.svg` as the master mark; it does not contain a file literally named `bazarbaaz-logo-master.svg`. The master mark uses viewBox `0 0 1000 1000`, principal stroke `#0F172A`, accent stroke `#2F5BFF`, and a 72-unit stroke. The shared React logo component now uses that path geometry and the supplied lockup text positions and type sizes. Theme variants preserve the supplied dark palette (`#F8FAFC` / `#3B82F6`).

Key corrected platform asset hashes:

| Path | Dimensions | SHA-256 |
| --- | ---: | --- |
| `public/brand/marks/bazarbaaz-mark.svg` | SVG viewBox 1000 × 1000 | `1E12273A385AD5176E32D6E3FDB8575C4BAB7BB43B1DEC9BBE9549E16F42D879` |
| `public/icons/icon-192x192.png` | 192 × 192 | `76E4ECB1C3A2DA04DC8F2CF47BD6E31F72B8FD5DB8575E74223CE54477E9260F` |
| `public/icons/icon-512x512.png` | 512 × 512 | `1ACACF7030FB211DD57759925EB9D3579803F7ECBC4DBC2C303C31FF5AF026EF` |
| `public/icons/icon-maskable-192x192.png` | 192 × 192 | `94700BFED2E8D09C5A019550EC4ED82A50AE1A2BFF59BF21D93CAA62CA31846E` |
| `public/icons/icon-maskable-512x512.png` | 512 × 512 | `34B336B1785DB46ABFED415617D27BE205A2524C7F9DC6A83A50F713D7267746` |
| `public/icons/apple-touch-icon.png` | 180 × 180 | `241642370C3ED2B01C71F41C0D1A8AEECD15F68D432317D3A4246A7E9D123D6E` |

Tenant assets already present in the selected candidate remain generic data-driven assets. No tenant slug exception or Production branding-row change was added. A tenant is installable only when its trusted persisted branding supplies the required tenant-owned icon set; missing tenant assets do not substitute the Bazarbaaz image.

The 178 Restaurant 13 asset deletions observed in the dirty main checkout are not mirrored into this candidate. The retained candidate assets are traceable in Git to `be65f1c600e6c531bdd9a5b64d0c8a6666bb7309` (`feat: integrate restaurant 13 branding and home content`). Their deletion provenance in the dirty main checkout remains unknown; no restoration or mutation of that checkout was performed.

Production public HTTP checks are documented separately in the milestone report. Public responses do not establish database branding-row values or official owner approval of tenant configuration.

## Public Production observation (2026-10-15)

This is read-only HTTP/browser evidence, not a database audit. The Production home-page logo image bytes match the approved repository references: Aka Shoes uploaded image SHA-256 `C796C64D36A43002674B1F53796CB97B525D34D6BF3AD97BFFF75FCF64D7867E` matches `aka-shoes-logo-square-brand-1024.png`; Restaurant 13 uploaded image SHA-256 `A64909B7A7E67AFE24E6BF1254B4EDA45AFFB06FFFFB5E9DB41824D51FCAF868` matches `logo-mark-gold.png`. Restaurant 13's live favicon, Apple Touch Icon, and regular 192/512 icons also match the repository's production-ready assets by SHA-256.

The live manifests still show legacy or unsafe configuration: platform identity is `Bazarbaaz | بازارباز` / `Bazarbaaz`; Aka Shoes is `کفش آکا` and points regular icons at platform paths while both maskable paths return 404; Restaurant 13 is `رستوران ایتالیایی سیزده`, and its maskable icons point to Bazarbaaz assets. Direct browser fallback GETs to `/favicon.ico` and `/apple-touch-icon.png` currently return HTML on all three domains. The tenant page metadata explicitly links branded icon paths on Aka Shoes and Restaurant 13, but no such explicit platform links appeared in the live platform page head during this browser sample. These Production outputs differ from this local candidate and remain uncorrected because no Production deployment or database write is authorized.
