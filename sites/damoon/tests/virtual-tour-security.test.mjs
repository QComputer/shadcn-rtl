import assert from "node:assert/strict";
import { test } from "node:test";
import { DAMOON_VTOUR_ALLOWED_ORIGINS, DAMOON_VTOUR_CATALOG, allowedVirtualTourUrl, publishedDamoonTours, tourViewerMarkup } from "../virtual-tour.js";

test("virtual tour accepts only HTTPS URLs from the exact configured origin allowlist", () => {
  const allowlist = ["https://tour.example.test"];
  assert.equal(allowedVirtualTourUrl("https://tour.example.test/embed/room", allowlist), "https://tour.example.test/embed/room");
  assert.equal(allowedVirtualTourUrl("https://sub.tour.example.test/embed", allowlist), "");
  assert.equal(allowedVirtualTourUrl("http://tour.example.test/embed", allowlist), "");
  assert.equal(allowedVirtualTourUrl("javascript:alert(1)", allowlist), "");
  assert.equal(allowedVirtualTourUrl("data:text/html,hello", allowlist), "");
  assert.equal(allowedVirtualTourUrl("vbscript:msgbox(1)", allowlist), "");
  assert.equal(allowedVirtualTourUrl("https://user:pass@tour.example.test/embed", allowlist), "");
});

test("Damoon does not render caller-controlled virtual tour URLs before an origin is approved", () => {
  assert.equal(allowedVirtualTourUrl("https://tour.example.test/embed"), "");
  assert.equal(allowedVirtualTourUrl("javascript:alert(1)"), "");
});

test("catalog publishes only approved tenant tours from trusted HTTPS origins and keeps room associations", () => {
  const origins = ["https://tour.example.test"];
  const catalog = [
    { id: "lobby", tenantId: "damoon", url: "https://tour.example.test/embed/lobby", roomSlugs: ["suite", "bogus"], approved: true },
    { id: "other-tenant", tenantId: "other", url: "https://tour.example.test/embed/other", roomSlugs: ["double"], approved: true },
    { id: "unapproved", tenantId: "damoon", url: "https://tour.example.test/embed/pending", approved: false },
    { id: "untrusted", tenantId: "damoon", url: "https://evil.test/embed", approved: true },
  ];
  assert.deepEqual(publishedDamoonTours(catalog, origins), [{ id: "lobby", url: "https://tour.example.test/embed/lobby", roomSlugs: ["suite"] }]);
  assert.match(tourViewerMarkup({ url: "https://tour.example.test/embed/lobby" }, "Suite tour", origins), /loading="lazy"[^>]*allowfullscreen/);
  assert.equal(tourViewerMarkup({ url: "https://evil.test/embed" }, "Bad tour", origins), "");
});

test("owner-supplied Damoon tour preserves its initial scene and is labeled as conceptual", () => {
  assert.deepEqual(DAMOON_VTOUR_ALLOWED_ORIGINS, ["https://andarama.bazarbaaz.ir"]);
  const [tour] = publishedDamoonTours();
  assert.equal(tour.id, "test-damoon-hotel");
  assert.equal(tour.url, "https://andarama.bazarbaaz.ir/t/test-damoon-hotel#s=n2ohIYwAprMY3uMSoejp3&y=-76.6&p=3.1&f=111.3");
  assert.deepEqual(tour.roomSlugs, [], "no room scene has been individually verified");
  assert.equal(DAMOON_VTOUR_CATALOG[0].representation, "CONCEPTUAL_PREVIEW");
  const markup = tourViewerMarkup(DAMOON_VTOUR_CATALOG[0], "تور مجازی · test-damoon-hotel", undefined, "fa");
  assert.match(markup, /data-tour-representation="conceptual"/);
  assert.match(markup, /src="https:\/\/andarama\.bazarbaaz\.ir\/t\/test-damoon-hotel#s=n2ohIYwAprMY3uMSoejp3&amp;y=-76\.6&amp;p=3\.1&amp;f=111\.3"/);
  assert.match(markup, /allowfullscreen/);
  assert.match(markup, /بازکردن مستقیم تور/);
});

test("homepage and concept gallery link visitors to the tour without calling concept imagery real", async () => {
  const fs = await import("node:fs/promises");
  const app = await fs.readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /home-intro__copy[\s\S]*?routeHref\("\/virtual-tour"\)/);
  assert.match(app, /galleryGrid\(\)[\s\S]*?routeHref\("\/virtual-tour"\)/);
  assert.match(app, /not presented as verified photography of Damoon Hotel/);
});

test("Damoon page and asset policies allow framing only from the approved Andarama origin", async () => {
  const fs = await import("node:fs/promises");
  const files = ["../../../proxy.ts", "../../../next.config.ts", "../server.mjs"];
  for (const file of files) {
    const source = await fs.readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /frame-src https:\/\/andarama\.bazarbaaz\.ir/);
    assert.doesNotMatch(source, /frame-src '\*'|frame-src https:\/\/andarama\.bazarbaaz\.ir\s+https:\/\//);
  }
});
