import type { FormEvent } from "react";

const promotionText = {
  en: {
    provisional: "Active provisional draft", promoted: "Promoted to operational room", promote: "Promote to operational room",
    promotionTitle: "Promote accommodation", roomType: "Active room type", selectRoomType: "Select a room type", physicalRoomCode: "Real physical room code",
    confirmPhysicalRoomCode: "I confirm this is the real, verified physical room code.", submitPromotion: "Create operational room",
    promotionWarning: "The room will start OUT OF SERVICE and will not be available for booking until an authorized manager changes its operational status.",
    promotedSuccess: "Operational room created and set OUT OF SERVICE:", promotedRoom: "Operational room", promotedRoomId: "Operational room ID",
    alreadyPromoted: "This draft has already been promoted. Editing, archiving and promotion are disabled.",
    roomTypesLoading: "Loading active room types…", noActiveRoomTypes: "No active room types are available for this property.", roomTypesFailed: "Active room types could not be loaded.",
    roomCodeRequired: "Enter a real physical room code and confirm that it is verified.",
  },
  fa: {
    provisional: "پیش‌نویس موقت فعال", promoted: "تبدیل‌شده به اتاق عملیاتی", promote: "تبدیل به اتاق عملیاتی",
    promotionTitle: "تبدیل واحد اقامتی", roomType: "نوع اتاق فعال", selectRoomType: "نوع اتاق را انتخاب کنید", physicalRoomCode: "کد واقعی اتاق فیزیکی",
    confirmPhysicalRoomCode: "تأیید می‌کنم این کد واقعی و تأییدشده اتاق فیزیکی است.", submitPromotion: "ایجاد اتاق عملیاتی",
    promotionWarning: "اتاق در ابتدا خارج از سرویس خواهد بود و تا تغییر وضعیت توسط مدیر مجاز، برای رزرو در دسترس نیست.",
    promotedSuccess: "اتاق عملیاتی ایجاد و خارج از سرویس شد:", promotedRoom: "اتاق عملیاتی", promotedRoomId: "شناسه اتاق عملیاتی",
    alreadyPromoted: "این پیش‌نویس قبلاً تبدیل شده است. ویرایش، بایگانی و تبدیل دوباره غیرفعال است.",
    roomTypesLoading: "در حال بارگیری انواع اتاق فعال…", noActiveRoomTypes: "نوع اتاق فعالی برای این ملک وجود ندارد.", roomTypesFailed: "بارگیری انواع اتاق فعال انجام نشد.",
    roomCodeRequired: "کد واقعی اتاق فیزیکی را وارد و تأیید کنید که بررسی شده است.",
  },
  ar: {
    provisional: "مسودة مؤقتة نشطة", promoted: "تمت ترقيتها إلى غرفة تشغيلية", promote: "ترقية إلى غرفة تشغيلية",
    promotionTitle: "ترقية وحدة الإقامة", roomType: "نوع غرفة نشط", selectRoomType: "اختر نوع الغرفة", physicalRoomCode: "رمز الغرفة الفعلية الحقيقي",
    confirmPhysicalRoomCode: "أؤكد أن هذا هو رمز الغرفة الفعلية الحقيقي والمعتمد.", submitPromotion: "إنشاء غرفة تشغيلية",
    promotionWarning: "ستبدأ الغرفة خارج الخدمة ولن تكون متاحة للحجز حتى يغيّر مدير مخوّل حالتها التشغيلية.",
    promotedSuccess: "تم إنشاء الغرفة التشغيلية ووضعها خارج الخدمة:", promotedRoom: "الغرفة التشغيلية", promotedRoomId: "معرّف الغرفة التشغيلية",
    alreadyPromoted: "تمت ترقية هذه المسودة بالفعل. تم تعطيل التعديل والأرشفة والترقية.",
    roomTypesLoading: "جارٍ تحميل أنواع الغرف النشطة…", noActiveRoomTypes: "لا توجد أنواع غرف نشطة لهذا العقار.", roomTypesFailed: "تعذّر تحميل أنواع الغرف النشطة.",
    roomCodeRequired: "أدخل رمز الغرفة الفعلية الحقيقي وأكد التحقق منه.",
  },
} as const;

export function promotionLabels(locale: string) {
  return locale === "en" || locale === "ar" ? promotionText[locale] : promotionText.fa;
}

export type PromotionLabels = ReturnType<typeof promotionLabels>;
export type PromotionRoomType = { id: string; name: string };

export function promotionPayload(version: number, roomTypeId: string, physicalRoomCode: string, confirmed: boolean) {
  if (!roomTypeId.trim() || !physicalRoomCode.trim() || !confirmed) return null;
  return { expectedVersion: version, roomTypeId, physicalRoomCode: physicalRoomCode.trim(), confirmPhysicalRoomCode: true as const };
}

export function draftActionsEnabled(promotedRoomId: string | null) {
  return promotedRoomId === null;
}

export async function requestDraftPromotion(endpoint: string, payload: ReturnType<typeof promotionPayload>, fetcher: typeof fetch = fetch) {
  if (!payload) return { ok: false as const, status: 422, body: null };
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok, status: response.status, body: response.ok ? await response.json() as { draft: { id: string }; room: { id: string; code: string } } : null };
  } catch {
    return { ok: false as const, status: 0, body: null };
  }
}

export function promotionMessageForStatus(status: number, text: Pick<PromotionLabels, never> & { conflict: string; invalid: string; forbidden: string; failed: string }) {
  if (status === 409 || status === 404) return { text: text.conflict, error: true, conflict: true };
  if (status === 400 || status === 422) return { text: text.invalid, error: true, conflict: false };
  if (status === 401 || status === 403) return { text: text.forbidden, error: true, conflict: false };
  return { text: text.failed, error: true, conflict: false };
}

export function completeDraftPromotion(
  result: { draft: { id: string }; room: { id: string; code: string } },
  text: PromotionLabels,
  effects: { rememberRoomCode: (draftId: string, roomCode: string) => void; refreshDrafts: () => void; notify: (message: string) => void },
) {
  effects.rememberRoomCode(result.draft.id, result.room.code);
  effects.refreshDrafts();
  effects.notify(`${text.promotedSuccess} ${result.room.code} (${result.room.id}). ${text.promotionWarning}`);
}

export function DraftPromotionForm({
  text, temporaryCode, roomTypes, loading, loadError, roomTypeId, physicalRoomCode, confirmed, busy,
  cancelLabel, onRoomType, onCode, onConfirmation, onSubmit, onCancel,
}: {
  text: PromotionLabels;
  temporaryCode: string;
  roomTypes: PromotionRoomType[] | null;
  loading: boolean;
  loadError: boolean;
  roomTypeId: string;
  physicalRoomCode: string;
  confirmed: boolean;
  busy: boolean;
  cancelLabel: string;
  onRoomType: (value: string) => void;
  onCode: (value: string) => void;
  onConfirmation: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return <form onSubmit={onSubmit} className="grid gap-3 rounded-md border p-3 sm:grid-cols-2" aria-label={text.promotionTitle}>
    <h3 className="font-medium sm:col-span-2">{text.promotionTitle} · <bdi>{temporaryCode}</bdi></h3>
    <p role="note" className="rounded-md bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2">{text.promotionWarning}</p>
    {loading && <p role="status" className="text-sm sm:col-span-2">{text.roomTypesLoading}</p>}
    {loadError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{text.roomTypesFailed}</p>}
    {roomTypes?.length === 0 && <p role="status" className="text-sm sm:col-span-2">{text.noActiveRoomTypes}</p>}
    {!!roomTypes?.length && <label className="min-w-0 space-y-1 text-sm">
      <span>{text.roomType}</span>
      <select className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={roomTypeId} onChange={(event) => onRoomType(event.target.value)} required>
        <option value="">{text.selectRoomType}</option>
        {roomTypes.map((roomType) => <option key={roomType.id} value={roomType.id}>{roomType.name}</option>)}
      </select>
    </label>}
    <label className="min-w-0 space-y-1 text-sm">
      <span>{text.physicalRoomCode}</span>
      <input className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={physicalRoomCode} onChange={(event) => onCode(event.target.value)} maxLength={64} autoComplete="off" required />
    </label>
    <label className="flex items-start gap-2 text-sm sm:col-span-2">
      <input type="checkbox" className="mt-1 size-4 shrink-0" checked={confirmed} onChange={(event) => onConfirmation(event.target.checked)} required />
      <span>{text.confirmPhysicalRoomCode}</span>
    </label>
    <div className="flex flex-wrap gap-2 sm:col-span-2">
      <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" disabled={busy || loading || loadError || !roomTypes?.length}>{text.submitPromotion}</button>
      <button type="button" className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
    </div>
  </form>;
}

export function DraftPromotionStatus({ text, promotedRoomId, promotedAt, roomCode }: {
  text: PromotionLabels;
  promotedRoomId: string | null;
  promotedAt: string | null;
  roomCode?: string;
}) {
  if (!promotedRoomId) return <span className="rounded-full bg-muted px-2 py-1 text-xs">{text.provisional}</span>;
  return <div className="space-y-1 rounded-md border p-3 text-sm">
    <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{text.promoted}</span>
    <p className="font-medium">{text.alreadyPromoted}</p>
    <p>{text.promotedRoomId}: <bdi>{promotedRoomId}</bdi></p>
    {roomCode && <p>{text.promotedRoom}: <bdi>{roomCode}</bdi></p>}
    {promotedAt && <p><bdi>{promotedAt}</bdi></p>}
    <p className="text-amber-800">{text.promotionWarning}</p>
  </div>;
}
