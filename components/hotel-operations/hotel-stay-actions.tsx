"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isPropertyDate } from "@/lib/hotel/domain/property-calendar";

export type AmendmentPreview = {
  checkIn: string; checkOut: string; previousTotal: string; total: string; currency: string;
  version: number; added: string[]; removed: string[];
};
type Dates = { checkIn: string; checkOut: string };
type Room = { id: string; code: string; roomTypeId: string };
const copy = {
  fa: { title: "تغییر اقامت", arrival: "ورود", departure: "خروج", preview: "محاسبه مبلغ جدید", current: "مبلغ قبلی", revised: "مبلغ جدید", confirm: "تأیید و ثبت تغییر", hint: "نرخ شب‌های مشترک حفظ می‌شود. تغییر اقامت پرداخت‌دار در بخش مالی انجام خواهد شد.", added: "شب اضافه", removed: "شب حذف", move: "انتقال اتاق", target: "اتاق مقصد", select: "انتخاب کنید", moveConfirm: "تأیید انتقال", moveHint: "فقط شب جاری و شب‌های بعد منتقل می‌شوند.", invalid: "تاریخ معتبر و مجاز انتخاب کنید.", toman: "تومان" },
  en: { title: "Amend stay", arrival: "Check-in", departure: "Check-out", preview: "Preview revised price", current: "Previous total", revised: "New total", confirm: "Confirm amendment", hint: "Retained night rates stay unchanged. Stays with payment activity require financial reconciliation.", added: "Added nights", removed: "Removed nights", move: "Move room", target: "Destination room", select: "Select", moveConfirm: "Confirm room move", moveHint: "Only today and future nights will move.", invalid: "Select valid, permitted dates.", toman: "Toman" },
  ar: { title: "تعديل الإقامة", arrival: "الوصول", departure: "المغادرة", preview: "معاينة السعر الجديد", current: "المبلغ السابق", revised: "المبلغ الجديد", confirm: "تأكيد التعديل", hint: "تبقى أسعار الليالي المشتركة دون تغيير. الإقامات المرتبطة بدفعات تحتاج إلى تسوية مالية.", added: "ليالٍ مضافة", removed: "ليالٍ محذوفة", move: "نقل الغرفة", target: "الغرفة البديلة", select: "اختر", moveConfirm: "تأكيد النقل", moveHint: "سيتم نقل الليلة الحالية والليالي اللاحقة فقط.", invalid: "اختر تواريخ صحيحة ومسموحة.", toman: "تومان" },
} as const;

export function HotelStayActions({ locale, busy, status, today, checkIn, checkOut, currentRoomId, roomTypeId, rooms, canAmend, onPreview, onApply, onMove }: {
  locale: string; busy: boolean; status: string; today: string; checkIn: string; checkOut: string;
  currentRoomId: string; roomTypeId?: string; rooms: Room[]; canAmend: boolean;
  onPreview: (dates: Dates, receive: (preview: AmendmentPreview) => void) => void;
  onApply: (dates: Dates, preview: AmendmentPreview, done: () => void) => void;
  onMove: (roomId: string, expectedRoomId: string) => void;
}) {
  const t = copy[locale as keyof typeof copy] ?? copy.fa;
  const [dates, setDates] = useState<Dates>({ checkIn, checkOut });
  const [preview, setPreview] = useState<AmendmentPreview | null>(null);
  const [target, setTarget] = useState("");
  const checkedIn = status === "CHECKED_IN";
  const canMove = checkedIn && Boolean(roomTypeId && currentRoomId) && checkIn <= today && today < checkOut;
  const alternatives = rooms.filter(room => room.roomTypeId === roomTypeId && room.id !== currentRoomId);
  const valid = isPropertyDate(dates.checkIn) && isPropertyDate(dates.checkOut) && dates.checkIn < dates.checkOut &&
    (checkedIn ? dates.checkIn === checkIn && checkIn <= today && today < checkOut && dates.checkOut > today : dates.checkIn >= today);
  const changed = dates.checkIn !== checkIn || dates.checkOut !== checkOut;
  const money = (value: string) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en").format(Number(value));
  if (!canAmend && !canMove) return null;
  return <div className="space-y-2">
    {canAmend ? <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium text-sm">{t.title}</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{t.arrival}</span><Input type="date" value={dates.checkIn} min={checkedIn ? checkIn : today} disabled={busy || checkedIn} onChange={e => { setDates(previous => ({ ...previous, checkIn: e.target.value })); setPreview(null); }} /></label>
        <label className="space-y-1 text-sm"><span>{t.departure}</span><Input type="date" value={dates.checkOut} min={checkedIn ? today : dates.checkIn} disabled={busy} onChange={e => { setDates(previous => ({ ...previous, checkOut: e.target.value })); setPreview(null); }} /></label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t.hint}</p>
      {!valid ? <p className="mt-2 text-sm text-destructive" role="status">{t.invalid}</p> : null}
      <Button className="mt-2" type="button" size="sm" variant="outline" disabled={busy || !valid || !changed} onClick={() => { setPreview(null); onPreview(dates, setPreview); }}>{t.preview}</Button>
      {preview && preview.checkIn === dates.checkIn && preview.checkOut === dates.checkOut ? <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-2 text-sm" role="status">
        <div>{t.current}: <bdi>{money(preview.previousTotal)}</bdi> {t.toman}</div>
        <div className="font-medium">{t.revised}: <bdi>{money(preview.total)}</bdi> {t.toman}</div>
        <div>{t.added}: {preview.added.length} · {t.removed}: {preview.removed.length}</div>
        <Button type="button" size="sm" disabled={busy || !valid || !changed} onClick={() => onApply(dates, preview, () => setPreview(null))}>{t.confirm}</Button>
      </div> : null}
    </details> : null}
    {canMove ? <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium text-sm">{t.move}</summary>
      <p className="mt-2 text-xs text-muted-foreground">{t.moveHint}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2"><label className="space-y-1 text-sm"><span>{t.target}</span><select className="block h-9 rounded-md border bg-background px-2" value={target} disabled={busy} onChange={e => setTarget(e.target.value)}><option value="">{t.select}</option>{alternatives.map(room => <option key={room.id} value={room.id}>{room.code}</option>)}</select></label>
      <Button type="button" size="sm" disabled={busy || !alternatives.some(room => room.id === target)} onClick={() => onMove(target, currentRoomId)}>{t.moveConfirm}</Button></div>
    </details> : null}
  </div>;
}
