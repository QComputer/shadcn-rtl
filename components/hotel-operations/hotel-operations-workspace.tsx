"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HotelBookingSandbox } from "./hotel-booking-sandbox";
import { HotelRequestReception } from "./hotel-request-reception";

type Room = { id: string; code: string; floor: string | null; isOutOfService: boolean; isActive: boolean };
type RoomType = {
  id: string; slug: string; name: string; description: string | null; maxAdults: number;
  maxChildren: number; maxOccupancy: number; beds: unknown; rooms: Room[];
};
type RatePlan = {
  id: string; roomTypeId: string; code: string; name: string; currency: string;
  baseNightlyRate: string; minNights: number | null; maxNights: number | null;
  isRefundable: boolean; validFrom: string | null; validTo: string | null;
  nightlyRates: Array<{ id: string; from: string; to: string; nightlyRate: string | null; minNights: number | null; maxNights: number | null }>;
};
type InventoryNight = {
  id: string; roomTypeId: string; date: string; allotment: number; booked: number;
  held: number; outOfService: number; available: number; closedToArrival: boolean; closedToDeparture: boolean;
};
type OperationsData = {
  property: { id: string; name: string; slug: string; timezone: string; currency: string };
  range: { from: string; to: string; nights: number };
  roomTypes: RoomType[];
  ratePlans: RatePlan[];
  inventory: InventoryNight[];
};

const labels = {
  fa: {
    title: "عملیات هتل",
    loading: "در حال بارگذاری…", loadError: "اطلاعات عملیات بارگذاری نشد.", saveError: "ذخیره انجام نشد.",
    roomTypes: "انواع اتاق", rooms: "اتاق‌های فیزیکی", rates: "نرخ‌ها", inventory: "ظرفیت شبانه",
    add: "افزودن", save: "ذخیره", update: "ذخیره تغییرات", cancel: "لغو ویرایش", edit: "ویرایش",
    slug: "شناسه نوع اتاق", name: "نام", description: "توضیحات", adults: "بزرگسالان", children: "کودکان", occupancy: "ظرفیت کل", beds: "تخت", bedKind: "نوع تخت", bedCount: "تعداد", bedKinds: { single: "یک‌نفره", double: "دو‌نفره", queen: "کوئین", king: "کینگ", sofa: "مبل تخت‌خواب‌شو", bunk: "دوطبقه", crib: "تخت کودک" },
    roomType: "نوع اتاق", code: "کد اتاق", floor: "طبقه", unavailable: "خارج از سرویس", active: "فعال", room: "اتاق",
    planCode: "کد طرح نرخ", planName: "نام طرح", baseRate: "نرخ پایه (تومان)", createPlan: "ایجاد طرح نرخ", planValidity: "اعتبار طرح",
    from: "از (شامل)", to: "تا (غیرشامل)", nightlyRate: "نرخ شبانه (تومان)", saveNightly: "ذخیره نرخ این بازه",
    date: "تاریخ شب", allotment: "ظرفیت کل", allotmentDelta: "تغییر ظرفیت", outDelta: "تغییر خارج از سرویس", reason: "دلیل ثبت", initialize: "ساخت شب‌های ظرفیتِ موجودنیست", adjust: "ثبت تغییر ظرفیت", refresh: "بارگذاری دوباره",
    available: "قابل فروش", booked: "رزروشده", held: "در انتظار", oos: "خارج از سرویس", none: "رکوردی موجود نیست.", errorPrefix: "خطا:", saved: "تغییر ذخیره شد.", range: "بازه نمایش", load: "نمایش بازه",
    bedsError: "تخت را انتخاب کنید و تعداد معتبر وارد کنید.", deltasError: "حداقل یک تغییر ظرفیت یا خارج از سرویس وارد کنید.",
  },
  en: {
    title: "Hotel operations",
    loading: "Loading…", loadError: "Could not load operations.", saveError: "Save failed.",
    roomTypes: "Room types", rooms: "Physical rooms", rates: "Rates", inventory: "Nightly inventory",
    add: "Add", save: "Save", update: "Save changes", cancel: "Cancel edit", edit: "Edit",
    slug: "Room type slug", name: "Name", description: "Description", adults: "Adults", children: "Children", occupancy: "Max occupancy", beds: "Bed", bedKind: "Bed type", bedCount: "Count", bedKinds: { single: "Single", double: "Double", queen: "Queen", king: "King", sofa: "Sofa bed", bunk: "Bunk", crib: "Crib" },
    roomType: "Room type", code: "Room code", floor: "Floor", unavailable: "Out of service", active: "Active", room: "Room",
    planCode: "Rate plan code", planName: "Rate plan name", baseRate: "Base nightly rate (Toman)", createPlan: "Create rate plan", planValidity: "Plan validity",
    from: "From (inclusive)", to: "To (exclusive)", nightlyRate: "Nightly rate (Toman)", saveNightly: "Save nightly-rate range",
    date: "Night date", allotment: "Allotment", allotmentDelta: "Allotment change", outDelta: "Out-of-service change", reason: "Reason", initialize: "Initialize missing nights", adjust: "Save inventory adjustment", refresh: "Reload",
    available: "Available", booked: "Booked", held: "Held", oos: "Out of service", none: "No records yet.", errorPrefix: "Error:", saved: "Changes saved.", range: "Date range", load: "Load range",
    bedsError: "Choose a bed type and enter a valid count.", deltasError: "Enter a non-zero allotment or out-of-service change.",
  },
  ar: {
    title: "عمليات الفندق",
    loading: "جارٍ التحميل…", loadError: "تعذر تحميل العمليات.", saveError: "تعذر الحفظ.",
    roomTypes: "أنواع الغرف", rooms: "الغرف الفعلية", rates: "الأسعار", inventory: "مخزون الليالي",
    add: "إضافة", save: "حفظ", update: "حفظ التغييرات", cancel: "إلغاء التعديل", edit: "تعديل",
    slug: "معرّف نوع الغرفة", name: "الاسم", description: "الوصف", adults: "البالغون", children: "الأطفال", occupancy: "السعة القصوى", beds: "السرير", bedKind: "نوع السرير", bedCount: "العدد", bedKinds: { single: "مفرد", double: "مزدوج", queen: "كوين", king: "كينغ", sofa: "سرير أريكة", bunk: "طابقي", crib: "سرير أطفال" },
    roomType: "نوع الغرفة", code: "رمز الغرفة", floor: "الطابق", unavailable: "خارج الخدمة", active: "نشطة", room: "غرفة",
    planCode: "رمز خطة السعر", planName: "اسم الخطة", baseRate: "السعر الأساسي لليلة (تومان)", createPlan: "إنشاء خطة سعر", planValidity: "صلاحية الخطة",
    from: "من (شامل)", to: "إلى (غير شامل)", nightlyRate: "سعر الليلة (تومان)", saveNightly: "حفظ أسعار الفترة",
    date: "تاريخ الليلة", allotment: "السعة", allotmentDelta: "تغيير السعة", outDelta: "تغيير خارج الخدمة", reason: "سبب التغيير", initialize: "إنشاء الليالي المفقودة", adjust: "حفظ تعديل المخزون", refresh: "إعادة التحميل",
    available: "متاح", booked: "محجوز", held: "معلّق", oos: "خارج الخدمة", none: "لا توجد سجلات.", errorPrefix: "خطأ:", saved: "تم حفظ التغييرات.", range: "الفترة", load: "عرض الفترة",
    bedsError: "اختر نوع السرير وأدخل عددًا صالحًا.", deltasError: "أدخل تغييرًا غير صفري في السعة أو خارج الخدمة.",
  },
} as const;

function dateInTimezone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function addDays(date: string, count: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function HotelOperationsWorkspace({ organizationId, propertyId, propertyName, propertyTimezone, locale, guestPortalEnabled = false, canConfigureGuestPortal = false }: {
  organizationId: string; propertyId: string; propertyName: string; propertyTimezone: string; locale: string; guestPortalEnabled?: boolean; canConfigureGuestPortal?: boolean;
}) {
  const text = labels[locale as keyof typeof labels] ?? labels.fa;
  const baseUrl = useMemo(() => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}`, [organizationId, propertyId]);
  const initialFrom = useMemo(() => dateInTimezone(propertyTimezone), [propertyTimezone]);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(() => addDays(initialFrom, 7));
  const [data, setData] = useState<OperationsData | null>(null);
  const [dataRange, setDataRange] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [typeSlug, setTypeSlug] = useState("");
  const [typeName, setTypeName] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [typeAdults, setTypeAdults] = useState("2");
  const [typeChildren, setTypeChildren] = useState("0");
  const [typeOccupancy, setTypeOccupancy] = useState("2");
  const [typeBedKind, setTypeBedKind] = useState("queen");
  const [typeBedCount, setTypeBedCount] = useState("1");
  const [preservedBeds, setPreservedBeds] = useState<Array<Record<string, unknown>>>([]);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomFloor, setRoomFloor] = useState("");
  const [roomUnavailable, setRoomUnavailable] = useState(false);
  const [roomActive, setRoomActive] = useState(true);
  const [planTypeId, setPlanTypeId] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [planName, setPlanName] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [ratePlanId, setRatePlanId] = useState("");
  const [rateFrom, setRateFrom] = useState(initialFrom);
  const [rateTo, setRateTo] = useState(() => addDays(initialFrom, 1));
  const [nightlyRate, setNightlyRate] = useState("");
  const [inventoryTypeId, setInventoryTypeId] = useState("");
  const [inventoryDate, setInventoryDate] = useState(initialFrom);
  const [allotment, setAllotment] = useState("1");
  const [inventoryFrom, setInventoryFrom] = useState(initialFrom);
  const [inventoryTo, setInventoryTo] = useState(() => addDays(initialFrom, 7));
  const [allotmentDelta, setAllotmentDelta] = useState("0");
  const [outDelta, setOutDelta] = useState("0");
  const [reason, setReason] = useState("");
  const pendingIdempotency = useRef<{ signature: string; key: string } | null>(null);
  const rangeKey = `${from}|${to}`;
  const activeData = dataRange === rangeKey ? data : null;
  const isLoading = loading || (dataRange !== rangeKey && !error);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${baseUrl}/operations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store", credentials: "same-origin", signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || text.loadError);
    if (!signal?.aborted) {
      setData(body as OperationsData);
      setDataRange(`${from}|${to}`);
      setError("");
      setRoomTypeId((current) => current || (body.roomTypes[0]?.id ?? ""));
      setPlanTypeId((current) => current || (body.roomTypes[0]?.id ?? ""));
      setInventoryTypeId((current) => current || (body.roomTypes[0]?.id ?? ""));
      setRatePlanId((current) => current || (body.ratePlans[0]?.id ?? ""));
    }
  }, [baseUrl, from, text.loadError, to]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal)).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : text.loadError); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, text.loadError]);

  async function reload() {
    setLoading(true);
    setDataRange(null);
    setError("");
    try { await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text.loadError); }
    finally { setLoading(false); }
  }

  async function mutate(path: string, method: string, payload: unknown, idempotent = false) {
    setError(""); setNotice(""); setBusy(true);
    try {
      const signature = JSON.stringify([baseUrl, path, payload]);
      if (idempotent && pendingIdempotency.current?.signature !== signature) {
        pendingIdempotency.current = { signature, key: idempotencyKey() };
      }
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...(idempotent ? { "idempotency-key": pendingIdempotency.current!.key } : {}) },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || text.saveError);
      setDataRange(null);
      await load();
      if (idempotent) pendingIdempotency.current = null;
      setNotice(text.saved);
      return body;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.saveError);
      return null;
    } finally { setBusy(false); }
  }

  function startTypeEdit(item: RoomType) {
    setEditingTypeId(item.id); setTypeSlug(item.slug); setTypeName(item.name); setTypeDescription(item.description ?? "");
    setTypeAdults(String(item.maxAdults)); setTypeChildren(String(item.maxChildren)); setTypeOccupancy(String(item.maxOccupancy));
    const beds = Array.isArray(item.beds) ? item.beds.filter((bed): bed is Record<string, unknown> => Boolean(bed) && typeof bed === "object") : [];
    const first = beds[0];
    setTypeBedKind(typeof first?.kind === "string" ? first.kind : "queen");
    setTypeBedCount(String(typeof first?.count === "number" ? first.count : 1));
    setPreservedBeds(beds.slice(1));
  }
  function resetTypeForm() {
    setEditingTypeId(null); setTypeSlug(""); setTypeName(""); setTypeDescription(""); setTypeAdults("2"); setTypeChildren("0"); setTypeOccupancy("2"); setTypeBedKind("queen"); setTypeBedCount("1"); setPreservedBeds([]);
  }
  async function saveType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(typeBedCount);
    if (!Number.isInteger(count) || count < 1) { setError(text.bedsError); return; }
    const currentBeds = activeData?.roomTypes.find((item) => item.id === editingTypeId)?.beds;
    const previous = Array.isArray(currentBeds) ? currentBeds.filter((bed): bed is Record<string, unknown> => Boolean(bed) && typeof bed === "object") : [];
    const beds = [{ ...(previous[0] ?? {}), kind: typeBedKind, count }, ...preservedBeds];
    const payload = { name: typeName, description: typeDescription, maxAdults: Number(typeAdults), maxChildren: Number(typeChildren), maxOccupancy: Number(typeOccupancy), beds };
    const result = await mutate(`/room-types${editingTypeId ? `/${encodeURIComponent(editingTypeId)}` : ""}`, editingTypeId ? "PATCH" : "POST", editingTypeId ? payload : { ...payload, slug: typeSlug });
    if (result) resetTypeForm();
  }
  function startRoomEdit(room: Room, parentRoomTypeId: string) {
    setEditingRoomId(room.id); setRoomTypeId(parentRoomTypeId); setRoomCode(room.code); setRoomFloor(room.floor ?? ""); setRoomUnavailable(room.isOutOfService); setRoomActive(room.isActive);
  }
  function resetRoomForm() { setEditingRoomId(null); setRoomCode(""); setRoomFloor(""); setRoomUnavailable(false); setRoomActive(true); }
  async function saveRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { roomTypeId, code: roomCode, floor: roomFloor || null, isOutOfService: roomUnavailable, ...(editingRoomId ? { isActive: roomActive } : {}) };
    const result = await mutate(`/rooms${editingRoomId ? `/${encodeURIComponent(editingRoomId)}` : ""}`, editingRoomId ? "PATCH" : "POST", payload);
    if (result) resetRoomForm();
  }
  async function createRatePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await mutate("/rate-plans", "POST", { roomTypeId: planTypeId, code: planCode, name: planName, baseNightlyRate: baseRate });
    if (result?.ratePlan?.id) setRatePlanId(result.ratePlan.id);
  }
  async function saveNightlyRate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(`/rate-plans/${encodeURIComponent(ratePlanId)}/nightly-rates`, "PUT", { from: rateFrom, to: rateTo, nightlyRate });
  }
  async function initializeInventory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate("/inventory/initialize", "POST", { roomTypeId: inventoryTypeId, from: inventoryFrom, to: inventoryTo, allotment: Number(allotment), reason }, true);
  }
  async function adjustInventory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Number(allotmentDelta) === 0 && Number(outDelta) === 0) { setError(text.deltasError); return; }
    await mutate("/inventory/adjustments", "POST", { roomTypeId: inventoryTypeId, date: inventoryDate, allotmentDelta: Number(allotmentDelta), outOfServiceDelta: Number(outDelta), reason }, true);
  }

  return <div className="min-w-0 max-w-full space-y-6 [overflow-wrap:anywhere]" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
    <header className="space-y-2"><h1 className="text-2xl font-bold">{text.title}</h1><h2 className="text-lg font-semibold">{propertyName}</h2><p className="text-xs text-muted-foreground">{propertyTimezone}</p></header>
    <section className="rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{text.range}</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm"><span>{text.from}</span><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>{text.to}</span><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <Button type="button" variant="outline" disabled={loading} onClick={() => void reload()}>{text.load}</Button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{text.errorPrefix} {error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-green-700">{notice}</p> : null}
      {isLoading ? <p className="mt-3 text-sm" role="status">{text.loading}</p> : null}
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{text.roomTypes}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">{(activeData?.roomTypes ?? []).map((item) => <li key={item.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border p-3"><span className="min-w-0 break-all">{item.name} <span className="text-xs text-muted-foreground">({item.slug})</span></span><Button type="button" variant="outline" size="sm" onClick={() => startTypeEdit(item)}>{text.edit}</Button></li>)}</ul>
      {!activeData?.roomTypes.length ? <p className="text-sm text-muted-foreground">{text.none}</p> : null}
      <form onSubmit={saveType} className="grid gap-3 sm:grid-cols-2">
        {!editingTypeId ? <Field label={text.slug} value={typeSlug} setValue={setTypeSlug} required /> : null}
        <Field label={text.name} value={typeName} setValue={setTypeName} required />
        <Field label={text.description} value={typeDescription} setValue={setTypeDescription} />
        <Field label={text.adults} value={typeAdults} setValue={setTypeAdults} type="number" required />
        <Field label={text.children} value={typeChildren} setValue={setTypeChildren} type="number" required />
        <Field label={text.occupancy} value={typeOccupancy} setValue={setTypeOccupancy} type="number" required />
        <label className="space-y-1 text-sm"><span>{text.bedKind}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={typeBedKind} onChange={(event) => setTypeBedKind(event.target.value)}><option value="single">{text.bedKinds.single}</option><option value="double">{text.bedKinds.double}</option><option value="queen">{text.bedKinds.queen}</option><option value="king">{text.bedKinds.king}</option><option value="sofa">{text.bedKinds.sofa}</option><option value="bunk">{text.bedKinds.bunk}</option><option value="crib">{text.bedKinds.crib}</option></select></label>
        <Field label={text.bedCount} value={typeBedCount} setValue={setTypeBedCount} type="number" required />
        {editingTypeId && preservedBeds.length ? <p className="text-xs text-muted-foreground sm:col-span-2">{text.beds}: {preservedBeds.map((bed) => `${String(bed.kind ?? "bed")} × ${String(bed.count ?? 1)}`).join(", ")}</p> : null}
        <div className="flex gap-2"><Button type="submit" disabled={busy || !typeName}>{editingTypeId ? text.update : text.add}</Button>{editingTypeId ? <Button type="button" variant="outline" onClick={resetTypeForm}>{text.cancel}</Button> : null}</div>
      </form>
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{text.rooms}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{(activeData?.roomTypes ?? []).map((type) => <div key={type.id} className="rounded-lg border p-3"><h3 className="font-medium">{type.name}</h3><ul className="mt-2 space-y-2 text-sm">{type.rooms.map((room) => <li key={room.id} className="flex items-center justify-between gap-2"><span>{room.code}{room.floor ? ` · ${room.floor}` : ""}{room.isOutOfService ? ` · ${text.unavailable}` : ""}</span><Button type="button" size="sm" variant="ghost" onClick={() => startRoomEdit(room, type.id)}>{text.edit}</Button></li>)}</ul>{type.rooms.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{text.none}</p> : null}</div>)}</div>
      <form onSubmit={saveRoom} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.roomType}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={roomTypeId} onChange={(event) => setRoomTypeId(event.target.value)} required>{(activeData?.roomTypes ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <Field label={text.code} value={roomCode} setValue={setRoomCode} required />
        <Field label={text.floor} value={roomFloor} setValue={setRoomFloor} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roomUnavailable} onChange={(event) => setRoomUnavailable(event.target.checked)} />{text.unavailable}</label>
        {editingRoomId ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roomActive} onChange={(event) => setRoomActive(event.target.checked)} />{text.active}</label> : null}
        <div className="flex gap-2"><Button type="submit" disabled={busy || !roomTypeId || !roomCode}>{editingRoomId ? text.update : text.add}</Button>{editingRoomId ? <Button type="button" variant="outline" onClick={resetRoomForm}>{text.cancel}</Button> : null}</div>
      </form>
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{text.rates}</h2>
      <ul className="space-y-2 text-sm">{(activeData?.ratePlans ?? []).map((plan) => <li key={plan.id} className="rounded-lg border p-3">{plan.name} · {plan.baseNightlyRate} {plan.currency}{plan.validFrom || plan.validTo ? <p className="mt-1 text-xs text-muted-foreground">{text.planValidity}: {plan.validFrom ?? "—"} – {plan.validTo ?? "—"}</p> : null}<ul className="mt-2 text-xs text-muted-foreground">{plan.nightlyRates.map((rate) => <li key={rate.id}>{rate.from} – {rate.to}: {rate.nightlyRate ?? "—"}</li>)}</ul></li>)}</ul>
      <form onSubmit={createRatePlan} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.roomType}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={planTypeId} onChange={(event) => setPlanTypeId(event.target.value)} required>{(activeData?.roomTypes ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <Field label={text.planCode} value={planCode} setValue={setPlanCode} required /><Field label={text.planName} value={planName} setValue={setPlanName} required /><Field label={text.baseRate} value={baseRate} setValue={setBaseRate} type="number" required />
        <Button type="submit" disabled={busy || !planTypeId || !baseRate}>{text.createPlan}</Button>
      </form>
      <form onSubmit={saveNightlyRate} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.planName}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={ratePlanId} onChange={(event) => setRatePlanId(event.target.value)} required>{(activeData?.ratePlans ?? []).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.code}</option>)}</select></label>
        <Field label={text.from} value={rateFrom} setValue={setRateFrom} type="date" required /><Field label={text.to} value={rateTo} setValue={setRateTo} type="date" required /><Field label={text.nightlyRate} value={nightlyRate} setValue={setNightlyRate} type="number" required />
        <Button type="submit" disabled={busy || !ratePlanId || !nightlyRate}>{text.saveNightly}</Button>
      </form>
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{text.inventory}</h2>
      <form onSubmit={initializeInventory} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.roomType}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={inventoryTypeId} onChange={(event) => setInventoryTypeId(event.target.value)} required>{(activeData?.roomTypes ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <Field label={text.from} value={inventoryFrom} setValue={setInventoryFrom} type="date" required /><Field label={text.to} value={inventoryTo} setValue={setInventoryTo} type="date" required /><Field label={text.allotment} value={allotment} setValue={setAllotment} type="number" required /><Field label={text.reason} value={reason} setValue={setReason} required />
        <Button type="submit" disabled={busy || !inventoryTypeId}>{text.initialize}</Button>
      </form>
      <form onSubmit={adjustInventory} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.roomType}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={inventoryTypeId} onChange={(event) => setInventoryTypeId(event.target.value)} required>{(activeData?.roomTypes ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <Field label={text.date} value={inventoryDate} setValue={setInventoryDate} type="date" required /><Field label={text.allotmentDelta} value={allotmentDelta} setValue={setAllotmentDelta} type="number" required /><Field label={text.outDelta} value={outDelta} setValue={setOutDelta} type="number" required /><Field label={text.reason} value={reason} setValue={setReason} required />
        <Button type="submit" disabled={busy || !inventoryTypeId || (Number(allotmentDelta) === 0 && Number(outDelta) === 0)}>{text.adjust}</Button>
      </form>
      <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr><th className="p-2">{text.date}</th><th className="p-2">{text.roomType}</th><th className="p-2">{text.allotment}</th><th className="p-2">{text.booked}</th><th className="p-2">{text.held}</th><th className="p-2">{text.oos}</th><th className="p-2">{text.available}</th></tr></thead><tbody>{(activeData?.inventory ?? []).map((night) => <tr key={night.id} className="border-t"><td className="p-2" dir="ltr">{night.date}</td><td className="p-2">{activeData?.roomTypes.find((item) => item.id === night.roomTypeId)?.name ?? "—"}</td><td className="p-2">{night.allotment}</td><td className="p-2">{night.booked}</td><td className="p-2">{night.held}</td><td className="p-2">{night.outOfService}</td><td className="p-2">{night.available}</td></tr>)}</tbody></table></div>
      {!activeData?.inventory.length ? <p className="text-sm text-muted-foreground">{text.none}</p> : null}
    </section>

    <HotelBookingSandbox key={`${organizationId}:${propertyId}`} organizationId={organizationId} propertyId={propertyId} locale={locale} mode="reception" />
    {guestPortalEnabled ? <HotelRequestReception organizationId={organizationId} propertyId={propertyId} locale={locale} canConfigure={canConfigureGuestPortal} /> : null}
  </div>;
}

function Field({ label, value, setValue, type = "text", required = false }: {
  label: string; value: string; setValue: (value: string) => void; type?: string; required?: boolean;
}) {
  const id = useId();
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} step={type === "number" ? "1" : undefined} value={value} onChange={(event) => setValue(event.target.value)} required={required} /></div>;
}
