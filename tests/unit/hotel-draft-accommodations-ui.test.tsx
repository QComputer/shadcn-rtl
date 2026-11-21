import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import {
  DraftPromotionForm,
  DraftPromotionStatus,
  completeDraftPromotion,
  draftActionsEnabled,
  promotionLabels,
  promotionMessageForStatus,
  promotionPayload,
  requestDraftPromotion,
} from "../../components/hotel-operations/draft-accommodation-promotion-ui";

function promotionForm(locale: string, overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(createElement(DraftPromotionForm, {
    text: promotionLabels(locale),
    cancelLabel: "Cancel",
    temporaryCode: "TMP-7",
    roomTypes: [{ id: "type-1", name: "Verified room type" }],
    loading: false,
    loadError: false,
    roomTypeId: "",
    physicalRoomCode: "",
    confirmed: false,
    busy: false,
    onRoomType: () => undefined,
    onCode: () => undefined,
    onConfirmation: () => undefined,
    onSubmit: () => undefined,
    onCancel: () => undefined,
    ...overrides,
  }));
}

test("promotion form requires a same-property room type, real room code and explicit confirmation", () => {
  const markup = promotionForm("en");
  assert.match(markup, /aria-label="Promote accommodation"/);
  assert.match(markup, /<option value="type-1">Verified room type<\/option>/);
  assert.match(markup, /Real physical room code/);
  assert.match(markup, /type="checkbox"[^>]*required=""/);
  assert.match(markup, /OUT OF SERVICE/);
  assert.equal(promotionPayload(4, "type-1", "A-101", false), null);
  assert.equal(promotionPayload(4, "", "A-101", true), null);
  assert.deepEqual(promotionPayload(4, "type-1", " A-101 ", true), {
    expectedVersion: 4, roomTypeId: "type-1", physicalRoomCode: "A-101", confirmPhysicalRoomCode: true,
  });
});

test("promotion request sends the current version and exposes successful response for list refresh", async () => {
  const payload = promotionPayload(7, "type-1", "A-107", true);
  let requestedUrl = "";
  let requestBody: unknown;
  const result = await requestDraftPromotion("/promote", payload, async (input, init) => {
    requestedUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ draft: { id: "draft-7" }, room: { id: "room-7", code: "A-107" } }), { status: 200 });
  });
  assert.equal(requestedUrl, "/promote");
  assert.deepEqual(requestBody, { expectedVersion: 7, roomTypeId: "type-1", physicalRoomCode: "A-107", confirmPhysicalRoomCode: true });
  assert.equal(result.ok, true);
  assert.equal(result.body?.room.code, "A-107");
  const effects: string[] = [];
  completeDraftPromotion(result.body!, promotionLabels("en"), {
    rememberRoomCode: (draftId, code) => effects.push(`code:${draftId}:${code}`),
    refreshDrafts: () => effects.push("refresh"),
    notify: (message) => effects.push(`notice:${message}`),
  });
  assert.equal(effects[0], "code:draft-7:A-107");
  assert.equal(effects[1], "refresh");
  assert.match(effects[2], /OUT OF SERVICE/);
});

test("promotion conflicts map to the localized reload message", async () => {
  const result = await requestDraftPromotion("/promote", promotionPayload(2, "type-1", "A-102", true), async () => new Response(null, { status: 409 }));
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(promotionMessageForStatus(result.status, { conflict: "Reload this draft", invalid: "Invalid", forbidden: "Forbidden", failed: "Failed" }).conflict, true);
});

test("active and already-promoted states are distinct, and promoted status says booking is disabled", () => {
  const text = promotionLabels("en");
  const activeMarkup = renderToStaticMarkup(createElement(DraftPromotionStatus, { text, promotedRoomId: null, promotedAt: null }));
  const promotedMarkup = renderToStaticMarkup(createElement(DraftPromotionStatus, { text, promotedRoomId: "room-7", promotedAt: "2026-11-21T12:00:00Z", roomCode: "A-107" }));
  assert.match(activeMarkup, /Active provisional draft/);
  assert.match(promotedMarkup, /Promoted to operational room/);
  assert.match(promotedMarkup, /room-7/);
  assert.match(promotedMarkup, /A-107/);
  assert.match(promotedMarkup, /not be available for booking/);
  assert.equal(draftActionsEnabled(null), true);
  assert.equal(draftActionsEnabled("room-7"), false);
});

test("promotion form labels are localized in fa, en and ar", () => {
  const expected = {
    fa: /تبدیل به اتاق عملیاتی/,
    en: /Promote to operational room/,
    ar: /ترقية إلى غرفة تشغيلية/,
  } as const;
  for (const locale of ["fa", "en", "ar"] as const) {
    const text = promotionLabels(locale);
    const markup = promotionForm(locale);
    assert.match(text.promote, expected[locale]);
    assert.match(markup, new RegExp(text.confirmPhysicalRoomCode));
    assert.match(markup, new RegExp(text.promotionWarning));
  }
});
