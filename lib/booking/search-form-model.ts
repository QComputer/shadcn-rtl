import { parseISODate, shiftISODate, type ISODate, type StayRange } from "./jalali-calendar";

/** Matches the committed public availability/quote validator, not the old OpenAPI draft. */
export interface AvailabilitySearchRequest {
  property: string;
  checkIn: ISODate;
  checkOut: ISODate;
  occupancy: { adults: number; children: number; childAges?: number[] };
}

export interface GuestCompositionDraft {
  adults: number;
  /** null means the age was not entered. Ages are optional unless a trusted policy requires them. */
  childAges: readonly (number | null)[];
}

export interface SearchDraft extends StayRange {
  guests: GuestCompositionDraft;
}

/** R1 publishes min/max nights and timezone. Other fields need a future trusted policy source. */
export type StayPolicyBoundary =
  | { source: "UNAVAILABLE" }
  | {
      source: "PUBLISHED_PROPERTY";
      timezone: string;
      minStayNights: number;
      maxStayNights: number;
      propertyLocalToday?: ISODate;
      minArrivalDate?: ISODate;
      maxArrivalDate?: ISODate;
      unavailableDates?: readonly ISODate[];
      requireChildAges?: boolean;
    };

export type SearchIssue =
  | "DATES_REQUIRED" | "INVALID_DATE" | "DATE_ORDER" | "PAST_PREVIEW_DATE"
  | "MIN_ARRIVAL" | "MAX_ARRIVAL" | "MIN_STAY" | "MAX_STAY"
  | "UNAVAILABLE_DATE" | "INVALID_POLICY" | "INVALID_ADULTS" | "INVALID_CHILDREN"
  | "INVALID_CHILD_AGE" | "INCOMPLETE_CHILD_AGES" | "CHILD_AGES_REQUIRED"
  | "INVALID_PROPERTY";

export type SearchResult<T> =
  | { ok: true; value: T; policyAvailable: boolean; browserTodayOnly: boolean }
  | { ok: false; issue: SearchIssue };

export const initialGuests: GuestCompositionDraft = { adults: 1, childAges: [] };

export function setAdultCount(draft: GuestCompositionDraft, adults: number): GuestCompositionDraft {
  return { ...draft, adults: Math.max(1, Math.min(12, adults)) };
}

export function addChild(draft: GuestCompositionDraft): GuestCompositionDraft {
  return draft.childAges.length < 12 ? { ...draft, childAges: [...draft.childAges, null] } : draft;
}

export function removeChild(draft: GuestCompositionDraft): GuestCompositionDraft {
  return { ...draft, childAges: draft.childAges.slice(0, -1) };
}

export function setChildAge(draft: GuestCompositionDraft, index: number, age: number | null): GuestCompositionDraft {
  if (!Number.isInteger(index) || index < 0 || index >= draft.childAges.length) return draft;
  return { ...draft, childAges: draft.childAges.map((current, position) => position === index ? age : current) };
}

function normalizeGuests(draft: GuestCompositionDraft, requireAges: boolean): SearchResult<AvailabilitySearchRequest["occupancy"]> {
  if (!Number.isInteger(draft.adults) || draft.adults < 1 || draft.adults > 12) return { ok: false, issue: "INVALID_ADULTS" };
  const children = draft.childAges.length;
  if (children > 12) return { ok: false, issue: "INVALID_CHILDREN" };
  if (draft.childAges.some((age) => age !== null && (!Number.isInteger(age) || age < 0 || age > 17))) {
    return { ok: false, issue: "INVALID_CHILD_AGE" };
  }
  const enteredAges = draft.childAges.filter((age): age is number => age !== null);
  if (enteredAges.length > 0 && enteredAges.length !== children) return { ok: false, issue: "INCOMPLETE_CHILD_AGES" };
  if (requireAges && enteredAges.length !== children) return { ok: false, issue: "CHILD_AGES_REQUIRED" };
  return {
    ok: true,
    value: { adults: draft.adults, children, ...(enteredAges.length ? { childAges: enteredAges } : {}) },
    policyAvailable: false,
    browserTodayOnly: false,
  };
}

/** Pure validation. Browser today is explicitly a preview convenience, never a hotel policy. */
export function validateSearchDraft(
  draft: SearchDraft,
  options: { policy: StayPolicyBoundary; browserToday?: ISODate },
): SearchResult<Omit<AvailabilitySearchRequest, "property">> {
  const { policy, browserToday } = options;
  const occupancy = normalizeGuests(draft.guests, policy.source === "PUBLISHED_PROPERTY" && policy.requireChildAges === true);
  if ("issue" in occupancy) return { ok: false, issue: occupancy.issue };
  if (!draft.checkIn || !draft.checkOut) return { ok: false, issue: "DATES_REQUIRED" };
  const start = parseISODate(draft.checkIn);
  const end = parseISODate(draft.checkOut);
  if (!start || !end) return { ok: false, issue: "INVALID_DATE" };
  if (draft.checkOut <= draft.checkIn) return { ok: false, issue: "DATE_ORDER" };
  if (browserToday && !parseISODate(browserToday)) return { ok: false, issue: "INVALID_DATE" };
  if (policy.source === "PUBLISHED_PROPERTY") {
    if (!Number.isInteger(policy.minStayNights) || !Number.isInteger(policy.maxStayNights) ||
        policy.minStayNights < 1 || policy.maxStayNights < policy.minStayNights ||
        !policy.timezone || [policy.propertyLocalToday, policy.minArrivalDate, policy.maxArrivalDate, ...(policy.unavailableDates ?? [])]
          .some((date) => date && !parseISODate(date))) return { ok: false, issue: "INVALID_POLICY" };
    const minimum = [policy.minArrivalDate, policy.propertyLocalToday].filter((date): date is ISODate => Boolean(date)).sort().at(-1);
    if (minimum && draft.checkIn < minimum) return { ok: false, issue: "MIN_ARRIVAL" };
    if (policy.maxArrivalDate && draft.checkIn > policy.maxArrivalDate) return { ok: false, issue: "MAX_ARRIVAL" };
  } else if (browserToday && draft.checkIn < browserToday) {
    return { ok: false, issue: "PAST_PREVIEW_DATE" };
  }
  const nights = (end.getTime() - start.getTime()) / 86_400_000;
  if (nights > 30) return { ok: false, issue: "MAX_STAY" }; // committed validator ceiling
  if (policy.source === "PUBLISHED_PROPERTY") {
    if (nights < policy.minStayNights) return { ok: false, issue: "MIN_STAY" };
    if (nights > policy.maxStayNights) return { ok: false, issue: "MAX_STAY" };
    const unavailable = new Set(policy.unavailableDates ?? []);
    for (let day = draft.checkIn; day < draft.checkOut; day = shiftISODate(day, 1)) {
      if (unavailable.has(day)) return { ok: false, issue: "UNAVAILABLE_DATE" };
    }
  }
  return {
    ok: true,
    value: { checkIn: draft.checkIn, checkOut: draft.checkOut, occupancy: occupancy.value },
    policyAvailable: policy.source === "PUBLISHED_PROPERTY",
    browserTodayOnly: policy.source === "UNAVAILABLE" && Boolean(browserToday),
  };
}

/** The property slug must come from trusted published context, never from editable form state. */
export function normalizeAvailabilitySearch(
  draft: SearchDraft,
  context: { trustedPropertySlug: string; policy: StayPolicyBoundary },
): SearchResult<AvailabilitySearchRequest> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(context.trustedPropertySlug) ||
      context.trustedPropertySlug.length < 2 || context.trustedPropertySlug.length > 64) {
    return { ok: false, issue: "INVALID_PROPERTY" };
  }
  const result = validateSearchDraft(draft, { policy: context.policy });
  if ("issue" in result) return { ok: false, issue: result.issue };
  return { ...result, value: { property: context.trustedPropertySlug, ...result.value } };
}
