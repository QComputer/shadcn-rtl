/** Display only: never use this value for variant matching or filter payloads. */
export function formatRetailSize(value: string, locale = "fa") {
  if (!/^fa(?:-|$)/i.test(locale)) return value;
  return value.replace(/[0-9٠-٩]/g, digit => "۰۱۲۳۴۵۶۷۸۹"[/[0-9]/.test(digit) ? Number(digit) : "٠١٢٣٤٥٦٧٨٩".indexOf(digit)]);
}
