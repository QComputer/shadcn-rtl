import type { ConceptRoomCardData, PublishedRoomCardData } from "./rooms/room-showcase-model";

/** Mirrors the committed HOTEL_PUBLIC_READ_R1 response contract (9a5c7ff). No I/O. */
export type HotelPublicLocale = "fa" | "en" | "ar";
export type PublishedProperty = Readonly<{
  slug: string;
  name: string;
  description: string | null;
  localizedText: string | null;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  minStayNights: number;
  maxStayNights: number;
}>;
export type PublishedRoomCategory = Readonly<{
  slug: string;
  name: string;
  description: string | null;
  localizedText: string | null;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  beds?: readonly Readonly<{ kind: "single" | "double" | "queen" | "king" | "sofa" | "bunk" | "crib"; count: number; widthCm?: number }>[];
  sizeSqm: number | null;
}>;
export type PublishedCancellationPolicy = Readonly<{
  key: string;
  name: string;
  description: string | null;
  localizedText: string | null;
  freeCancellationCutoffHours: number;
  fullCancellationRetention: number;
  cancellationTiers?: readonly Readonly<{
    cutoffHours: number;
    retentionBasisPoints: number;
    penaltyBasis: "RESERVATION_TOTAL" | "FIRST_NIGHT";
  }>[];
}>;

export type PublishedRead<T> = Readonly<{ source: "PUBLISHED"; locale: HotelPublicLocale; value: T }>;
export type PublishedPropertyRead = PublishedRead<PublishedProperty>;
export type PublishedRoomCategoriesRead = PublishedRead<Readonly<{ propertySlug: string; roomCategories: readonly PublishedRoomCategory[] }>>;
export type PublishedRoomPoliciesRead = PublishedRead<Readonly<{ propertySlug: string; roomTypeSlug: string; cancellationPolicies: readonly PublishedCancellationPolicy[] }>>;
export type PreviewHotelRooms = Readonly<{ source: "PREVIEW"; roomCards: readonly ConceptRoomCardData[] }>;
export type HotelRoomData = PreviewHotelRooms | PublishedRoomCategoriesRead;

export class HotelPublicReadContractError extends Error {
  constructor() { super("Unexpected hotel public-read response"); this.name = "HotelPublicReadContractError"; }
}

function invalid(): never { throw new HotelPublicReadContractError(); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function shape(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  const record = object(value);
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !Object.hasOwn(record, key)) || Object.keys(record).some((key) => !allowed.has(key))) return invalid();
  return record;
}
function string(value: unknown): string { return typeof value === "string" ? value : invalid(); }
function nullableString(value: unknown): string | null { return value === null ? null : string(value); }
function integer(value: unknown): number { return typeof value === "number" && Number.isSafeInteger(value) ? value : invalid(); }
function positiveInteger(value: unknown): number { const result = integer(value); return result > 0 ? result : invalid(); }
function nonnegativeInteger(value: unknown): number { const result = integer(value); return result >= 0 ? result : invalid(); }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid(); }
function same(value: unknown, expected: string): string { const actual = string(value); return actual === expected ? actual : invalid(); }

function envelope(raw: unknown, expectedLocale: HotelPublicLocale): Record<string, unknown> {
  if (expectedLocale !== "fa" && expectedLocale !== "en" && expectedLocale !== "ar") return invalid();
  const value = object(raw);
  same(value.source, "PUBLISHED");
  same(value.locale, expectedLocale);
  return value;
}

/** Rejects stale, preview, cross-property, or structurally incompatible data. */
export function adaptPublishedProperty(raw: unknown, expected: { slug: string; locale: HotelPublicLocale }): PublishedPropertyRead {
  const response = shape(envelope(raw, expected.locale), ["source", "locale", "property"]);
  const value = shape(response.property, ["slug", "name", "description", "localizedText", "timezone", "currency", "checkInTime", "checkOutTime", "minStayNights", "maxStayNights"]);
  return {
    source: "PUBLISHED",
    locale: expected.locale,
    value: {
      slug: same(value.slug, expected.slug), name: string(value.name), description: nullableString(value.description), localizedText: nullableString(value.localizedText),
      timezone: string(value.timezone), currency: string(value.currency), checkInTime: string(value.checkInTime), checkOutTime: string(value.checkOutTime),
      minStayNights: integer(value.minStayNights), maxStayNights: integer(value.maxStayNights),
    },
  };
}

const bedKinds = ["single", "double", "queen", "king", "sofa", "bunk", "crib"] as const;
function parseBed(raw: unknown): NonNullable<PublishedRoomCategory["beds"]>[number] {
  const value = shape(raw, ["kind", "count"], ["widthCm"]);
  if (!bedKinds.includes(value.kind as typeof bedKinds[number])) return invalid();
  return { kind: value.kind as typeof bedKinds[number], count: positiveInteger(value.count), ...(value.widthCm === undefined ? {} : { widthCm: positiveInteger(value.widthCm) }) };
}

export function adaptPublishedRoomCategories(raw: unknown, expected: { propertySlug: string; locale: HotelPublicLocale }): PublishedRoomCategoriesRead {
  const response = shape(envelope(raw, expected.locale), ["source", "locale", "property", "roomCategories"]);
  const property = shape(response.property, ["slug"]);
  same(property.slug, expected.propertySlug);
  return {
    source: "PUBLISHED", locale: expected.locale,
    value: {
      propertySlug: expected.propertySlug,
      roomCategories: array(response.roomCategories).map((item): PublishedRoomCategory => {
        const room = shape(item, ["slug", "name", "description", "localizedText", "maxAdults", "maxChildren", "maxOccupancy", "sizeSqm"], ["beds"]);
        return {
          slug: string(room.slug), name: string(room.name), description: nullableString(room.description), localizedText: nullableString(room.localizedText),
          maxAdults: integer(room.maxAdults), maxChildren: integer(room.maxChildren), maxOccupancy: integer(room.maxOccupancy),
          sizeSqm: room.sizeSqm === null ? null : positiveInteger(room.sizeSqm),
          ...(room.beds === undefined ? {} : { beds: array(room.beds).map(parseBed) }),
        };
      }),
    },
  };
}

function parseTier(raw: unknown): NonNullable<PublishedCancellationPolicy["cancellationTiers"]>[number] {
  const value = shape(raw, ["cutoffHours", "retentionBasisPoints", "penaltyBasis"]);
  const retentionBasisPoints = nonnegativeInteger(value.retentionBasisPoints);
  if (retentionBasisPoints > 10000 || (value.penaltyBasis !== "RESERVATION_TOTAL" && value.penaltyBasis !== "FIRST_NIGHT")) return invalid();
  return { cutoffHours: nonnegativeInteger(value.cutoffHours), retentionBasisPoints, penaltyBasis: value.penaltyBasis };
}

export function adaptPublishedRoomPolicies(raw: unknown, expected: { propertySlug: string; roomTypeSlug: string; locale: HotelPublicLocale }): PublishedRoomPoliciesRead {
  const response = shape(envelope(raw, expected.locale), ["source", "locale", "property", "roomCategory", "cancellationPolicies"]);
  same(shape(response.property, ["slug"]).slug, expected.propertySlug);
  same(shape(response.roomCategory, ["slug"]).slug, expected.roomTypeSlug);
  return {
    source: "PUBLISHED", locale: expected.locale,
    value: {
      propertySlug: expected.propertySlug, roomTypeSlug: expected.roomTypeSlug,
      cancellationPolicies: array(response.cancellationPolicies).map((item): PublishedCancellationPolicy => {
        const policy = shape(item, ["key", "name", "description", "localizedText", "freeCancellationCutoffHours", "fullCancellationRetention"], ["cancellationTiers"]);
        const retention = policy.fullCancellationRetention;
        if (typeof retention !== "number" || !Number.isFinite(retention) || retention < 0 || retention > 1) return invalid();
        return {
          key: string(policy.key), name: string(policy.name), description: nullableString(policy.description), localizedText: nullableString(policy.localizedText),
          freeCancellationCutoffHours: nonnegativeInteger(policy.freeCancellationCutoffHours), fullCancellationRetention: retention,
          ...(policy.cancellationTiers === undefined ? {} : { cancellationTiers: array(policy.cancellationTiers).map(parseTier) }),
        };
      }),
    },
  };
}

/** The normal conceptual room list never becomes published by changing a label. */
export function previewHotelRooms(roomCards: readonly ConceptRoomCardData[]): PreviewHotelRooms {
  if (roomCards.some((room) => room.kind !== "concept")) return invalid();
  return { source: "PREVIEW", roomCards: [...roomCards] };
}

/** Approved catalog rows have no media, prices, amenities, or editorial facts. */
export function toPublishedRoomCards(read: PublishedRoomCategoriesRead): PublishedRoomCardData[] {
  if (read.source !== "PUBLISHED") return invalid();
  return read.value.roomCategories.map((room) => ({ kind: "published", id: room.slug, title: room.name, description: room.description, images: [] }));
}

export type UnsupportedPublicContent = Readonly<{ status: "UNSUPPORTED"; reason: "EDITORIAL_CONTRACT_MISSING" | "APPROVED_MEDIA_CONTRACT_MISSING" }>;
/** C1A defines persisted content and proposed DTOs, but no public read route yet. */
export function adaptPublishedEditorial(raw: unknown): UnsupportedPublicContent { void raw; return { status: "UNSUPPORTED", reason: "EDITORIAL_CONTRACT_MISSING" }; }
/** No reviewed public media reader exists yet; draft associations are not publication. */
export function adaptApprovedRoomMedia(raw: unknown): UnsupportedPublicContent { void raw; return { status: "UNSUPPORTED", reason: "APPROVED_MEDIA_CONTRACT_MISSING" }; }
