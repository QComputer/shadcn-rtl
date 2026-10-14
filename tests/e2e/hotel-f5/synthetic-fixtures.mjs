/** Synthetic-only editorial values. Never replace with real Hotel records. */
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
