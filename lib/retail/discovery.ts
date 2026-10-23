/** Search text only. SKU identity and stored attribute values stay untouched. */
export function normalizeRetailSearch(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[يكى]/g,c=>c==="ك"?"ک":"ی")
    .replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>="۰"&&c<="۹"?1776:1632)))
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g,"")
    .replace(/[\u200c\u200d\p{P}\p{S}]/gu," ").replace(/\s+/g," ").trim();
}

export function isSyntheticRetailLabel(name: string, slug: string | null) {
  return /(^|[\s_-])qa([\s_-]|$)|آزمایشی|ساختگی|synthetic/i.test(`${name} ${slug??""}`);
}
