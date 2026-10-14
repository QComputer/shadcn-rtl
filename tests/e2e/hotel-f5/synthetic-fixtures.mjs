/** Synthetic-only editorial values. Never replace with real Hotel records. */
export const syntheticFixtureRequirements = Object.freeze({
  targetTenant: { label: "F5 synthetic Hotel A", active: true, hotelWebsite: true, hotelBooking: false, host: "dedicated F5 staging host" },
  foreignTenant: { label: "F5 synthetic Hotel B", active: true, hotelWebsite: true, hotelBooking: false, host: "separate F5 staging host" },
  disabledTenant: { label: "F5 synthetic Hotel capability-negative", active: true, hotelWebsite: false, hotelBooking: false, host: "dedicated F5 staging host" },
  accounts: ["ADMIN author", "distinct ADMIN reviewer", "MANAGER author/negative reviewer", "foreign-tenant ADMIN"],
  media: ["target-owned PUBLIC PNG with synthetic-only alt text", "foreign-tenant PUBLIC image", "foreign-tenant published association ID"],
  publication: "target and foreign content contain synthetic-only text; no real hotel copy or photography",
});

export function syntheticEditorial(marker) {
  return {
    title: `آزمایش محتوای مصنوعی ${marker}`,
    heading: `پیش‌نمایش آزمایشی ${marker}`,
    introduction: `این متن صرفاً داده آزمایشی خصوصی برای پذیرش F5 است (${marker}) و ادعایی درباره هتل نیست.`,
    altText: `رسانه مصنوعی تست F5؛ عکس واقعی هتل نیست (${marker})`,
  };
}

export function websiteApiBase(organizationId, propertyId) {
  return `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/website`;
}

export function publicWebsiteApi(propertySlug, locale = "fa") {
  return `/api/hotel/v1/website/properties/${encodeURIComponent(propertySlug)}?locale=${locale}`;
}

export function publicMediaApi(associationId) {
  return `/api/hotel/v1/website/media/${encodeURIComponent(associationId)}`;
}
