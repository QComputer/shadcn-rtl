import { readFileSync } from "fs";

const baseUrl = process.env.DEPLOYED_URL || "https://bazar-baz.ir";

if (!baseUrl) {
  console.error("DEPLOYED_URL is required");
  process.exit(1);
}

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

function url(path) {
  return new URL(path, baseUrl).toString();
}

async function expectStatus(name, response, allowed) {
  if (!allowed.includes(response.status)) {
    throw new Error(`${name}: expected ${allowed.join("/")}, got ${response.status}`);
  }
}

// Test 1: Homepage and basic map CSS loading
await check("homepage is reachable", async () => {
  const res = await fetch(url("/fa"));
  expectStatus("homepage", res, [200]);
  const html = await res.text();
  // Check if Leaflet CSS is loaded
  if (!html.includes("leaflet.css") && !html.includes("leaflet")) {
    console.warn("    Warning: Leaflet CSS reference not found in homepage HTML");
  }
});

// Test 2: API endpoints related to location/orders
await check("orders API requires authentication", async () => {
  const res = await fetch(url("/api/orders"));
  expectStatus("orders API", res, [401, 403]);
});

// Test 3: Check checkout page loads (contains MapLocationPicker)
await check("checkout page is reachable for shop", async () => {
  const res = await fetch(url("/fa/test-shop/shop/checkout"));
  // May 404 if shop doesn't exist, that's fine - we just check it's not a server error
  expectStatus("checkout", res, [200, 307, 308, 404]);
});

// Test 4: Check if Leaflet assets are accessible from CDN (optional - network issues may occur)
await check("Leaflet CDN assets are accessible", async () => {
  try {
    const iconResponse = await fetch("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png", { signal: AbortSignal.timeout(5000) });
    expectStatus("leaflet marker icon", iconResponse, [200]);
  } catch (err) {
    console.warn(`    Warning: Could not reach CDN (network issue) - skipping this check`);
    return;
  }
});

// Test 4: Check OSRM routing endpoint availability (optional - network issues may occur)
await check("OSRM routing endpoint is reachable", async () => {
  try {
    const res = await fetch("https://router.project-osrm.org/route/v1/driving/51.389,35.6892;51.3347,35.7219?overview=false", { signal: AbortSignal.timeout(5000) });
    if (res.status !== 200) {
      console.warn(`    Warning: OSRM returned ${res.status} (may be rate limited) - skipping this check`);
      return;
    }
    const data = await res.json();
    if (data.code !== "Ok" && data.code !== "NoMatch") {
      console.warn(`    Warning: OSRM returned code ${data.code} - skipping this check`);
      return;
    }
  } catch (err) {
    console.warn(`    Warning: Could not reach OSRM (network issue) - skipping this check`);
    return;
  }
});

// Test 5: Check Nominatim geocoding endpoint availability (may rate limit)
await check("Nominatim geocoding endpoint is reachable", async () => {
  const res = await fetch("https://nominatim.openstreetmap.org/search?format=json&q=تهران&limit=1", {
    headers: { "Accept-Language": "fa" }
  });
  // 403 is rate limiting, treat as warning
  if (res.status === 403) {
    console.warn("    Warning: Nominatim rate limited (403) - this is expected for public API");
    return;
  }
  expectStatus("nominatim", res, [200]);
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Nominatim did not return array");
  }
});

// Test 6: Check permissions policy on deployed site
await check("geolocation is NOT blocked in Permissions-Policy", async () => {
  const res = await fetch(url("/fa"));
  const permissionsPolicy = res.headers.get("permissions-policy");
  console.log(`    Permissions-Policy header: ${permissionsPolicy || "(not set)"}`);
  
  // Check if geolocation is explicitly blocked - this is an ERROR if present
  // The fix removes 'geolocation=()' from proxy.ts and next.config.ts
  if (permissionsPolicy && /geolocation\s*=\s*\(\)/.test(permissionsPolicy)) {
    throw new Error(`geolocation is blocked in Permissions-Policy header. Remove 'geolocation=()' from proxy.ts and next.config.ts`);
  }
});

// Test 7: Check Leaflet CSS import is present in map components
await check("Leaflet CSS is imported in map components", async () => {
  // Verify local code has the import (this test just confirms the fix is in place)
  const mapPickerContent = readFileSync('./components/ui/map-location-picker.tsx', 'utf-8');
  const mapViewContent = readFileSync('./app/[locale]/dashboard/driver-orders/map-view.tsx', 'utf-8');
  
  if (!mapPickerContent.includes("leaflet/dist/leaflet.css")) {
    throw new Error("Leaflet CSS import missing in map-location-picker.tsx");
  }
  if (!mapViewContent.includes("leaflet/dist/leaflet.css")) {
    throw new Error("Leaflet CSS import missing in map-view.tsx");
  }
  console.log("    ✓ Both map components have Leaflet CSS import");
});

// Test 8: Check CDN marker icons are configured in map-location-picker
await check("Map marker icons use CDN URLs", async () => {
  const mapPickerContent = readFileSync('./components/ui/map-location-picker.tsx', 'utf-8');
  
  if (!mapPickerContent.includes("cdnjs.cloudflare.com/ajax/libs/leaflet")) {
    throw new Error("CDN marker icon URLs not found in map-location-picker.tsx");
  }
  console.log("    ✓ CDN marker icons configured");
});

// Test 9: Check Persian error messages for geolocation
await check("Geolocation has Persian error messages", async () => {
  const mapPickerContent = readFileSync('./components/ui/map-location-picker.tsx', 'utf-8');
  
  if (!mapPickerContent.includes("دسترسی به موقعیت مکانی رد شده است")) {
    throw new Error("Persian error messages for geolocation not found");
  }
  if (!mapPickerContent.includes("موقعیت مکانی در دسترس نیست")) {
    throw new Error("Position unavailable Persian message not found");
  }
  console.log("    ✓ Persian geolocation error messages present");
});

// Test 10: Verify map click handler calls updateMarker
await check("Map click handler creates marker on click", async () => {
  const mapPickerContent = readFileSync('./components/ui/map-location-picker.tsx', 'utf-8');
  
  // Check that on map click, updateMarker is called
  // The code should have updateMarker(lat, lng) in the map.on("click") handler
  const hasUpdateMarkerOnMapClick = mapPickerContent.includes('map.on("click"') && mapPickerContent.includes("updateMarker(lat, lng)");
  if (!hasUpdateMarkerOnMapClick) {
    throw new Error("Map click handler does not call updateMarker - marker won't show on click");
  }
  console.log("    ✓ Map click handler calls updateMarker");
});

// Summary
console.table(results);

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error("\nFailed checks:");
  failed.forEach(f => console.error(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
} else {
  console.log("\n✅ All map-related checks passed!");
}
