import {
  HotelPublicReadContractError,
  adaptPublishedProperty,
  adaptPublishedRoomCategories,
  adaptPublishedRoomPolicies,
  previewHotelRooms,
  type HotelPublicLocale,
  type PreviewHotelRooms,
  type PublishedPropertyRead,
  type PublishedRoomCategoriesRead,
  type PublishedRoomPoliciesRead,
} from "./hotel-public-read-adapter";
import type { ConceptRoomCardData } from "./rooms/room-showcase-model";
import type { HotelFrontendStateCode } from "./hotel-frontend-state";

export type HotelDataProvenance = "PREVIEW" | "PUBLISHED" | "AUTHENTICATED_PREVIEW";
export type PendingHotelContract =
  | "PUBLIC_EDITORIAL_READ"
  | "APPROVED_PROPERTY_MEDIA_READ"
  | "APPROVED_ROOM_MEDIA_READ"
  | "AUTHENTICATED_CMS_PREVIEW";

export type HotelDataResult<T> =
  | Readonly<{ status: "READY"; provenance: HotelDataProvenance; value: T }>
  | Readonly<{ status: "EMPTY"; provenance: HotelDataProvenance; state: "NO_APPROVED_CONTENT" | "NO_PUBLISHED_ROOMS" }>
  | Readonly<{ status: "UNAVAILABLE"; provenance: HotelDataProvenance; state: HotelFrontendStateCode }>
  | Readonly<{ status: "UNSUPPORTED"; provenance: HotelDataProvenance; pending: PendingHotelContract; state: "CONTENT_CONTRACT_PENDING" }>;

/** A preloaded snapshot provider, not a fetcher or an authorization boundary. */
export interface HotelFrontendDataProvider {
  readonly provenance: HotelDataProvenance;
  readonly locale: HotelPublicLocale;
  property(): HotelDataResult<PublishedPropertyRead>;
  rooms(): HotelDataResult<PreviewHotelRooms | PublishedRoomCategoriesRead>;
  policies(roomTypeSlug: string): HotelDataResult<PublishedRoomPoliciesRead>;
  editorial(): HotelDataResult<never>;
  propertyGallery(): HotelDataResult<never>;
  roomGallery(roomTypeSlug: string): HotelDataResult<never>;
  bookingPresentation(): "BOOKING_DISABLED";
}

function unsupported(provenance: HotelDataProvenance, pending: PendingHotelContract): HotelDataResult<never> {
  return { status: "UNSUPPORTED", provenance, pending, state: "CONTENT_CONTRACT_PENDING" };
}

/** Conceptual local fixtures can never be converted into PUBLISHED data by this provider. */
export function createConceptPreviewProvider(
  locale: HotelPublicLocale,
  conceptCards: readonly ConceptRoomCardData[],
): HotelFrontendDataProvider {
  const previewRooms = previewHotelRooms(conceptCards);
  return {
    provenance: "PREVIEW", locale,
    property: () => ({ status: "UNAVAILABLE", provenance: "PREVIEW", state: "PREVIEW_ONLY" }),
    rooms: () => ({ status: "READY", provenance: "PREVIEW", value: previewRooms }),
    policies: () => ({ status: "UNAVAILABLE", provenance: "PREVIEW", state: "PREVIEW_ONLY" }),
    editorial: () => unsupported("PREVIEW", "PUBLIC_EDITORIAL_READ"),
    propertyGallery: () => unsupported("PREVIEW", "APPROVED_PROPERTY_MEDIA_READ"),
    roomGallery: () => unsupported("PREVIEW", "APPROVED_ROOM_MEDIA_READ"),
    bookingPresentation: () => "BOOKING_DISABLED",
  };
}

/** Caller must first use the platform's trusted host resolver and publication gate.
 * Validation here rejects wrong property/room/locale shapes but grants no authority.
 * No client query, localStorage, or user-editable slug should construct this input.
 */
export function createPublishedSnapshotProvider(input: {
  trustedContext: Readonly<{ propertySlug: string; locale: HotelPublicLocale }>;
  propertyResponse: unknown;
  roomCategoriesResponse: unknown;
  policyResponsesByRoom: Readonly<Record<string, unknown>>;
}): HotelFrontendDataProvider {
  const { propertySlug, locale } = input.trustedContext;
  const property = adaptPublishedProperty(input.propertyResponse, { slug: propertySlug, locale });
  const rooms = adaptPublishedRoomCategories(input.roomCategoriesResponse, { propertySlug, locale });
  const allowedRoomSlugs = new Set(rooms.value.roomCategories.map((room) => room.slug));
  const policies = new Map<string, PublishedRoomPoliciesRead>();
  for (const [roomTypeSlug, response] of Object.entries(input.policyResponsesByRoom)) {
    if (!allowedRoomSlugs.has(roomTypeSlug)) throw new HotelPublicReadContractError();
    policies.set(roomTypeSlug, adaptPublishedRoomPolicies(response, { propertySlug, roomTypeSlug, locale }));
  }
  return {
    provenance: "PUBLISHED", locale,
    property: () => ({ status: "READY", provenance: "PUBLISHED", value: property }),
    rooms: () => rooms.value.roomCategories.length
      ? { status: "READY", provenance: "PUBLISHED", value: rooms }
      : { status: "EMPTY", provenance: "PUBLISHED", state: "NO_PUBLISHED_ROOMS" },
    policies: (roomTypeSlug) => {
      if (!allowedRoomSlugs.has(roomTypeSlug)) return { status: "UNAVAILABLE", provenance: "PUBLISHED", state: "UNAVAILABLE_PROPERTY" };
      const read = policies.get(roomTypeSlug);
      if (!read || read.value.cancellationPolicies.length === 0) return { status: "EMPTY", provenance: "PUBLISHED", state: "NO_APPROVED_CONTENT" };
      return { status: "READY", provenance: "PUBLISHED", value: read };
    },
    editorial: () => unsupported("PUBLISHED", "PUBLIC_EDITORIAL_READ"),
    propertyGallery: () => unsupported("PUBLISHED", "APPROVED_PROPERTY_MEDIA_READ"),
    roomGallery: (roomTypeSlug) => allowedRoomSlugs.has(roomTypeSlug)
      ? unsupported("PUBLISHED", "APPROVED_ROOM_MEDIA_READ")
      : { status: "UNAVAILABLE", provenance: "PUBLISHED", state: "UNAVAILABLE_PROPERTY" },
    bookingPresentation: () => "BOOKING_DISABLED",
  };
}

/** C1A defines storage and DTO proposals, not a usable authenticated preview route. */
export function createPendingAuthenticatedPreviewProvider(locale: HotelPublicLocale): HotelFrontendDataProvider {
  return {
    provenance: "AUTHENTICATED_PREVIEW", locale,
    property: () => ({ status: "UNAVAILABLE", provenance: "AUTHENTICATED_PREVIEW", state: "CONTENT_CONTRACT_PENDING" }),
    rooms: () => ({ status: "UNAVAILABLE", provenance: "AUTHENTICATED_PREVIEW", state: "CONTENT_CONTRACT_PENDING" }),
    policies: () => ({ status: "UNAVAILABLE", provenance: "AUTHENTICATED_PREVIEW", state: "CONTENT_CONTRACT_PENDING" }),
    editorial: () => unsupported("AUTHENTICATED_PREVIEW", "AUTHENTICATED_CMS_PREVIEW"),
    propertyGallery: () => unsupported("AUTHENTICATED_PREVIEW", "AUTHENTICATED_CMS_PREVIEW"),
    roomGallery: () => unsupported("AUTHENTICATED_PREVIEW", "AUTHENTICATED_CMS_PREVIEW"),
    bookingPresentation: () => "BOOKING_DISABLED",
  };
}
