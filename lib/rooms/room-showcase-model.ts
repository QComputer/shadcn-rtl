/**
 * Visual-only room card model. This file does NOT authorize publication,
 * resolve media ownership, or calculate availability and prices.
 * The public adapter must perform those checks before constructing a published card.
 */
export type RoomVisual = Readonly<{
  src: string;
  alt: string;
}>;

export type ConceptRoomCardData = Readonly<{
  kind: "concept";
  id: string;
  title: string;
  images: readonly RoomVisual[];
}>;

export type PublishedRoomCardData = Readonly<{
  kind: "published";
  id: string;
  title: string;
  images: readonly RoomVisual[];
  /** Only server-approved, localized text. Omit for missing translations. */
  description?: string | null;
  /** Only pre-approved labels/values. No implied amenities, prices, or capacity. */
  facts?: readonly Readonly<{ label: string; value: string }>[];
}>;

export type RoomCardData = ConceptRoomCardData | PublishedRoomCardData;

/** Maps ONLY explicit conceptual design fixtures; never manufactures business facts. */
export function toConceptCards(
  items: readonly Readonly<{ id: string; label: string; image: string }>[],
): ConceptRoomCardData[] {
  return items.map(({ id, label, image }) => ({
    kind: "concept",
    id,
    title: label,
    images: [{ src: image, alt: `تصویر مفهومی مربوط به ${label}؛ عکس واقعی هتل نیست` }],
  }));
}

/** Safe wrap-around for any nonempty photo collection. */
export function photoIndexAfter(current: number, delta: -1 | 1, photoCount: number): number {
  if (!Number.isInteger(photoCount) || photoCount <= 0) return 0;
  return ((current + delta) % photoCount + photoCount) % photoCount;
}

/** Empty image collections are valid and must render a neutral placeholder. */
export function photoAt(images: readonly RoomVisual[], index: number): RoomVisual | null {
  return images[index] ?? null;
}
