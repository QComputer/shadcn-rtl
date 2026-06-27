#!/usr/bin/env node

const configuredBaseUrl =
  process.env.DEPLOYED_URL ||
  process.env.NEXT_PUBLIC_DEPLOYED_APP_URL ||
  "https://bazar-baz.ir";
const baseUrl = configuredBaseUrl.replace(/\/$/, "");
const baseOrigin = new URL(baseUrl).origin;
const allowEmpty = process.env.DEPLOYED_SLUG_SEO_ALLOW_EMPTY === "1";
const maxPerKind = Number(process.env.DEPLOYED_SLUG_SEO_MAX_PER_KIND || 2);
const results = [];

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
      "user-agent": "bazar-baz-deployed-slug-seo/1.0",
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
  const parts = pathFromUrl(url).split("/").filter(Boolean);
  const [locale, section, orgSlug, next, maybeId, finalId] = parts;

  if (!["fa", "en", "ar"].includes(locale)) return null;
  if (section === "shop" && next === "category" && maybeId) {
    return { kind: "shop category", locale, orgSlug, segment: maybeId, path: pathFromUrl(url), url };
  }
  if (section === "shop" && next === "product" && maybeId) {
    return { kind: "product detail", locale, orgSlug, segment: maybeId, path: pathFromUrl(url), url };
  }
  if (section === "appointment" && next === "services" && maybeId === "category" && finalId) {
    return { kind: "service category", locale, orgSlug, segment: finalId, path: pathFromUrl(url), url };
  }
  if (section === "appointment" && next === "services" && maybeId && maybeId !== "category") {
    return { kind: "service detail", locale, orgSlug, segment: maybeId, path: pathFromUrl(url), url };
  }

  return null;
}

function sampleByKind(entries, kind) {
  return entries.filter((entry) => entry.kind === kind).slice(0, maxPerKind);
}

function extractCanonical(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ||
    "";
}

function hasJsonLd(html) {
  return /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html);
}

function extractOgImage(html) {
  return html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
    "";
}

async function verifyPage(entry) {
  const response = await request(entry.path);
  record(`${entry.kind} slug URL is reachable`, response.status >= 200 && response.status < 400, `${entry.path} status=${response.status}`);
  if (!(response.status >= 200 && response.status < 400)) return;

  const html = await response.text();
  const canonical = extractCanonical(html);
  const ogImage = extractOgImage(html);
  const expected = absoluteUrl(entry.path);

  record(`${entry.kind} has canonical`, canonical === expected, canonical || "missing canonical");
  record(`${entry.kind} has JSON-LD`, hasJsonLd(html), entry.path);
  record(`${entry.kind} has og:image`, Boolean(ogImage), ogImage || "missing og:image");
}

async function verifyDetailRedirect(entry) {
  const apiPath =
    entry.kind === "product detail"
      ? `/api/public/products/${encodeURIComponent(entry.segment)}?organizationSlug=${encodeURIComponent(entry.orgSlug)}`
      : `/api/public/organizations/${encodeURIComponent(entry.orgSlug)}/services/${encodeURIComponent(entry.segment)}`;
  const apiResponse = await request(apiPath, {
    headers: { accept: "application/json" },
  });

  if (apiResponse.status !== 200) {
    record(`${entry.kind} API resolves slug`, false, `${apiPath} status=${apiResponse.status}`);
    return;
  }

  const payload = await apiResponse.json();
  const item = entry.kind === "product detail" ? payload.product : payload.service;
  record(`${entry.kind} API returns id and slug`, Boolean(item?.id && item?.slug), `id=${item?.id || "missing"} slug=${item?.slug || "missing"}`);
  if (!item?.id || !item?.slug || item.id === item.slug) return;

  const idPath =
    entry.kind === "product detail"
      ? `/${entry.locale}/shop/${entry.orgSlug}/product/${item.id}`
      : `/${entry.locale}/appointment/${entry.orgSlug}/services/${item.id}`;
  const redirectResponse = await request(idPath, { redirect: "manual" });
  const location = redirectResponse.headers.get("location") || "";
  const expected = entry.path;
  record(
    `${entry.kind} id URL redirects to slug URL`,
    [301, 302, 303, 307, 308].includes(redirectResponse.status) && absoluteUrl(location).endsWith(expected),
    `${idPath} status=${redirectResponse.status} location=${location || "missing"}`,
  );
}

async function main() {
  const robots = await request("/robots.txt");
  const robotsText = await robots.text();
  record("robots.txt is reachable", robots.status === 200, `status=${robots.status}`);
  const robotsSitemapUrl = robotsText.match(/sitemap:\s*(https?:\/\/\S+\/sitemap\.xml)/i)?.[1] || "";
  record("robots.txt points to sitemap", Boolean(robotsSitemapUrl), robotsSitemapUrl || "missing sitemap directive");
  record(
    "robots.txt sitemap uses configured base URL",
    Boolean(robotsSitemapUrl) && new URL(robotsSitemapUrl).origin === baseOrigin,
    robotsSitemapUrl || "missing sitemap directive",
  );

  const sitemap = await request("/sitemap.xml");
  const sitemapText = await sitemap.text();
  record("sitemap.xml is reachable", sitemap.status === 200, `status=${sitemap.status}`);

  const urls = parseSitemapUrls(sitemapText);
  record("sitemap has URL entries", urls.length > 0, `${urls.length} URLs`);
  const offOriginUrls = urls.filter((url) => new URL(url).origin !== baseOrigin);
  record(
    "sitemap URLs use configured base URL",
    offOriginUrls.length === 0,
    offOriginUrls.slice(0, 3).join(", ") || baseOrigin,
  );

  const entries = urls.map(classifyUrl).filter(Boolean);
  const slugEntries = entries.filter((entry) => !isIdLike(entry.segment));
  const kinds = ["shop category", "service category", "product detail", "service detail"];

  for (const kind of kinds) {
    const matches = sampleByKind(slugEntries, kind);
    const ok = allowEmpty || matches.length > 0;
    record(`sitemap has slug-like ${kind} URL`, ok, matches.map((entry) => entry.path).join(", ") || "none");
    for (const entry of matches) {
      await verifyPage(entry);
      if (kind === "product detail" || kind === "service detail") {
        await verifyDetailRedirect(entry);
      }
    }
  }

  console.table(results.map(({ name, ok, detail }) => ({ name, ok, detail })));
  if (results.some((result) => !result.ok)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
