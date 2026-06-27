#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const configuredBaseUrl =
  process.env.DEPLOYED_URL ||
  process.env.NEXT_PUBLIC_DEPLOYED_APP_URL ||
  "https://bazar-baz.ir";
const baseUrl = configuredBaseUrl.replace(/\/$/, "");
const baseOrigin = new URL(baseUrl).origin;
const allowEmpty = process.env.DEPLOYED_SOCIAL_PREVIEW_ALLOW_EMPTY === "1";
const requireCategorySamples = process.env.DEPLOYED_SOCIAL_PREVIEW_REQUIRE_CATEGORY === "1";
const maxPerKind = Number(process.env.DEPLOYED_SOCIAL_PREVIEW_MAX_PER_KIND || 2);
const scanLimitPerKind = Number(process.env.DEPLOYED_SOCIAL_PREVIEW_SCAN_LIMIT_PER_KIND || 24);
const captureDir = process.env.DEPLOYED_SOCIAL_PREVIEW_CAPTURE_DIR || "test-results/deployed-social-preview";
const results = [];
const captures = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
}

function absoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, baseUrl).toString();
}

async function request(pathOrUrl, init = {}) {
  return fetch(absoluteUrl(pathOrUrl), {
    redirect: init.redirect || "follow",
    ...init,
    headers: {
      "user-agent": "bazar-baz-deployed-social-preview/1.0",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(init.headers || {}),
    },
  });
}

function parseSitemapUrls(xml) {
  return Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/gims))
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function pathFromUrl(url) {
  return new URL(url).pathname;
}

function isIdLike(segment) {
  return /^c[a-z0-9]{20,}$/i.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment);
}

function classifyUrl(url) {
  const pathname = pathFromUrl(url);
  const parts = pathname.split("/").filter(Boolean);
  const [locale, section, orgSlug, next, maybeId, finalId] = parts;

  if (!["fa", "en", "ar"].includes(locale)) return null;
  if (section === "shop" && orgSlug && !next) {
    return { kind: "shop organization", segment: orgSlug, path: pathname, url };
  }
  if (section === "appointment" && orgSlug && !next) {
    return { kind: "appointment organization", segment: orgSlug, path: pathname, url };
  }
  if (section === "shop" && next === "category" && maybeId && !isIdLike(maybeId)) {
    return { kind: "shop category", segment: maybeId, path: pathname, url };
  }
  if (section === "shop" && next === "product" && maybeId && !isIdLike(maybeId)) {
    return { kind: "product detail", segment: maybeId, path: pathname, url };
  }
  if (section === "appointment" && next === "services" && maybeId === "category" && finalId && !isIdLike(finalId)) {
    return { kind: "service category", segment: finalId, path: pathname, url };
  }
  if (section === "appointment" && next === "services" && maybeId && maybeId !== "category" && !isIdLike(maybeId)) {
    return { kind: "service detail", segment: maybeId, path: pathname, url };
  }

  return null;
}

function sampleByKind(entries, kind) {
  return entries.filter((entry) => entry.kind === kind).slice(0, scanLimitPerKind);
}

function extractOgImage(html) {
  return html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
    "";
}

function isGeneratedOgImage(url) {
  const parsed = new URL(url);
  return parsed.origin === baseOrigin && parsed.pathname === "/og-image";
}

function extensionFromContentType(contentType) {
  if (/png/i.test(contentType)) return "png";
  if (/jpe?g/i.test(contentType)) return "jpg";
  if (/webp/i.test(contentType)) return "webp";
  if (/gif/i.test(contentType)) return "gif";
  return "bin";
}

function safeName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "capture";
}

async function captureImage({ label, url }) {
  const response = await request(url, {
    headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8" },
  });
  const contentType = response.headers.get("content-type") || "";
  const ok = response.status >= 200 && response.status < 400 && /^image\//i.test(contentType);
  record(`${label} image resolves`, ok, `${url} status=${response.status} type=${contentType || "missing"}`);
  if (!ok) return null;

  const bytes = Buffer.from(await response.arrayBuffer());
  record(`${label} image has bytes`, bytes.length > 1000, `${bytes.length} bytes`);
  if (bytes.length <= 1000) return null;

  fs.mkdirSync(captureDir, { recursive: true });
  const file = path.join(captureDir, `${safeName(label)}.${extensionFromContentType(contentType)}`);
  fs.writeFileSync(file, bytes);
  captures.push({ label, url, file, bytes: bytes.length, contentType });
  return { label, url, file, bytes: bytes.length, contentType };
}

async function verifyPage(entry) {
  const response = await request(entry.path);
  if (!(response.status >= 200 && response.status < 400)) {
    record(`${entry.kind} stale sitemap candidate skipped`, true, `${entry.path} status=${response.status}`);
    return null;
  }

  record(`${entry.kind} page is reachable`, true, `${entry.path} status=${response.status}`);

  const html = await response.text();
  const ogImage = extractOgImage(html);
  record(`${entry.kind} page has og:image`, Boolean(ogImage), ogImage || "missing og:image");
  if (!ogImage) return null;

  const imageUrl = absoluteUrl(ogImage);
  const capture = await captureImage({ label: `${entry.kind}-${entry.segment}`, url: imageUrl });
  return capture ? { ...entry, ogImage: imageUrl, capture } : { ...entry, ogImage: imageUrl };
}

async function main() {
  const generatedUrl = absoluteUrl(
    "/og-image?kind=product&locale=fa&title=%D9%BE%DB%8C%D8%B4%E2%80%8C%D9%86%D9%85%D8%A7%DB%8C%D8%B4%20%D8%A7%D8%AC%D8%AA%D9%85%D8%A7%D8%B9%DB%8C&subtitle=%DA%A9%D8%A7%D8%B1%D8%AA%20%D8%AA%D9%88%D9%84%DB%8C%D8%AF%D8%B4%D8%AF%D9%87%20%D8%A8%D8%B1%D8%A7%DB%8C%20%D8%B3%D8%A6%D9%88&organization=%D8%A8%D8%A7%D8%B2%D8%A7%D8%B1%D8%A8%D8%A7%D8%B2",
  );
  const generatedCapture = await captureImage({ label: "generated-og-card", url: generatedUrl });
  record("deployed generated OG card is captured", Boolean(generatedCapture), generatedCapture?.file || "missing capture");

  const sitemap = await request("/sitemap.xml");
  const sitemapText = await sitemap.text();
  record("sitemap.xml is reachable", sitemap.status === 200, `status=${sitemap.status}`);

  const urls = parseSitemapUrls(sitemapText);
  record("sitemap has URL entries", urls.length > 0, `${urls.length} URLs`);
  const entries = urls.map(classifyUrl).filter(Boolean);
  const kindConfigs = [
    { kind: "shop organization", requireReachable: true },
    { kind: "appointment organization", requireReachable: true },
    { kind: "shop category", requireReachable: requireCategorySamples },
    { kind: "service category", requireReachable: requireCategorySamples },
    { kind: "product detail", requireReachable: true },
    { kind: "service detail", requireReachable: true },
  ];

  const verified = [];
  for (const { kind, requireReachable } of kindConfigs) {
    const matches = sampleByKind(entries, kind);
    const ok = allowEmpty || matches.length > 0;
    const sampleDetail = matches.slice(0, 4).map((entry) => entry.path).join(", ");
    record(`sitemap has ${kind} candidate`, ok, sampleDetail ? `${sampleDetail}${matches.length > 4 ? ` ... (${matches.length} scanned)` : ""}` : "none");
    let reachableForKind = 0;
    for (const entry of matches) {
      if (reachableForKind >= maxPerKind) break;
      const page = await verifyPage(entry);
      verified.push(page);
      if (page?.capture) reachableForKind += 1;
    }
    record(
      `${kind} has reachable social preview sample`,
      allowEmpty || reachableForKind > 0 || !requireReachable,
      `${reachableForKind}/${matches.length} captured`,
    );
  }

  const successfulPages = verified.filter(Boolean);
  const uploadedCandidate = successfulPages.find((entry) => entry.capture && entry.ogImage && !isGeneratedOgImage(entry.ogImage));
  const generatedPageCandidate = successfulPages.find((entry) => entry.ogImage && isGeneratedOgImage(entry.ogImage));

  record("at least one sampled page social image resolved", allowEmpty || successfulPages.length > 0, `${successfulPages.length} pages`);
  record(
    "at least one uploaded-image social preview candidate captured",
    allowEmpty || Boolean(uploadedCandidate?.capture),
    uploadedCandidate?.capture?.file || "none",
  );
  record(
    "generated social preview route is available to deployed crawlers",
    Boolean(generatedCapture),
    generatedCapture?.file || "missing generated capture",
  );
  record(
    "sampled pages may use generated social preview fallback",
    Boolean(generatedPageCandidate) || Boolean(generatedCapture),
    generatedPageCandidate?.ogImage || generatedUrl,
  );

  fs.mkdirSync(captureDir, { recursive: true });
  const manifestPath = path.join(captureDir, "manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ baseUrl, createdAt: new Date().toISOString(), captures, pages: successfulPages }, null, 2),
  );
  console.log(`Capture manifest: ${manifestPath}`);

  console.table(results.map(({ name, ok, detail }) => ({ name, ok, detail })));
  if (results.some((result) => !result.ok)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
