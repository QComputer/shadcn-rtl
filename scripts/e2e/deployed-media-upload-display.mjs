#!/usr/bin/env node
import fs from "node:fs";
import { chromium } from "@playwright/test";

let baseUrl = (process.env.DEPLOYED_URL || process.env.NEXT_PUBLIC_DEPLOYED_APP_URL || "").replace(/\/$/, "");
const locale = process.env.MEDIA_E2E_LOCALE || "fa";
const includeAppointment = process.env.MEDIA_E2E_INCLUDE_APPOINTMENT !== "0";
const allowEmptyOriginals = process.env.MEDIA_E2E_ALLOW_EMPTY_ORIGINALS !== "0";
const shopUsername = process.env.MEDIA_E2E_SHOP_USERNAME || "shop-admin";
const shopPassword = process.env.MEDIA_E2E_SHOP_PASSWORD || "123456";
const appointmentUsername = process.env.MEDIA_E2E_APPOINTMENT_USERNAME || "fariba";
const appointmentPassword = process.env.MEDIA_E2E_APPOINTMENT_PASSWORD || "123456";

if (!baseUrl) {
  console.error(
    "DEPLOYED_URL is required, for example: $env:DEPLOYED_URL='https://example.com'; pnpm run e2e:deployed:media-display",
  );
  process.exit(1);
}

const results = [];
let browser;

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  store(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : splitSetCookieHeader(response.headers.get("set-cookie") || "");

    for (const line of setCookies) {
      const [pair, ...attributes] = line.split(";");
      const index = pair.indexOf("=");
      if (index <= 0) continue;

      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const deletesCookie = attributes.some((attribute) => /^max-age=0$/i.test(attribute.trim()));

      if (deletesCookie) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

function splitSetCookieHeader(header) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((part) => part.trim()).filter(Boolean);
}

function absoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, baseUrl).toString();
}

async function resolveCanonicalBaseUrl() {
  let current = baseUrl;
  for (let index = 0; index < 5; index += 1) {
    const response = await fetch(current, { method: "GET", redirect: "manual" });
    if (![301, 302, 307, 308].includes(response.status)) return current.replace(/\/$/, "");

    const location = response.headers.get("location");
    if (!location) return current.replace(/\/$/, "");
    current = new URL(location, current).origin;
  }

  return current.replace(/\/$/, "");
}

function normalizeSrc(src) {
  return absoluteUrl(src).replace(/\/$/, "");
}

function pngBlob() {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
  return new Blob([bytes], { type: "image/png" });
}

async function request(session, path, init = {}) {
  const headers = new Headers(init.headers || {});
  const cookieHeader = session?.jar?.header();
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  const response = await fetch(absoluteUrl(path), {
    ...init,
    headers,
    redirect: init.redirect || "follow",
  });
  session?.jar?.store(response);
  return response;
}

async function requestJson(session, path, init = {}) {
  const response = await request(session, path, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path}: expected JSON, got status=${response.status} body=${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`${path}: status=${response.status} body=${text.slice(0, 400)}`);
  }

  return json;
}

async function login(username, password) {
  const session = { jar: new CookieJar(), username };
  const csrf = await requestJson(session, "/api/auth/csrf");
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    username,
    password,
    redirect: "false",
    callbackUrl: `${baseUrl}/${locale}/dashboard`,
  });

  const response = await request(session, "/api/auth/callback/credentials?json=true", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  });

  const text = await response.text();
  const location = response.headers.get("location") || "";
  const loginRedirectSucceeded =
    [302, 303].includes(response.status) && !/CredentialsSignin|error=/i.test(location);
  const loginJsonSucceeded = response.ok && !/CredentialsSignin|error/i.test(text);

  if (!loginRedirectSucceeded && !loginJsonSucceeded) {
    throw new Error(`login failed for ${username}: status=${response.status} body=${text.slice(0, 300)}`);
  }

  const authSession = await requestJson(session, "/api/auth/session");
  if (!authSession?.user?.id) {
    throw new Error(`login did not establish a session for ${username}`);
  }

  return session;
}

async function uploadImage(session, label) {
  const form = new FormData();
  form.append("file", pngBlob(), `media-e2e-${Date.now()}-${label}.png`);

  const response = await request(session, "/api/upload", { method: "POST", body: form });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`upload ${label}: expected JSON, got status=${response.status} body=${text.slice(0, 200)}`);
  }

  if (response.status !== 201 || !json?.url || !json?.id) {
    throw new Error(`upload ${label}: expected 201 with id/url, got status=${response.status} body=${text.slice(0, 400)}`);
  }

  await expectImageResponse(`${label} upload URL`, json.url);
  return json;
}

async function patchJson(session, path, body) {
  return requestJson(session, path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function expectImageResponse(name, src) {
  const response = await fetch(absoluteUrl(src), { redirect: "follow" });
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`${name}: expected 200 image/* for ${src}, got status=${response.status} content-type=${contentType}`);
  }
}

async function retry(name, fn, attempts = 12, delayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`${name}: ${lastError?.message || lastError}`);
}

function requireRestorable(value, label) {
  if (value && String(value).trim()) return;
  if (allowEmptyOriginals) return;
  throw new Error(`${label} is empty. Refusing to mutate deployed data because the API cannot restore null image fields exactly.`);
}

function pickMediaTarget(items, imageField, label) {
  const item = allowEmptyOriginals
    ? items.find((candidate) => candidate?.id)
    : items.find((candidate) => candidate?.[imageField] && String(candidate[imageField]).trim());
  if (!item) {
    throw new Error(`No ${label} target was found.`);
  }
  return item;
}

async function expectBrowserImages(pagePath, expectedUrls, label) {
  if (!browser) browser = await launchBrowser();
  const page = await browser.newPage();
  const expected = expectedUrls.map(normalizeSrc);

  try {
    await page.goto(absoluteUrl(pagePath), { waitUntil: "domcontentloaded", timeout: 45000 });
    for (const expectedSrc of expected) {
      await page.waitForFunction(
        (src) =>
          Array.from(document.images).some((img) => {
            const current = (img.currentSrc || img.src || "").replace(/\/$/, "");
            return current === src && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
          }),
        expectedSrc,
        { timeout: 25000 },
      );
    }
  } finally {
    await page.close();
  }

  record(`${label} displays uploaded image(s)`, true, pagePath);
}

async function launchBrowser() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || findSystemChrome();
  const options = executablePath ? { executablePath } : {};
  return chromium.launch(options);
}

function findSystemChrome() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${name}${detail ? ` - ${detail}` : ""}`);
}

function skip(name, detail = "") {
  results.push({ name, ok: true, skipped: true, detail });
  console.log(`[SKIP] ${name}${detail ? ` - ${detail}` : ""}`);
}

async function runCheck(name, fn) {
  try {
    await fn();
    if (!results.some((result) => result.name === name)) record(name, true);
  } catch (error) {
    record(name, false, error?.message || String(error));
  }
}

async function cleanup(session, uploaded) {
  const failures = [];
  for (const image of uploaded.reverse()) {
    if (!image?.id) continue;
    try {
      const response = await request(session, `/api/images/${image.id}`, { method: "DELETE" });
      if (![200, 404].includes(response.status)) {
        const text = await response.text().catch(() => "");
        failures.push(`cleanup uploaded image ${image.id}: status=${response.status} ${text.slice(0, 120)}`);
      }
    } catch (error) {
      failures.push(`cleanup uploaded image ${image.id}: ${error?.message || String(error)}`);
    }
  }
  return failures;
}

async function runShopMediaFlow() {
  const session = await login(shopUsername, shopPassword);
  const uploaded = [];
  const finalizationFailures = [];
  let org;
  let product;
  let originals;

  try {
    const settings = await requestJson(session, "/api/organizations/noId/settings");
    org = settings.organization;
    if (!org?.id || !org?.slug) throw new Error("shop organization settings did not include organization id/slug");
    if (org.type !== "SHOP") throw new Error(`expected SHOP organization for ${shopUsername}, got ${org.type}`);

    requireRestorable(org.logo, "shop organization logo");
    requireRestorable(org.coverImage, "shop organization coverImage");

    const products = await requestJson(session, "/api/products?pageSize=100&isActive=true");
    product = pickMediaTarget(products.data || [], "image", "active shop product");
    originals = {
      logo: org.logo,
      coverImage: org.coverImage,
      productImage: product.image,
    };

    const logo = await uploadImage(session, "shop-logo");
    const cover = await uploadImage(session, "shop-cover");
    const productImage = await uploadImage(session, "shop-product");
    uploaded.push(logo, cover, productImage);

    await patchJson(session, `/api/organizations/${org.id}`, { logo: logo.url, coverImage: cover.url });
    await patchJson(session, `/api/products/${product.id}`, { image: productImage.url });

    await retry("shop public API reflects uploaded media", async () => {
      const data = await requestJson(null, `/api/public/organizations/${org.slug}/shop`);
      if (data.organization.logo !== logo.url) throw new Error("public shop API logo is stale");
      if (data.organization.coverImage !== cover.url) throw new Error("public shop API coverImage is stale");

      const publicProduct = data.categories.flatMap((category) => category.products).find((item) => item.id === product.id);
      if (!publicProduct) throw new Error("updated product is missing from public shop API");
      if (publicProduct.image !== productImage.url) throw new Error("public shop API product image is stale");
    });

    await retry("public product API reflects uploaded media", async () => {
      const data = await requestJson(null, `/api/public/products/${product.id}?organizationSlug=${org.slug}`);
      if (data.product.image !== productImage.url) throw new Error("public product API image is stale");
    });

    const imageList = await requestJson(session, "/api/images");
    for (const image of uploaded) {
      if (!imageList.some((item) => item.id === image.id && item.url === image.url)) {
        throw new Error(`uploaded image ${image.id} is missing from /api/images`);
      }
    }

    await expectBrowserImages(`/${locale}/shop/${org.slug}`, [logo.url, cover.url, productImage.url], "shop page");
    await expectBrowserImages(`/${locale}/shop/${org.slug}/product/${product.id}`, [productImage.url], "product detail page");
    await expectBrowserImages(`/${locale}/shop/${org.slug}/profile`, [logo.url, cover.url], "shop profile page");

    await runHomePageImageCheck(org, [cover.url]);
  } finally {
    if (org && originals) {
      await retry("restore shop organization images", () =>
        patchJson(session, `/api/organizations/${org.id}`, {
          logo: originals.logo,
          coverImage: originals.coverImage,
        }),
      ).catch((error) => finalizationFailures.push(error?.message || String(error)));
    }
    if (product && originals) {
      await retry("restore shop product image", () =>
        patchJson(session, `/api/products/${product.id}`, {
          image: originals.productImage,
        }),
      ).catch((error) => finalizationFailures.push(error?.message || String(error)));
    }
    finalizationFailures.push(...(await cleanup(session, uploaded)));
    if (finalizationFailures.length) {
      throw new Error(finalizationFailures.join("; "));
    }
  }
}

async function runHomePageImageCheck(org, expectedUrls) {
  if (!browser) browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(absoluteUrl(`/${locale}`), { waitUntil: "domcontentloaded", timeout: 45000 });
    const hasOrganizationCard = await page.getByText(org.name, { exact: false }).count().catch(() => 0);
    if (!hasOrganizationCard) {
      skip("home page media display", `organization ${org.slug} is not currently rendered on the ranked home page`);
      return;
    }
  } finally {
    await page.close();
  }
  await expectBrowserImages(`/${locale}`, expectedUrls, "home page");
}

async function runAppointmentMediaFlow() {
  const session = await login(appointmentUsername, appointmentPassword);
  const uploaded = [];
  const finalizationFailures = [];
  let org;
  let category;
  let service;
  let originals;

  try {
    const settings = await requestJson(session, "/api/organizations/noId/settings");
    org = settings.organization;
    if (!org?.id || !org?.slug) throw new Error("appointment organization settings did not include organization id/slug");
    if (org.type !== "APPOINTMENT") throw new Error(`expected APPOINTMENT organization for ${appointmentUsername}, got ${org.type}`);

    requireRestorable(org.logo, "appointment organization logo");
    requireRestorable(org.coverImage, "appointment organization coverImage");

    const categories = await requestJson(session, "/api/service-categories?pageSize=100&isActive=true");
    const services = await requestJson(session, "/api/services?pageSize=100&isActive=true");
    category = pickMediaTarget(categories.data || [], "image", "active service category");
    service = pickMediaTarget(services.data || [], "image", "active service");

    originals = {
      logo: org.logo,
      coverImage: org.coverImage,
      categoryImage: category.image,
      serviceImage: service.image,
    };

    const logo = await uploadImage(session, "appointment-logo");
    const cover = await uploadImage(session, "appointment-cover");
    const categoryImage = await uploadImage(session, "appointment-category");
    const serviceImage = await uploadImage(session, "appointment-service");
    uploaded.push(logo, cover, categoryImage, serviceImage);

    await patchJson(session, `/api/organizations/${org.id}`, { logo: logo.url, coverImage: cover.url });
    await patchJson(session, `/api/service-categories/${category.id}`, { image: categoryImage.url });
    await patchJson(session, `/api/services/${service.id}`, { image: serviceImage.url });

    await retry("appointment public API reflects uploaded media", async () => {
      const data = await requestJson(null, `/api/public/organizations/${org.slug}`);
      if (data.organization.logo !== logo.url) throw new Error("public appointment API logo is stale");
      if (data.organization.coverImage !== cover.url) throw new Error("public appointment API coverImage is stale");

      const publicCategory = data.categories.find((item) => item.id === category.id);
      if (!publicCategory) throw new Error("updated service category is missing from public appointment API");
      if (publicCategory.image !== categoryImage.url) throw new Error("public appointment API category image is stale");
    });

    await retry("appointment services API reflects uploaded media", async () => {
      const data = await requestJson(null, `/api/public/organizations/${org.slug}/services`);
      const publicService = data.services.find((item) => item.id === service.id);
      if (!publicService) throw new Error("updated service is missing from public appointment services API");
      if (publicService.image !== serviceImage.url) throw new Error("public appointment services API image is stale");
    });

    await expectBrowserImages(`/${locale}/appointment/${org.slug}`, [logo.url, categoryImage.url], "appointment page");
    await expectBrowserImages(`/${locale}/appointment/${org.slug}/services`, [serviceImage.url], "appointment services page");
  } finally {
    if (org && originals) {
      await retry("restore appointment organization images", () =>
        patchJson(session, `/api/organizations/${org.id}`, {
          logo: originals.logo,
          coverImage: originals.coverImage,
        }),
      ).catch((error) => finalizationFailures.push(error?.message || String(error)));
    }
    if (category && originals) {
      await retry("restore service category image", () =>
        patchJson(session, `/api/service-categories/${category.id}`, {
          image: originals.categoryImage,
        }),
      ).catch((error) => finalizationFailures.push(error?.message || String(error)));
    }
    if (service && originals) {
      await retry("restore service image", () =>
        patchJson(session, `/api/services/${service.id}`, {
          image: originals.serviceImage,
        }),
      ).catch((error) => finalizationFailures.push(error?.message || String(error)));
    }
    finalizationFailures.push(...(await cleanup(session, uploaded)));
    if (finalizationFailures.length) {
      throw new Error(finalizationFailures.join("; "));
    }
  }
}

async function runQrMediaChecks() {
  await retry("public QR image response", async () => {
    const response = await fetch(absoluteUrl(`/api/qrcode?url=${encodeURIComponent(baseUrl)}`));
    const contentType = response.headers.get("content-type") || "";
    if (response.status !== 200 || !contentType.toLowerCase().startsWith("image/png")) {
      throw new Error(`expected QR image/png 200, got status=${response.status} content-type=${contentType}`);
    }
  });
}

baseUrl = await resolveCanonicalBaseUrl();
console.log(`Running deployed media upload/display suite against ${baseUrl}`);

await runCheck("public QR media endpoint returns image/png", runQrMediaChecks);
await runCheck("shop media upload, cache refresh, public display, restore, cleanup", runShopMediaFlow);

if (includeAppointment) {
  await runCheck("appointment media upload, cache refresh, public display, restore, cleanup", runAppointmentMediaFlow);
} else {
  skip("appointment media upload/display", "MEDIA_E2E_INCLUDE_APPOINTMENT=0");
}

if (browser) await browser.close();

console.log("\nDeployed media upload/display summary:");
console.table(results);

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) process.exit(1);
