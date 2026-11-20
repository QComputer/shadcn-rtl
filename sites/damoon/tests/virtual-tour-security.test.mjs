import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedVirtualTourUrl, publishedDamoonTours, tourViewerMarkup } from "../virtual-tour.js";

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
