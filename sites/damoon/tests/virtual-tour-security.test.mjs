import assert from "node:assert/strict";
import { test } from "node:test";
import { DAMOON_VTOUR_ALLOWED_ORIGINS, allowedVirtualTourUrl, publishedDamoonTours, tourViewerMarkup } from "../virtual-tour.js";

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
  assert.equal(tour.representation, "CONCEPTUAL_PREVIEW");
  const markup = tourViewerMarkup(tour, "تور مجازی · test-damoon-hotel", undefined, "fa");
  assert.match(markup, /data-tour-representation="conceptual"/);
  assert.match(markup, /src="https:\/\/andarama\.bazarbaaz\.ir\/t\/test-damoon-hotel#s=n2ohIYwAprMY3uMSoejp3&amp;y=-76\.6&amp;p=3\.1&amp;f=111\.3"/);
  assert.match(markup, /allowfullscreen/);
  assert.match(markup, /بازکردن مستقیم تور/);
});

test("room pages resolve only explicitly associated and approved tenant scenes", () => {
  const origins = ["https://tour.example.test"];
  const catalog = [
    { id: "vip-preview", tenantId: "damoon", url: "https://tour.example.test/t/hotel#s=vip-scene", roomSlugs: ["vip-suite", "vip"], approved: true, representation: "CONCEPTUAL_PREVIEW" },
    { id: "standard-room", tenantId: "damoon", url: "https://tour.example.test/t/hotel#s=standard-scene", roomSlugs: ["standard-room", "single-room", "single"], approved: true },
    { id: "studio-suite", tenantId: "damoon", url: "https://tour.example.test/t/hotel#s=studio-scene", roomSlugs: ["studio-suite", "fourth-floor-suite", "suite-3-bed", "bogus"], approved: true },
    { id: "pending", tenantId: "damoon", url: "https://tour.example.test/t/hotel#s=pending-scene", roomSlugs: ["vip-suite"], approved: false },
    { id: "different-hotel", tenantId: "other", url: "https://tour.example.test/t/other#s=other-scene", roomSlugs: ["vip-suite"], approved: true },
    { id: "untrusted", tenantId: "damoon", url: "https://evil.test/t/hotel#s=vip-scene", roomSlugs: ["vip-suite"], approved: true },
  ];
  const tours = publishedDamoonTours(catalog, origins);
  const idsFor = (slug) => tours.filter((tour) => tour.roomSlugs.includes(slug)).map(({ id }) => id);
  assert.deepEqual(idsFor("vip-suite"), ["vip-preview"]);
  assert.deepEqual(idsFor("standard-room"), ["standard-room"]);
  assert.deepEqual(idsFor("studio-suite"), ["studio-suite"]);
  assert.deepEqual(idsFor("vip"), ["vip-preview"]);
  assert.deepEqual(idsFor("single-room"), ["standard-room"]);
  assert.deepEqual(idsFor("single"), ["standard-room"]);
  assert.deepEqual(idsFor("fourth-floor-suite"), ["studio-suite"]);
  assert.deepEqual(idsFor("suite-3-bed"), ["studio-suite"]);
  assert.deepEqual(idsFor("bogus"), []);
  const [vip] = tours;
  assert.equal(vip.url, "https://tour.example.test/t/hotel#s=vip-scene");
  assert.equal(vip.representation, "CONCEPTUAL_PREVIEW");
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
