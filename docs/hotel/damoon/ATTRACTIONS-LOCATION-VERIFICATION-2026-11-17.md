# Damoon attractions location status

Updated 2026-11-17 from the owner-supplied Damoon attractions pack v2.2. This replaces the previous two-place draft and its road-route numbers.

## Publication status

- The hotel map coordinate is a public directory point marked `PUBLIC_MAP_POINT_NOT_OWNER_APPROVED`. Local manager confirmation is still pending. The UI labels the location as approximate and pending; it does not show numeric hotel coordinates as visible copy.
- Attraction coordinates are approximate public map points. They are not surveyed property entrances or owner-approved route origins.
- Every published numeric distance is the pack's `straightLineKm`, labeled as approximate straight-line distance from the provisional public hotel map point. It is never presented as a road distance.
- `roadKm` is `null` and `roadKmStatus` is `NOT_VERIFIED` for all eight entries. No road distance or live travel time is claimed.
- Google Maps links open a destination only; the guest chooses a start point. Waze and OpenStreetMap are outbound links. No map iframe or CSP expansion is used.
- The owner directly confirmed that Zaman Khan Bridge is accessible to visitors on 2026-11-17. The public text does not add opening hours, admission prices, or activity promises.
- The pack includes no third-party photos or logo assets.

The canonical records, translations, source URLs, coordinates, straight-line values, and pending/confirmed field statuses are kept in [the attractions data module](</C:/Users/disso/Project/shadcn-rtl-damoon-public-ux/sites/damoon/damoon-attractions-data.js>). The supplied offline QA script passed before integration; repository integration tests cover route wiring and rendered output.
