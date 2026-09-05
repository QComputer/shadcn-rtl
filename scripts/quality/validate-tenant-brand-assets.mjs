import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function fail(reason) {
  console.error(`FAIL ${reason}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function checkFile(rel, expectations = {}) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    fail(`missing ${rel}`);
    return false;
  }
  const stat = readFileSync(abs);
  if (expectations.maxBytes && stat.length > expectations.maxBytes) {
    fail(`${rel} exceeds ${expectations.maxBytes} bytes (actual ${stat.length})`);
    return false;
  }
  pass(`${rel} (${stat.length} bytes)`);
  return true;
}

function validateTenantBrandAssets(tenantSlug) {
  const overlayRoot = join(root, "public/brand/tenants", tenantSlug);
  const manifestPath = join(root, "docs/overlays", `${tenantSlug}-brand`, "asset-manifest.json");

  if (!existsSync(overlayRoot)) {
    fail(`overlay root missing: ${overlayRoot}`);
    return;
  }

  if (!existsSync(manifestPath)) {
    fail(`asset-manifest.json missing: ${manifestPath}`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    fail(`invalid asset-manifest.json: ${e.message}`);
    return;
  }

  if (manifest.tenant?.slug !== tenantSlug) {
    fail(`asset-manifest tenant slug mismatch: ${manifest.tenant?.slug}`);
    return;
  }

  pass(`asset-manifest.json validates for tenant ${tenantSlug}`);

  const sourceFiles = (manifest.files || []).filter((f) => f.path.startsWith(`public/brand/tenants/${tenantSlug}/source/`));
  const productionFiles = (manifest.files || []).filter((f) => !f.path.startsWith(`public/brand/tenants/${tenantSlug}/source/`));

  pass(`source files (not wired to production UI): ${sourceFiles.length}`);
  pass(`production candidate files: ${productionFiles.length}`);

  const requiredPwa = [
    "pwa/icon-192x192.png",
    "pwa/icon-512x512.png",
    "pwa/maskable-192x192.png",
    "pwa/maskable-512x512.png",
    "pwa/apple-touch-icon-180.png",
  ];

  const requiredBrowser = [
    "browser/favicon.ico",
    "browser/favicon.svg",
    "browser/favicon-16x16.png",
    "browser/favicon-32x32.png",
    "browser/favicon-48x48.png",
  ];

  const requiredSocial = [
    "social/og-image-1200x630.png",
    "social/twitter-card-1200x628.png",
  ];

  const requiredLogo = [
    "logo/aka-shoes-lockup-green-transparent.png",
    "logo/aka-shoes-mark-green-transparent.png",
  ];

  for (const rel of [...requiredPwa, ...requiredBrowser, ...requiredSocial, ...requiredLogo]) {
    const fullRel = `public/brand/tenants/${tenantSlug}/${rel}`;
    const entry = (manifest.files || []).find((f) => f.path === fullRel);
    if (!entry) {
      fail(`required asset missing from manifest: ${fullRel}`);
      continue;
    }
    if (entry.width && entry.height) {
      pass(`${fullRel} dimensions ${entry.width}x${entry.height}`);
    }
    if (entry.format) {
      pass(`${fullRel} format ${entry.format}`);
    }
    checkFile(fullRel, { maxBytes: 5 * 1024 * 1024 });
  }

  const shaPath = join(root, "SHA256SUMS.txt");
  if (existsSync(shaPath)) {
    pass("SHA256SUMS.txt present");
  } else {
    fail("SHA256SUMS.txt missing");
  }
}

const tenant = process.argv[2] || "aka-shoes";
validateTenantBrandAssets(tenant);
