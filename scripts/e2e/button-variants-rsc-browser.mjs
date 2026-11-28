import assert from "node:assert/strict";

const baseUrl = process.env.BUTTON_VARIANTS_BASE_URL ?? "http://127.0.0.1:3000";
const { chromium } = await import(process.env.BUTTON_VARIANTS_PLAYWRIGHT_ENTRY ?? "playwright");
const browser = await chromium.launch({ headless: true });
const failures = [];
const page = await browser.newPage();
page.on("pageerror", (error) => failures.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && /buttonVariants|server component|server-rendered/i.test(message.text())) {
    failures.push(message.text());
  }
});

try {
  for (const [route, heading, marker, navigationLabel] of [
    ["/fa/bb-rsc-shop-synthetic/shop/category/rsc-products?page=1", "Synthetic products", "[SYNTHETIC] Pagination product 1", "Product category pagination"],
    ["/fa/bb-rsc-appointment-synthetic/appointment/services/category/rsc-services?page=1", "Synthetic services", "[SYNTHETIC] Pagination service 1", "Service category pagination"],
  ]) {
    const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${route} must render HTTP 200`);
    const body = await page.locator("body").innerText();
    assert.ok(body.includes(heading), `${route} must render the expected category`);
    assert.ok(body.includes(marker), `${route} must render its synthetic record`);
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl", `${route} must retain right-to-left layout`);
    const navigation = page.getByRole("navigation", { name: navigationLabel });
    assert.ok(await navigation.count(), `${route} must render the pagination controls that call buttonVariants`);
    const styledLinks = navigation.locator("a[class*='inline-flex']");
    assert.ok(await styledLinks.count(), `${route} must preserve shared button styling on pagination links`);
    assert.match(await styledLinks.first().getAttribute("class") ?? "", /bg-primary|border-border/);
    assert.ok(await navigation.locator("a[rel='next']").count(), `${route} must preserve the accessible next-page link`);
  }
  assert.deepEqual(failures, [], "production browser routes must not emit client or RSC errors");
  process.stdout.write("Production HTTP/browser checks passed for shop and appointment category pagination.\n");
} finally {
  await browser.close();
}
