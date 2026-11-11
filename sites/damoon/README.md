# Damoon coded frontend

Dependency-free multilingual frontend: Persian/Arabic RTL and English LTR. Source is independent of the Bazarbaaz site builder. Three extensible palettes in `themes.js` each have light/dark tokens; run `node build.mjs` after adding a palette to regenerate `theme-tokens.css`.

Local: `node build.mjs`, then `node server.mjs` (port 8080, or `PORT`). Shared RunFlare runtime: `node build.mjs --shared-runtime`, then copy `dist/` into `public/damoon-front/` of the reviewed application checkout. Do not copy node_modules, environment files or database/provider credentials.

The shared proxy serves only exact actual Damoon hosts and an explicit set of public GET/HEAD paths. APIs and authenticated routes retain existing routing. The build emits `/damoon-front` asset URLs and real per-route static entry files; the shared runtime rewrites page requests to the shared entry. Changes to room URLs must update both `content.js` and `lib/damoon-public-route.ts`.

Images are conceptual and labeled; this is a noindex work-in-progress release. The original logo and approved real photography still need replacement. Calendar selection uses ISO dates internally and Persian presentation, derived from accepted `lib/booking/jalali-calendar.ts` at c03176f. Dates/guests are for coordination only, not inventory, pricing, reservation or payment.

Contact data was cross-checked on 2026-10-27: telephone +98 38 3226 1988 is listed by [Waze](https://www.waze.com/az/live-map/directions/damoun-hotel-htl-damwn-shhrkrd?to=place.w.33358147.333319329.15567976) and a public hotel recruitment notice; Twelfth Moharram North Street / Basij Square is consistent across local Master Data and hotel directories. This is public-source corroboration, not a test call. Core amenities, breakfast, arrival14/departure12 derive from the owner questionnaire. No room counts, live rates or cancellation promises are inferred.

Current owner-directed scope and acceptance: `docs/hotel/damoon/PHASE1-2026-11-10.md`.
This supersedes older sequencing and does not require VTour, PWA or final SEO.
Approved original logo/current photography are owner-pending; concept labels
must remain until those assets are supplied.

The public stay planner defaults to coordination only. It validates dates and
explicit child ages locally and passes the selected room, dates and occupancy
to contact, without availability, hold or payment requests. Dates/guest counts
and partial age entries survive language changes and navigation; unknown ages
remain blank rather than being invented. Contact offers an edit-plan link.
Stay details travel in the URL/current session, so sharing a link shares them.

Source and shared-public files have inherited VTour/copy differences. Sync only
reviewed changes; do not overwrite them with an unreviewed full public copy.
The shared manifest and UI translation parity have dedicated regression tests.

## Languages

Persian is the default. `/fa`, `/en` and `/ar` preserve the same public route structure. `translations.js` contains English/Arabic content and UI labels. The language switch preserves the current route, query and fragment; it does not create a booking. Calendar navigation remains Jalali, with localized date labels. Locale choice is represented in the URL.

## Approved-reference composition

The homepage uses isolated photographic/brand regions of the supplied desktop/mobile concept references through CSS backgrounds. All controls and copy remain native HTML. `hero-reference-v2.png` is an image-generated conceptual underlay based on the reference, not a real hotel photo. `leaf-border.svg` is a code-native ornament. Lalezar is bundled for the Persian display heading with its OFL license. Keep reference dimensions stable when adjusting sprite coordinates. See `docs/hotel/damoon/DESIGN-REFERENCE-REBUILD-2026-10-28.md`.

Media intake: `media-slots.json` records the current concept/logo slots. Run
`node prepare-media.mjs <private-input-manifest.json> <new-private-output-directory>`
to prepare a local unserved review bundle under the current user’s
`.codex/recovery/damoon-media-review/` directory, outside Git. The output parent
must exist under that controlled root; arbitrary external/shared output paths
are rejected. File modes are restricted where supported; Windows inherits the
controlled user directory ACL. Input: `{ "schemaVersion": 1,
"assets": [{ "slot": "single", "file": "photo.webp", "sha256": "<file SHA256>",
"subject": "<depicted space>", "alt": {"fa":"…","en":"…","ar":"…"},
"rights": "PUBLICATION_PERMITTED", "approval": {"status":"APPROVED",
"reference":"<owner decision reference>","date":"YYYY-MM-DD"} }] }`.
Pending files may use approval status `PENDING`; they remain unapproved. The tool
checks local raster filenames, signature, size, SHA and all three alt texts,
rejects unsafe paths/duplicate slots and existing output folders, and preserves
originals. Every bundle is `PREPARED_NOT_PUBLISHED` and still needs visual/content
review. It does not verify a claimed approval's authenticity, publish assets,
replace concepts, or change captions/brand geometry. Never serve the private
manifest or review directory. Approved replacements must later update the slot's
actual usages, localized captions and concept status together in a reviewed PR.

Original EXIF/IPTC/XMP metadata is preserved, not scrubbed; inspect it before
sharing any review bundle or publishing media. The receipt explicitly requires
metadata review as well as visual/content review.
