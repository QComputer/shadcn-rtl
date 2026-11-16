import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedVirtualTourUrl } from "../virtual-tour.js";

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
