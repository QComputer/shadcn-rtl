# F2B guest and stay foundation — preview only

The committed `9a5c7ff84ca5c96123781c04b418855b25fe0180` availability/quote validator is authoritative over the older OpenAPI draft. Both POST routes accept flat `property`, `checkIn`, `checkOut`, and `occupancy`. The property slug is supplied separately by trusted published/host context, never by editable search state. Dates are Gregorian `YYYY-MM-DD` property-local calendar days; the Jalali picker only changes presentation.

`lib/booking/search-form-model.ts` normalizes a draft into this exact base request. It enforces adults 1–12, children 0–12, ages 0–17, complete ages if any are supplied, ascending dates, and the committed 30-night ceiling. Child ages are **optional** in the committed validator; the UI does not invent a universal requirement. A future trusted policy may explicitly require them. No room/rate/amenity/price filters are fabricated.

`StayPolicyBoundary` has an explicit `UNAVAILABLE` state. The preview uses only this state. It labels its browser-local-today check as a preview convenience, not a hotel arrival rule. `PUBLISHED_PROPERTY` accepts the R1 property fields `timezone`, `minStayNights`, `maxStayNights`; when separately supplied by a trusted future policy source, property-local today, min/max arrival, unavailable dates and child-age requirement can be validated. Those optional inputs are **not claimed to be current backend response fields**. The existing Jalali picker can receive an ISO min/max date later, but current browser-local day disabling is not server authority. The backend must validate again.

The F2B form calls no Hotel API. On valid input it reports that property rules/inventory are unavailable and that no request was sent. Room cards, conceptual imagery and galleries remain preview data. No published price, capacity, amenity or policy is inferred.

## F2C prerequisites

1. Provide server-derived tenant/property context and current approved publication state. Do not trust editable organization or property claims.
2. Supply real R1 property-local timezone/min/max-stay data and a trusted property-local current date. Define an authoritative arrival horizon and unavailable-date contract before enforcing those optional rules as public policy.
3. Reconcile the old OpenAPI draft to the committed flat validator and direct response. Preserve no-store/publication gates and server revalidation.
4. Provide C1A approved editorial and C1B approved media contracts/assets before replacing conceptual content. No fabricated capacity, price, amenity or room image fallback.
5. Keep quote informational and booking/hold/payment outside this preview milestone. Future search results must not be interpreted as inventory commitments.
