import { redirect } from "next/navigation";
import { HotelOperationalReservations } from "@/components/hotel-operations/hotel-operational-reservations";
import { auth } from "@/lib/auth";

type Search = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}
function safeStayQuery(search: Search) {
  const query = new URLSearchParams();
  const requestId = first(search.requestId);
  if (requestId.length > 0 && requestId.length <= 200) query.set("requestId", requestId);
  const checkIn = first(search.checkIn);
  const checkOut = first(search.checkOut);
  if (validDate(checkIn)) query.set("checkIn", checkIn);
  if (validDate(checkOut) && (!validDate(checkIn) || checkOut > checkIn)) query.set("checkOut", checkOut);
  const adults = first(search.adults);
  query.set("adults", /^([1-9]|1[0-2])$/.test(adults) ? adults : "2");
  const children = first(search.children);
  const count = /^(0|[1-8])$/.test(children) ? Number(children) : 0;
  query.set("children", String(count));
  const ages = first(search.childAges).split(",");
  if (count && ages.length === count && ages.every((age) => age === "" || (/^\d{1,2}$/.test(age) && Number(age) <= 17))) query.set("childAges", ages.join(","));
  return query.toString();
}
function initialStay(search: Search) {
  const checkIn = first(search.checkIn);
  const checkOut = first(search.checkOut);
  const rawAdults = first(search.adults);
  const adults = /^([1-9]|1[0-2])$/.test(rawAdults) ? Number(rawAdults) : 2;
  const rawChildren = first(search.children);
  const count = /^(0|[1-8])$/.test(rawChildren) ? Number(rawChildren) : 0;
  const ages = first(search.childAges).split(",");
  const childAges = count && ages.length === count && ages.every((age) => age === "" || (/^\d{1,2}$/.test(age) && Number(age) <= 17))
    ? ages.map((age) => age === "" ? null : Number(age))
    : Array.from({ length: count }, () => null);
  return { checkIn: validDate(checkIn) ? checkIn : "", checkOut: validDate(checkOut) && (!validDate(checkIn) || checkOut > checkIn) ? checkOut : "", adults, childAges };
}

export default async function HotelReservationsPage({ params, searchParams }: {
  params: Promise<{ locale: string; organizationId: string; propertyId: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ locale, organizationId, propertyId }, search, session] = await Promise.all([params, searchParams, auth()]);
  const requestId = first(search.requestId);
  if (!session?.user?.id) {
    const stay = safeStayQuery(search);
    const path = `/${locale}/hotel-reservations/${encodeURIComponent(organizationId)}/${encodeURIComponent(propertyId)}${stay ? `?${stay}` : ""}`;
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(path)}`);
  }
  return <main className="mx-auto min-w-0 w-full max-w-5xl p-4 sm:p-6">
    <HotelOperationalReservations key={`${organizationId}:${propertyId}:${session.user.id}`} organizationId={organizationId} propertyId={propertyId} locale={locale} mode={session.user.role === "CUSTOMER" ? "guest" : "reception"} canConfigure={session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"} initialStay={initialStay(search)} requestId={requestId.length <= 200 ? requestId : undefined} />
  </main>;
}
