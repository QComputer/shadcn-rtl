import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { HotelStayRequests } from "@/components/hotel-operations/hotel-stay-requests";

type Query = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function safeStay(query: Query) {
  const rawIn = one(query.checkIn);
  const rawOut = one(query.checkOut);
  const checkIn = validDate(rawIn) ? rawIn : "";
  const checkOut = validDate(rawOut) && (!checkIn || rawOut > checkIn) ? rawOut : "";
  const rawAdults = one(query.adults);
  const parsedAdults = /^\d{1,2}$/.test(rawAdults) ? Number(rawAdults) : 2;
  const adults = parsedAdults >= 1 && parsedAdults <= 12 ? parsedAdults : 2;
  const rawChildren = one(query.children);
  const parsedChildren = /^\d{1,2}$/.test(rawChildren) ? Number(rawChildren) : 0;
  const children = parsedChildren >= 0 && parsedChildren <= 8 ? parsedChildren : 0;
  const rawAges = query.childAges === undefined ? [] : one(query.childAges).split(",");
  const childAges = rawAges.length === children && rawAges.every((age) => age === "" || (/^\d{1,2}$/.test(age) && Number(age) <= 17))
    ? rawAges.map((age) => age === "" ? null : Number(age))
    : Array.from({ length: children }, () => null);
  return { checkIn, checkOut, adults, childAges };
}

function stayQuery(stay: ReturnType<typeof safeStay>) {
  const query = new URLSearchParams();
  if (stay.checkIn) query.set("checkIn", stay.checkIn);
  if (stay.checkOut) query.set("checkOut", stay.checkOut);
  query.set("adults", String(stay.adults));
  query.set("children", String(stay.childAges.length));
  if (stay.childAges.length) query.set("childAges", stay.childAges.map((age) => age === null ? "" : String(age)).join(","));
  return query.toString();
}

export default async function HotelStayRequestsPage({ params, searchParams }: {
  params: Promise<{ locale: string; organizationId: string; propertyId: string }>;
  searchParams: Promise<Query>;
}) {
  const [{ locale, organizationId, propertyId }, query] = await Promise.all([params, searchParams]);
  const stay = safeStay(query);
  const session = await auth();
  if (!session?.user?.id) {
    const queryString = stayQuery(stay);
    const callbackUrl = `/${locale}/hotel/${encodeURIComponent(organizationId)}/${encodeURIComponent(propertyId)}${queryString ? `?${queryString}` : ""}`;
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return <main className="mx-auto min-w-0 w-full max-w-5xl space-y-4 p-4">
    <HotelStayRequests key={`${organizationId}:${propertyId}:${session.user.id}`} organizationId={organizationId} propertyId={propertyId} locale={locale} initialStay={stay} />
  </main>;
}
