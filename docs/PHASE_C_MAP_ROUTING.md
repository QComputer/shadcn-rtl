# Phase C — Map & Routing Integration (Handoff)

## Summary
Added free, open-source map and routing support to the driver order detail flow using **Leaflet** (display) and **OSRM** (routing).

## Files Created
| File | Purpose |
|------|---------|
| `lib/osrm.ts` | Tiny helper that calls OSRM public demo API and returns `{ distance, duration, geometry }`. |
| `app/[locale]/dashboard/driver-orders/map-view.tsx` | Client-only Leaflet map component. Renders OpenStreetMap tiles, a green shop marker, and a red delivery marker. |

## Files Modified
| File | Change |
|------|--------|
| `package.json` | Added `leaflet`, `react-leaflet`, `@types/leaflet` to dependencies. |
| `app/[locale]/dashboard/driver-orders/page.tsx` | Added `routeData` state, OSRM fetch in `handleViewOrder`, and rendered `<MapView>` + route distance/duration card inside the order detail dialog. |

## Important Implementation Notes
1. **SSR-safe map**: `driver-orders/page.tsx` imports the map via `next/dynamic` with `ssr: false`. Do NOT convert it to a server component without preserving this.
2. **Current coordinates are hardcoded** to Tehran placeholders (`51.389, 35.6892` → `51.3347, 35.7219`). Replace with real coordinates when a geocoding service or `Location` model data is available.
3. **OSRM public demo** (`router.project-osrm.org`) is rate-limited and intended for development. For production, self-host OSRM or use a commercial provider.
4. **Map CSS import**: `map-view.tsx` imports `leaflet/dist/leaflet.css`. Ensure your global CSS (or Tailwind config) does not purge this file, or the map will render without tiles.
5. **No port 3000 dev server changes were made** — existing `dev` script is unchanged.

## Next Phase
Phase D will improve the overall driver dashboard layout and introduce tab-based order filtering (assigned vs available).
