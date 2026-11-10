export type PendingVariantDeletion<T> = {
  variant: T;
  position: number;
};

export type DeletionPurchasability = {
  manuallyUnavailable: boolean;
  allowBackOrder: boolean;
  inventory: string | number;
  reservedQuantity: number;
};

/** Mirrors the catalog guard for whether a remaining variant can accept a purchase. */
export function hasPurchasableVariant(variants: DeletionPurchasability[], trackInventory: boolean): boolean {
  return variants.some(variant => !variant.manuallyUnavailable &&
    (!trackInventory || variant.allowBackOrder || Number(variant.inventory) > variant.reservedQuantity));
}

/** Maps a current active-list index to its original position after earlier staged removals. */
export function originalVariantPosition(activeIndex: number, pendingPositions: number[]): number {
  if (!Number.isInteger(activeIndex) || activeIndex < 0) throw new RangeError("activeIndex must be a non-negative integer");

  let position = activeIndex;
  for (const removedPosition of [...pendingPositions].sort((left, right) => left - right)) {
    if (!Number.isInteger(removedPosition) || removedPosition < 0) throw new RangeError("pending positions must be non-negative integers");
    if (removedPosition > position) break;
    position += 1;
  }
  return position;
}

/** Restores tombstoned drafts in their original order without changing their contents. */
export function restoreVariantDeletions<T>(active: T[], pending: PendingVariantDeletion<T>[]): T[] {
  const restored = [...active];
  for (const entry of [...pending].sort((left, right) => left.position - right.position)) {
    if (!Number.isInteger(entry.position) || entry.position < 0) throw new RangeError("pending positions must be non-negative integers");
    restored.splice(Math.min(entry.position, restored.length), 0, entry.variant);
  }
  return restored;
}
