# Damoon coded frontend

Dependency-free Persian RTL frontend. Source is independent of the Bazarbaaz site builder. Three extensible palettes in `themes.js` each have light/dark tokens; run `node build.mjs` after adding a palette to regenerate `theme-tokens.css`.

Local: `node build.mjs`, then `node server.mjs` (port 8080, or `PORT`). Shared RunFlare runtime: `node build.mjs --shared-runtime`, then copy `dist/` into `public/damoon-front/` of the reviewed application checkout. Do not copy node_modules, environment files or database/provider credentials.

The shared proxy serves only exact actual Damoon hosts and an explicit set of public GET/HEAD paths. APIs and authenticated routes retain existing routing. The build emits `/damoon-front` asset URLs and real per-route static entry files; the shared runtime rewrites page requests to the shared entry. Changes to room URLs must update both `content.js` and `lib/damoon-public-route.ts`.

Images are conceptual and labeled; this is a noindex work-in-progress release. The original logo and approved real photography still need replacement. Calendar selection uses ISO dates internally and Persian presentation, derived from accepted `lib/booking/jalali-calendar.ts` at c03176f. Dates/guests are for coordination only, not inventory, pricing, reservation or payment.

Contact data was cross-checked on 2026-10-27: telephone +98 38 3226 1988 is listed by [Waze](https://www.waze.com/az/live-map/directions/damoun-hotel-htl-damwn-shhrkrd?to=place.w.33358147.333319329.15567976) and a public hotel recruitment notice; Twelfth Moharram North Street / Basij Square is consistent across local Master Data and hotel directories. This is public-source corroboration, not a test call. Core amenities, breakfast, arrival14/departure12 derive from the owner questionnaire. No room counts, live rates or cancellation promises are inferred.

Latest roadmap and limitations: `docs/hotel/damoon/README.md`.

## Languages

Persian is the default. `/fa`, `/en` and `/ar` preserve the same public route structure. `translations.js` contains English/Arabic content and UI labels. The language switch preserves the current route, query and fragment; it does not create a booking. Calendar navigation remains Jalali, with localized date labels. Locale choice is represented in the URL.
