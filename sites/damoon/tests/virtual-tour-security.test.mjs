import assert from "node:assert/strict";
import { test } from "node:test";
import { DAMOON_VTOUR_ALLOWED_ORIGINS, DAMOON_VTOUR_CATALOG, DAMOON_VTOUR_COPY, allowedVirtualTourUrl, publishedDamoonTours, tourViewerMarkup } from "../virtual-tour.js";

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

test("owner-provided URLs are published only when the URL and panorama identity were verified", () => {
  assert.deepEqual(DAMOON_VTOUR_ALLOWED_ORIGINS, ["https://andarama.bazarbaaz.ir"]);
  const sourceRecords = [
    { id: "vip-01", url: "https://andarama.bazarbaaz.ir/t/vip-01", status: "verified", identity: "VIP suite panorama" },
    { id: "vip-02", url: "https://andarama.bazarbaaz.ir/t/vip-02", status: "unavailable", identity: "repeated unavailable response" },
    { id: "vip-03", url: "https://andarama.bazarbaaz.ir/t/vip-03", status: "mismatch", identity: "page title says VIP-02" },
    { id: "lobby", url: "https://andarama.bazarbaaz.ir/t/lobby", status: "verified", identity: "hotel lobby and reception" },
    { id: "303", url: "https://andarama.bazarbaaz.ir/t/303", status: "verified", identity: "Room 303 tour" },
    { id: "restaurant", url: "https://andarama.bazarbaaz.ir/t/restaurant", status: "withheld", identity: "dining panorama; exact hotel use not owner-confirmed" },
  ];
  const published = publishedDamoonTours();
  assert.deepEqual(DAMOON_VTOUR_CATALOG.map(({ id, url }) => ({ id, url })), [
    sourceRecords[0], sourceRecords[3], sourceRecords[4],
  ].map(({ id, url }) => ({ id, url })));
  assert.deepEqual(published.map(({ id }) => id), ["vip-01", "lobby", "303"]);
  for (const record of sourceRecords) {
    if (record.status === "verified") assert.ok(published.some(tour => tour.url === record.url), `${record.id}: ${record.identity}`);
    else assert.ok(!published.some(tour => tour.url === record.url), `${record.id}: withheld (${record.identity})`);
  }
  assert.deepEqual(published.find(({ id }) => id === "vip-01").roomSlugs, ["vip-suite", "vip"]);
  assert.deepEqual(published.find(({ id }) => id === "303").roomSlugs, [], "Room 303 is not associated with every standard room");
  for (const locale of ["fa", "en", "ar"]) {
    for (const key of ["galleryTitle", "openEmbed", "openDirect", "fullscreen", "close", "failed", "slow"]) {
      assert.ok(DAMOON_VTOUR_COPY[locale][key], `${locale} has ${key} copy`);
    }
  }
  const markup = tourViewerMarkup(published.find(({ id }) => id === "vip-01"), "سوئیت VIP", undefined, "fa");
  assert.match(markup, /data-tour-representation="verified"/);
  assert.match(markup, /src="https:\/\/andarama\.bazarbaaz\.ir\/t\/vip-01"/);
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /allowfullscreen/);
  assert.match(markup, /data-vtour-fullscreen/);
  assert.match(markup, /role="status" aria-live="polite"/);
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
  assert.equal(vip.representation, "CONCEPTUAL_PREVIEW", "the test fixture keeps its explicit conceptual-image label");
});

test("homepage links to the lobby tour while conceptual gallery imagery stays labeled", async () => {
  const fs = await import("node:fs/promises");
  const app = await fs.readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /routeHref\("\/virtual-tour"\)\}#tour-lobby/);
  assert.match(app, /data-vtour-open/);
  assert.match(app, /player\.replaceChildren\(\)/, "the previous iframe is removed before opening another tour");
  assert.match(app, /requestFullscreen/);
  assert.match(app, /copy\.slow/);
  assert.match(app, /copy\.failed/);
  assert.match(app, /window\.location\.hash === "#tour-lobby"/);
  assert.match(app, /tour\.roomSlugs\.includes\("vip-suite"\)/);
  assert.doesNotMatch(app, /tour\.roomSlugs\.includes\("standard-room"\)/);
  assert.match(app, /imageNotActual/);
  assert.match(app, /imageNotActual/);
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
