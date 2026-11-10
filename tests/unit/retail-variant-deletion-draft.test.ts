import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasPurchasableVariant, originalVariantPosition, restoreVariantDeletions, type PendingVariantDeletion } from "@/lib/retail/variant-deletion-draft";

type Draft = { id?: string; name: string; options: Record<string, string>; imageIds: string[] };

function stage<T>(active: T[], pending: PendingVariantDeletion<T>[], indices: number[]) {
  const selected = new Set(indices);
  const newlyPending = active.flatMap((variant, index) => selected.has(index) ? [{
    variant,
    position: originalVariantPosition(index, pending.map(entry => entry.position)),
  }] : []);
  return { active: active.filter((_, index) => !selected.has(index)), pending: [...pending, ...newlyPending] };
}

describe("Retail variant deletion draft ordering", () => {
  it("restores exact order after several overlapping removal waves", () => {
    const original: Draft[] = ["A", "B", "C", "D", "E"].map(name => ({ id: name, name, options: { color: name }, imageIds: [`image-${name}`] }));
    let state = { active: original, pending: [] as PendingVariantDeletion<Draft>[] };

    state = stage(state.active, state.pending, [0, 1]);
    state = stage(state.active, state.pending, [1]);
    state = stage(state.active, state.pending, [1]);

    assert.deepEqual(state.pending.map(entry => [entry.variant.name, entry.position]), [["A", 0], ["B", 1], ["D", 3], ["E", 4]]);
    assert.deepEqual(restoreVariantDeletions(state.active, state.pending), original);
  });

  it("restores saved rows and new drafts with their complete edit data after a batch and later removal", () => {
    const original: Draft[] = [
      { id: "saved-1", name: "saved one", options: { shade: "black", size: "۴۰" }, imageIds: ["private-gallery-image"] },
      { name: "new two", options: { shade: "cream", size: "40.5" }, imageIds: ["new-draft-image"] },
      { id: "saved-3", name: "saved three", options: { shade: "white", size: "٤١" }, imageIds: [] },
      { name: "new four", options: { shade: "blue", size: "text-size" }, imageIds: ["shared-image"] },
    ];
    let state = { active: original, pending: [] as PendingVariantDeletion<Draft>[] };

    state = stage(state.active, state.pending, [0, 2]);
    state = stage(state.active, state.pending, [1]);

    assert.deepEqual(state.pending.map(entry => [entry.variant.name, entry.position]), [["saved one", 0], ["saved three", 2], ["new four", 3]]);
    assert.deepEqual(restoreVariantDeletions(state.active, state.pending), original);
  });

  it("maps an active index through a cascade of adjacent tombstone positions", () => {
    assert.equal(originalVariantPosition(1, [0, 1, 3]), 4);
    assert.equal(originalVariantPosition(1, [0, 2]), 3);
  });

  it("matches catalog orderability when deciding whether a deletion needs unpublishing", () => {
    const soldOut = { manuallyUnavailable: false, allowBackOrder: false, inventory: "4", reservedQuantity: 4 };
    const disabled = { manuallyUnavailable: true, allowBackOrder: true, inventory: "10", reservedQuantity: 2 };
    assert.equal(hasPurchasableVariant([soldOut, disabled], true), false);
    assert.equal(hasPurchasableVariant([{ ...soldOut, inventory: "5" }], true), true);
    assert.equal(hasPurchasableVariant([{ ...soldOut, allowBackOrder: true }], true), true);
    assert.equal(hasPurchasableVariant([disabled], false), false);
    assert.equal(hasPurchasableVariant([{ ...disabled, manuallyUnavailable: false }], false), true);
  });
});
