"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DraftPromotionForm,
  DraftPromotionStatus,
  completeDraftPromotion,
  draftActionsEnabled,
  promotionLabels,
  promotionMessageForStatus,
  promotionPayload,
  requestDraftPromotion,
  type PromotionRoomType,
} from "./draft-accommodation-promotion-ui";

const labels = {
  en: {
    title: "Draft accommodations", warning: "These records are provisional. They do not appear on the guest site or count toward bookable inventory.",
    loading: "Loading drafts…", empty: "There are no active drafts.", unavailable: "Drafts could not be loaded.",
    retry: "Reload drafts", create: "New draft", edit: "Edit", archive: "Archive", cancel: "Cancel", save: "Save draft",
    confirmArchive: "Archive this draft?", archived: "Draft archived.", saved: "Draft saved.",
    forbidden: "You do not have access to manage these drafts.",
    conflict: "This draft changed or its temporary code is already in use. Reload the list to check the latest records.",
    invalid: "Check the draft details and try again.", failed: "The change could not be saved.",
    unknown: "Unknown", leaveBlank: "Leave fields blank where details are unknown.",
    temporaryCode: "Temporary code", category: "Category", floor: "Floor", layout: "Layout", description: "Description",
    estimatedMinGuests: "Estimated minimum guests", estimatedMaxGuests: "Estimated maximum guests",
    maxAdults: "Verified adult limit", maxChildren: "Verified child limit", maxOccupancy: "Verified total limit",
    beds: "Beds", bedType: "Bed type", bedCount: "Count", addBed: "Add bed type", removeBed: "Remove",
  },
  fa: {
    title: "پیش‌نویس واحدهای اقامتی", warning: "این اطلاعات موقت هستند. در سایت مهمان نمایش داده نمی‌شوند و در ظرفیت قابل رزرو محاسبه نمی‌شوند.",
    loading: "در حال بارگیری پیش‌نویس‌ها…", empty: "پیش‌نویس فعالی وجود ندارد.", unavailable: "بارگیری پیش‌نویس‌ها انجام نشد.",
    retry: "بارگیری دوباره", create: "پیش‌نویس جدید", edit: "ویرایش", archive: "بایگانی", cancel: "انصراف", save: "ذخیره پیش‌نویس",
    confirmArchive: "این پیش‌نویس بایگانی شود؟", archived: "پیش‌نویس بایگانی شد.", saved: "پیش‌نویس ذخیره شد.",
    forbidden: "به مدیریت این پیش‌نویس‌ها دسترسی ندارید.",
    conflict: "پیش‌نویس تغییر کرده یا کد موقت تکراری است. برای دیدن اطلاعات فعلی فهرست را دوباره بارگیری کنید.",
    invalid: "اطلاعات پیش‌نویس را بررسی کنید و دوباره تلاش کنید.", failed: "ذخیره تغییر انجام نشد.",
    unknown: "نامشخص", leaveBlank: "اگر جزئیاتی مشخص نیست، فیلد مربوط را خالی بگذارید.",
    temporaryCode: "کد موقت", category: "دسته‌بندی", floor: "طبقه", layout: "چیدمان", description: "توضیحات",
    estimatedMinGuests: "حداقل تخمینی مهمان", estimatedMaxGuests: "حداکثر تخمینی مهمان",
    maxAdults: "حداکثر تأییدشده بزرگسال", maxChildren: "حداکثر تأییدشده کودک", maxOccupancy: "ظرفیت کل تأییدشده",
    beds: "تخت‌ها", bedType: "نوع تخت", bedCount: "تعداد", addBed: "افزودن نوع تخت", removeBed: "حذف",
  },
  ar: {
    title: "مسودات وحدات الإقامة", warning: "هذه السجلات مؤقتة. لا تظهر للضيوف ولا تُحتسب ضمن الوحدات القابلة للحجز.",
    loading: "جارٍ تحميل المسودات…", empty: "لا توجد مسودات نشطة.", unavailable: "تعذّر تحميل المسودات.",
    retry: "إعادة تحميل المسودات", create: "مسودة جديدة", edit: "تعديل", archive: "أرشفة", cancel: "إلغاء", save: "حفظ المسودة",
    confirmArchive: "هل تريد أرشفة هذه المسودة؟", archived: "تمت أرشفة المسودة.", saved: "تم حفظ المسودة.",
    forbidden: "ليس لديك صلاحية إدارة هذه المسودات.",
    conflict: "تغيرت المسودة أو أن الرمز المؤقت مستخدم بالفعل. أعد تحميل القائمة للتحقق من أحدث السجلات.",
    invalid: "تحقق من تفاصيل المسودة وحاول مرة أخرى.", failed: "تعذّر حفظ التغيير.",
    unknown: "غير معروف", leaveBlank: "اترك الحقول فارغة عندما تكون التفاصيل غير معروفة.",
    temporaryCode: "الرمز المؤقت", category: "الفئة", floor: "الطابق", layout: "التوزيع", description: "الوصف",
    estimatedMinGuests: "الحد الأدنى التقديري للضيوف", estimatedMaxGuests: "الحد الأقصى التقديري للضيوف",
    maxAdults: "الحد المؤكد للبالغين", maxChildren: "الحد المؤكد للأطفال", maxOccupancy: "السعة الإجمالية المؤكدة",
    beds: "الأسرّة", bedType: "نوع السرير", bedCount: "العدد", addBed: "إضافة نوع سرير", removeBed: "إزالة",
  },
} as const;

export function hotelDraftLabels(locale: string) {
  return { ...(locale === "en" || locale === "ar" ? labels[locale] : labels.fa), ...promotionLabels(locale) };
}

const occupancyFields = ["estimatedMinGuests", "estimatedMaxGuests", "maxAdults", "maxChildren", "maxOccupancy"] as const;
type OccupancyField = typeof occupancyFields[number];
type Draft = Record<OccupancyField, number | null> & {
  id: string;
  version: number;
  temporaryCode: string;
  category: string;
  floor: string | null;
  layout: string | null;
  description: string | null;
  beds: Array<{ type: string; count: number }> | null;
  promotedRoomId: string | null;
  promotedAt: string | null;
};

type Form = Record<OccupancyField, string> & {
  temporaryCode: string;
  category: string;
  floor: string;
  layout: string;
  description: string;
  beds: Array<{ key: number; type: string; count: string }>;
};

function toForm(draft?: Draft): Form {
  return {
    temporaryCode: draft?.temporaryCode ?? "",
    category: draft?.category ?? "",
    floor: draft?.floor ?? "",
    layout: draft?.layout ?? "",
    description: draft?.description ?? "",
    estimatedMinGuests: String(draft?.estimatedMinGuests ?? ""),
    estimatedMaxGuests: String(draft?.estimatedMaxGuests ?? ""),
    maxAdults: String(draft?.maxAdults ?? ""),
    maxChildren: String(draft?.maxChildren ?? ""),
    maxOccupancy: String(draft?.maxOccupancy ?? ""),
    beds: draft?.beds?.map((bed, key) => ({ ...bed, key, count: String(bed.count) })) ?? [],
  };
}

function toPayload(form: Form) {
  const count = (value: string) => value === "" ? null : Number(value);
  return {
    temporaryCode: form.temporaryCode.trim(),
    category: form.category.trim(),
    floor: form.floor.trim() || null,
    layout: form.layout.trim() || null,
    description: form.description.trim() || null,
    estimatedMinGuests: count(form.estimatedMinGuests),
    estimatedMaxGuests: count(form.estimatedMaxGuests),
    maxAdults: count(form.maxAdults),
    maxChildren: count(form.maxChildren),
    maxOccupancy: count(form.maxOccupancy),
    beds: form.beds.length ? form.beds.map(({ type, count }) => ({ type: type.trim(), count: Number(count) })) : null,
  };
}

export function HotelDraftAccommodations({ organizationId, propertyId, locale }: {
  organizationId: string;
  propertyId: string;
  locale: string;
}) {
  const text = useMemo(() => hotelDraftLabels(locale), [locale]);
  const endpoint = `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/draft-accommodations`;
  const operationsEndpoint = `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/operations`;
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [editor, setEditor] = useState<{ draft: Draft | null; form: Form } | null>(null);
  const [archive, setArchive] = useState<Draft | null>(null);
  const [promotionDraft, setPromotionDraft] = useState<Draft | null>(null);
  const [promotionRoomTypes, setPromotionRoomTypes] = useState<PromotionRoomType[] | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionError, setPromotionError] = useState(false);
  const [promotedRoomCodes, setPromotedRoomCodes] = useState<Record<string, string>>({});
  const [promotionRoomTypeId, setPromotionRoomTypeId] = useState("");
  const [physicalRoomCode, setPhysicalRoomCode] = useState("");
  const [confirmPhysicalRoomCode, setConfirmPhysicalRoomCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean; conflict?: boolean } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          if (!controller.signal.aborted) {
            setLoadError(response.status === 401 || response.status === 403 ? text.forbidden : text.unavailable);
          }
          return;
        }
        const result: { drafts: Draft[] } = await response.json();
        if (!controller.signal.aborted) setDrafts(result.drafts);
      } catch {
        if (!controller.signal.aborted) setLoadError(text.unavailable);
      }
    }
    void load();
    return () => controller.abort();
  }, [endpoint, reload, text]);

  useEffect(() => {
    if (!promotionDraft) return;
    const controller = new AbortController();
    async function loadRoomTypes() {
      setPromotionLoading(true);
      setPromotionError(false);
      setPromotionRoomTypes(null);
      const from = new Date();
      from.setUTCHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      const query = new URLSearchParams({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
      try {
        const response = await fetch(`${operationsEndpoint}?${query}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("room type request failed");
        const result: { roomTypes: PromotionRoomType[] } = await response.json();
        if (!controller.signal.aborted) {
          setPromotionRoomTypes(result.roomTypes);
          setPromotionRoomTypeId("");
        }
      } catch {
        if (!controller.signal.aborted) setPromotionError(true);
      } finally {
        if (!controller.signal.aborted) setPromotionLoading(false);
      }
    }
    void loadRoomTypes();
    return () => controller.abort();
  }, [operationsEndpoint, promotionDraft, text]);

  function openEditor(draft?: Draft) {
    setArchive(null);
    setMessage(null);
    setEditor({ draft: draft ?? null, form: toForm(draft) });
  }

  function updateForm<K extends keyof Form>(key: K, value: Form[K]) {
    setEditor((current) => current && { ...current, form: { ...current.form, [key]: value } });
  }

  function reloadDrafts() {
    setEditor(null);
    setArchive(null);
    setPromotionDraft(null);
    setMessage(null);
    setDrafts(null);
    setLoadError("");
    setReload((current) => current + 1);
  }

  async function mutate(url: string, method: "POST" | "PATCH", data: unknown, mode: "draft" | "archive" | "promotion" = "draft") {
    setBusy(true);
    setMessage(null);
    try {
      const response = mode === "promotion"
        ? await requestDraftPromotion(url, data as ReturnType<typeof promotionPayload>)
        : await (async () => {
          const raw = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
          return { ok: raw.ok, status: raw.status, body: raw.ok ? await raw.json() as { draft: Draft } : null };
        })();
      if (!response.ok || !response.body) {
        setMessage(promotionMessageForStatus(response.status, text));
        return;
      }
      if (mode === "promotion") {
        completeDraftPromotion(response.body as { draft: Draft; room: { id: string; code: string } }, text, {
          rememberRoomCode: (draftId, roomCode) => setPromotedRoomCodes((current) => ({ ...current, [draftId]: roomCode })),
          refreshDrafts: () => {
            setPromotionDraft(null);
            setPromotionRoomTypes(null);
            setEditor(null);
            setArchive(null);
            setDrafts(null);
            setLoadError("");
            setReload((current) => current + 1);
          },
          notify: (message) => setMessage({ text: message }),
        });
        return;
      }
      const { draft } = response.body as { draft: Draft };
      setDrafts((current) => {
        const remaining = (current ?? []).filter((item) => item.id !== draft.id);
        return mode === "archive" ? remaining : [...remaining, draft].sort((a, b) => a.temporaryCode.localeCompare(b.temporaryCode, locale));
      });
      setEditor(null);
      setArchive(null);
      setMessage({ text: mode === "archive" ? text.archived : text.saved });
    } catch {
      setMessage({ text: text.failed, error: true });
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    const { draft, form } = editor;
    const data = toPayload(form);
    if ((data.estimatedMinGuests === null) !== (data.estimatedMaxGuests === null)
      || (data.estimatedMinGuests !== null && data.estimatedMaxGuests !== null && data.estimatedMinGuests > data.estimatedMaxGuests)
      || (data.maxOccupancy !== null && data.maxOccupancy < Math.max(data.maxAdults ?? 0, data.maxChildren ?? 0))) {
      setMessage({ text: text.invalid, error: true });
      return;
    }
    void (draft
      ? mutate(`${endpoint}/${encodeURIComponent(draft.id)}`, "PATCH", { ...data, version: draft.version })
      : mutate(endpoint, "POST", data));
  }

  function openPromotion(draft: Draft) {
    setEditor(null);
    setArchive(null);
    setMessage(null);
    setPromotionDraft(draft);
    setPromotionRoomTypeId("");
    setPhysicalRoomCode("");
    setConfirmPhysicalRoomCode(false);
  }

  function promote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!promotionDraft || busy) return;
    const payload = promotionPayload(promotionDraft.version, promotionRoomTypeId, physicalRoomCode, confirmPhysicalRoomCode);
    if (!payload) {
      setMessage({ text: text.roomCodeRequired, error: true });
      return;
    }
    void mutate(`${endpoint}/${encodeURIComponent(promotionDraft.id)}/promote`, "POST", payload, "promotion");
  }

  const form = editor?.form;
  return (
    <section dir={locale === "en" ? "ltr" : "rtl"} className="space-y-4 rounded-xl border bg-card p-4" aria-labelledby="hotel-draft-accommodations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="hotel-draft-accommodations" className="text-lg font-semibold">{text.title}</h2>
        {drafts && !editor && !archive && !promotionDraft && <Button type="button" onClick={() => openEditor()}>{text.create}</Button>}
      </div>
      <p className="rounded-md bg-muted p-3 text-sm">{text.warning}</p>
      {loadError && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{loadError}</p>
        <Button type="button" variant="outline" onClick={reloadDrafts}>{text.retry}</Button></div>}
      {!drafts && !loadError && <p role="status" className="text-sm">{text.loading}</p>}
      {message && <div className="space-y-2">
        <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-destructive" : "text-sm"}>{message.text}</p>
        {message.conflict && <Button type="button" variant="outline" onClick={reloadDrafts}>{text.retry}</Button>}
      </div>}
      {drafts?.length === 0 && <p className="text-sm text-muted-foreground">{text.empty}</p>}
      {form && <form onSubmit={save} className="rounded-md border p-3">
        <fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy}>
          <legend className="mb-2 font-medium">{editor.draft ? <>{text.edit} · <bdi>{editor.draft.temporaryCode}</bdi></> : text.create}</legend>
          <p className="text-sm text-muted-foreground sm:col-span-2">{text.leaveBlank}</p>
          {([
            ["temporaryCode", 80, true], ["category", 100, true], ["floor", 80, false], ["layout", 500, false],
          ] as const).map(([key, maxLength, required]) => <label key={key} className="space-y-1 text-sm">
            <span>{text[key]}</span><Input value={form[key]} onChange={(event) => updateForm(key, event.target.value)} maxLength={maxLength} required={required} />
          </label>)}
          <label className="space-y-1 text-sm sm:col-span-2">
            <span>{text.description}</span><Textarea value={form.description} maxLength={4000} onChange={(event) => updateForm("description", event.target.value)} />
          </label>
          {occupancyFields.map((key) => <label key={key} className="space-y-1 text-sm">
            <span>{text[key]}</span><Input type="number" min={key === "maxChildren" ? 0 : 1} max={100} placeholder={text.unknown} value={form[key]} onChange={(event) => updateForm(key, event.target.value)} />
          </label>)}
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">{text.beds}</legend>
            {!form.beds.length && <p className="text-sm text-muted-foreground">{text.unknown}</p>}
            {form.beds.map((bed) => <div key={bed.key} className="flex flex-wrap items-end gap-2">
              <label className="min-w-32 flex-1 space-y-1 text-sm"><span>{text.bedType}</span>
                <Input value={bed.type} maxLength={80} required onChange={(event) => updateForm("beds", form.beds.map((item) => item.key === bed.key ? { ...item, type: event.target.value } : item))} />
              </label>
              <label className="w-24 space-y-1 text-sm"><span>{text.bedCount}</span>
                <Input type="number" min={1} max={100} value={bed.count} required onChange={(event) => updateForm("beds", form.beds.map((item) => item.key === bed.key ? { ...item, count: event.target.value } : item))} />
              </label>
              <Button type="button" variant="ghost" onClick={() => updateForm("beds", form.beds.filter((item) => item.key !== bed.key))}>{text.removeBed}</Button>
            </div>)}
            <Button type="button" variant="outline" disabled={form.beds.length >= 20} onClick={() => updateForm("beds", [...form.beds, {
              key: (form.beds.at(-1)?.key ?? -1) + 1, type: "", count: "",
            }])}>{text.addBed}</Button>
          </fieldset>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit">{text.save}</Button>
            <Button type="button" variant="outline" onClick={() => { setEditor(null); setMessage(null); }}>{text.cancel}</Button>
          </div>
        </fieldset>
      </form>}
      {promotionDraft && <DraftPromotionForm text={text} cancelLabel={text.cancel} temporaryCode={promotionDraft.temporaryCode} roomTypes={promotionRoomTypes}
        loading={promotionLoading} loadError={promotionError} roomTypeId={promotionRoomTypeId} physicalRoomCode={physicalRoomCode}
        confirmed={confirmPhysicalRoomCode} busy={busy} onRoomType={setPromotionRoomTypeId} onCode={setPhysicalRoomCode}
        onConfirmation={setConfirmPhysicalRoomCode} onSubmit={promote} onCancel={() => { setPromotionDraft(null); setPromotionRoomTypes(null); setMessage(null); }} />}
      {!!drafts?.length && <ul className="divide-y rounded-md border">
        {drafts.map((draft) => <li key={draft.id} className="space-y-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 break-words"><bdi className="font-medium">{draft.temporaryCode}</bdi> · {draft.category}</div>
            <DraftPromotionStatus text={text} promotedRoomId={draft.promotedRoomId} promotedAt={draft.promotedAt} roomCode={promotedRoomCodes[draft.id]} />
            {draftActionsEnabled(draft.promotedRoomId) && <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy || !!editor || !!archive || !!promotionDraft} onClick={() => openEditor(draft)}>{text.edit}</Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy || !!editor || !!archive || !!promotionDraft} onClick={() => { setArchive(draft); setMessage(null); }}>{text.archive}</Button>
              <Button type="button" variant="outline" size="sm" disabled={busy || !!editor || !!archive || !!promotionDraft} onClick={() => openPromotion(draft)}>{text.promote}</Button>
            </div>}
          </div>
          {draft.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{draft.description}</p>}
          {archive?.id === draft.id && <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{text.confirmArchive}</p>
            <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => {
              void mutate(`${endpoint}/${encodeURIComponent(draft.id)}/archive`, "POST", { version: draft.version }, "archive");
            }}>{text.archive}</Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setArchive(null); setMessage(null); }}>{text.cancel}</Button>
          </div>}
        </li>)}
      </ul>}
    </section>
  );
}
