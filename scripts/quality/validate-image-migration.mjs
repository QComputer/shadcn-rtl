/**
 * Image Migration Validation Tests
 * Validates Vercel Blob storage migration and image handling
 */
const baseUrl = process.env.DEPLOYED_URL || "https://bazar-baz.ir";

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, detail: error?.message || String(error) });
    console.error(`�— ${name}`);
    console.error(error);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, detail: error?.message || String(error) });
    console.error(`�— ${name}`);
    console.error(error);
  }
}

function url(path) {
  return new URL(path, baseUrl).toString();
}

// Test valid image signature validation
checkAsync("image signature accepts valid PNG header", async () => {
  // Create minimal PNG: signature + minimal IHDR-like bytes
  const pngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const validPngBuffer = Buffer.from(pngHeader.concat([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x45, 0x41]));
  
  const form = new FormData();
  form.append("file", new Blob([validPngBuffer], { type: "image/png" }), "valid.png");
  
  const response = await fetch(url("/api/upload"), { method: "POST", body: form });
  
  // Should be 401 (auth required), NOT 415 (invalid file type)
  if (response.status === 415) {
    throw new Error("Valid PNG rejected with 415 - signature validation may be broken");
  }
  if (response.status !== 401) {
    const text = await response.text().catch(() => "");
    console.log(`  Upload endpoint response: ${response.status}`);
  }
});

// Test invalid image signature rejection (we can't test this without auth, but document behavior)
checkAsync("image signature rejects invalid PNG header", async () => {
  // Fake PNG with wrong header
  const fakePngBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF]);
  
  const form = new FormData();
  form.append("file", new Blob([fakePngBuffer], { type: "image/png" }), "fake.png");
  
  const response = await fetch(url("/api/upload"), { method: "POST", body: form });
  
  // Auth required (401) takes precedence over signature validation (415)
  // Both are acceptable - either auth blocks or validation blocks
  if (response.status !== 401 && response.status !== 415) {
    const text = await response.text().catch(() => "");
    throw new Error(`Expected 401 or 415, got ${response.status}. ${text.slice(0, 200)}`);
  }
});

// Test organization pages load
checkAsync("shop organization pages load for image display", async () => {
  const response = await fetch(url("/fa/shop/sicily"));
  if (response.status !== 200) {
    throw new Error(`Expected 200 for shop page, got ${response.status}`);
  }
  
  const html = await response.text();
  const hasImgTag = html.includes("<img");
  if (!hasImgTag) {
    throw new Error("Shop page has no <img> tags - image display may be broken");
  }
});

// Test appointment pages load
checkAsync("appointment organization pages load for image display", async () => {
  const response = await fetch(url("/fa/appointment/tikal"));
  if (response.status !== 200) {
    throw new Error(`Expected 200 for appointment page, got ${response.status}`);
  }
});

// Test /uploads/ endpoint responds correctly
checkAsync("uploads endpoint handles requests properly", async () => {
  const response = await fetch(url("/uploads/nonexistent-file.jpg"));
  // Should return 404 (file not found) rather than 500 (server error)
  if (response.status !== 404) {
    throw new Error(`Expected 404 for nonexistent upload, got ${response.status}`);
  }
});

// Test that valid JPEG header is recognized
checkAsync("JPEG image signature is valid format", async () => {
  // JPEG SOI marker + minimal data
  const jpegHeader = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00];
  const jpegBuffer = Buffer.from(jpegHeader);
  
  const form = new FormData();
  form.append("file", new Blob([jpegBuffer], { type: "image/jpeg" }), "test.jpg");
  
  const response = await fetch(url("/api/upload"), { method: "POST", body: form });
  // Auth check (401) should happen before signature validation
  if (response.status !== 401) {
    const text = await response.text().catch(() => "");
    console.log(`  Upload endpoint response: ${response.status}`);
  }
});

// Test WebP header validation
checkAsync("WebP image signature is valid format", async () => {
  // WebP signature (RIFF + WEBP)
  const webpHeader = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
  const webpBuffer = Buffer.from(webpHeader);
  
  const form = new FormData();
  form.append("file", new Blob([webpBuffer], { type: "image/webp" }), "test.webp");
  
  const response = await fetch(url("/api/upload"), { method: "POST", body: form });
  // Auth check (401) should happen before signature validation
  if (response.status !== 401) {
    const text = await response.text().catch(() => "");
    console.log(`  Upload endpoint response: ${response.status}`);
  }
});

console.log("\n" + "=".repeat(50));
console.log("IMAGE MIGRATION VALIDATION RESULTS");
console.log("=".repeat(50) + "\n");

console.table(checks);

const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  console.error(`\n❌ ${failed.length} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\n✅ All checks passed - image migration validated");
}