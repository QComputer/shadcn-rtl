#!/usr/bin/env node
// Deployed B2B public surface smoke — HTTP-only, no Playwright dependency.
// Fails on: missing B2B pages, marketplace-first positioning, broken conversion
// paths, or leaked secrets/localhost/socket.io references on public HTML.

const BASE = process.env.DEPLOYED_URL || "https://www.bazar-baz.ir";

const PAGES = [
  "/",
  "/fa",
  "/fa/demo",
  "/fa/features",
  "/fa/dashboard-showcase",
  "/fa/request-demo",
  "/fa/contact",
  "/fa/pricing",
  "/fa/trust",
  "/fa/privacy",
  "/fa/terms",
];

const REQUIRED_COPY = [
  "بازارباز",
  "کسب‌وکار",
  "درخواست دمو",
  "داشبورد",
  "باشگاه مشتریان",
  "پیامک",
  "اعلان",
  "نوبت‌دهی",
  "سفارش",
  "نمونه نمایشی",
];

// Marketplace-first wording that should NOT dominate public B2B pages.
const MARKETPLACE_BAD = [
  "بازارچه عمومی",
  "همه فروشگاه‌ها",
  "جستجوی فروشگاه‌ها",
  "تبلیغات کسب‌وکارها",
  "شبکه اجتماعی عمومی",
];

// Secrets / leak patterns that must never appear in public responses.
const LEAK_PATTERNS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "AUTH_SECRET",
  "SMS_IR_API_KEY",
  "VAPID_PRIVATE",
  "PRIVATE_KEY",
  "api.sms.ir/v1/send/bulk",
  "localhost:4001",
  "/socket.io/?EIO=",
  "ERR_CONNECTION_REFUSED",
];

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchText(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "b2b-public-smoke/1.0" },
    });
    const body = res.status === 200 ? await res.text() : "";
    return { status: res.status, body };
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500));
      return fetchText(url, attempt + 1);
    }
    return { status: 0, body: "", error: String(err) };
  }
}

async function main() {
  console.log(`Deployed B2B public surface smoke — ${BASE}\n`);

  const bodies = {};
  for (const path of PAGES) {
    const url = `${BASE}${path}`;
    const { status, body, error } = await fetchText(url);
    bodies[path] = body;
    // 200 OK; 3xx locale redirect (e.g. / -> /fa) is acceptable for public smoke.
    const ok = status === 200 || (status >= 301 && status <= 308);
    record(`page ${path} responds (${status})`, ok, error || "");
  }

  const home = bodies["/fa"] || bodies["/"] || "";
  const demo = bodies["/fa/demo"] || "";
  const features = bodies["/fa/features"] || "";
  const pricing = bodies["/fa/pricing"] || "";
  const requestDemo = bodies["/fa/request-demo"] || "";

  const combinedPublic = [home, demo, features, pricing, requestDemo, bodies["/fa/dashboard-showcase"] || ""]
    .join(" ");

  for (const word of REQUIRED_COPY) {
    record(`B2B copy present: ${word}`, combinedPublic.includes(word));
  }

  for (const bad of MARKETPLACE_BAD) {
    const found = combinedPublic.includes(bad);
    record(`avoids marketplace-first wording: ${bad}`, !found, found ? "found" : "");
  }

  // Conversion link presence on homepage/demo
  for (const link of ["/fa/request-demo", "/fa/contact", "/fa/pricing", "/fa/features", "/fa/dashboard-showcase", "/fa/demo"]) {
    record(`conversion link present: ${link}`, home.includes(link) || demo.includes(link) || requestDemo.includes(link) || pricing.includes(link));
  }

  // Trust/legal page copy
  record("privacy includes disclaimer copy", (bodies["/fa/privacy"] || "").includes("مشاور حقوقی") || (bodies["/fa/privacy"] || "").includes("نمونه اولیه") || (bodies["/fa/privacy"] || "").includes("اطلاع‌رسانی"));
  record("terms includes disclaimer copy", (bodies["/fa/terms"] || "").includes("مشاور حقوقی") || (bodies["/fa/terms"] || "").includes("پیش‌نویس"));
  record("trust includes data ownership copy", (bodies["/fa/trust"] || "").includes("مالکیت") || (bodies["/fa/trust"] || "").includes("داده"));

  // Secret/leak scan across all fetched bodies
  const allBody = Object.values(bodies).join(" ");
  for (const pattern of LEAK_PATTERNS) {
    record(`no leak: ${pattern}`, !allBody.includes(pattern));
  }

  // Discovery restriction: /fa/shops should not be a public marketplace listing
  const shopsRes = await fetchText(`${BASE}/fa/shops`);
  if (shopsRes.status === 200 && shopsRes.body.includes("بازارچه")) {
    record("marketplace discovery page avoided", false, "public /fa/shops marketplace page found");
  } else {
    record("marketplace discovery page avoided", true, `status=${shopsRes.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nDeployed B2B public surface smoke: ${failed.length === 0 ? "PASSED" : `FAILED (${failed.length})`}`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Smoke script error:", err);
  process.exit(1);
});
