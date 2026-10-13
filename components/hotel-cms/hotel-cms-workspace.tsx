"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HotelWebsiteContent } from "@/lib/hotel/content/hotel-website-contract";
import {
  createHotelCmsApi,
  HotelCmsRequestError,
  type HotelCmsDraft,
  type HotelCmsHistory,
  type HotelCmsLocale,
  type HotelCmsMedia,
  type HotelCmsRevision,
  type HotelCmsScope,
} from "@/lib/hotel-cms/hotel-cms-api";
import { addFaqItem, addFeatureItem, addSection, blankDraft, checkDraftMinimum, localized, locales, setLocalized } from "@/lib/hotel-cms/hotel-cms-editor";
import styles from "./hotel-cms-workspace.module.css";

type CmsRole = "ADMIN" | "MANAGER" | "SUPER_ADMIN";
type Props = {
  /** These IDs must be obtained and authorized by a platform SERVER route. */
  scope: HotelCmsScope;
  role: CmsRole;
  propertyLabel: string;
};
const statusFa: Record<HotelCmsRevision["status"], string> = {
  DRAFT: "پیش‌نویس", IN_REVIEW: "در انتظار بررسی", APPROVED: "تأییدشده", REJECTED: "ردشده",
};
const localeNames: Record<HotelCmsLocale, string> = { fa: "فارسی", en: "English", ar: "العربية" };

function InlineField({ label, value, onChange, multiline = false, placeholder = "" }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string;
}) {
  return <label className={styles.field}><span>{label}</span>{multiline
    ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} />
    : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}</label>;
}

export function HotelCmsWorkspace({ scope, role, propertyLabel }: Props) {
  const organizationId = scope.organizationId;
  const propertyId = scope.propertyId;
  const api = useMemo(() => createHotelCmsApi({ organizationId, propertyId }), [organizationId, propertyId]);
  const [locale, setLocale] = useState<HotelCmsLocale>("fa");
  const [draft, setDraft] = useState<HotelCmsDraft>(() => blankDraft());
  const [revisions, setRevisions] = useState<HotelCmsRevision[]>([]);
  const [history, setHistory] = useState<HotelCmsHistory>({ reviews: [], publications: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview" | "history">("editor");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.preview>> | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const scopeKey = JSON.stringify([organizationId, propertyId]);
  const loading = loadedScope !== scopeKey;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const selected = revisions.find((revision) => revision.revisionId === selectedId) ?? null;
  const activePublication = revisions.flatMap((rev) => rev.publications.map((pub) => ({ ...pub, revisionNumber: rev.revisionNumber }))).find((pub) => !pub.revokedAt) ?? null;

  const reload = useCallback(async (signal?: AbortSignal) => {
    const [items, activity] = await Promise.all([api.listRevisions(signal), api.history(signal)]);
    if (!signal?.aborted) { setRevisions(items); setHistory(activity); }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([api.listRevisions(controller.signal), api.history(controller.signal)]).then(([items, activity]) => {
      if (!controller.signal.aborted) {
        setRevisions(items);
        setHistory(activity);
        setLoadedScope(scopeKey);
      }
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "بارگذاری محتوا ممکن نشد.");
        setLoadedScope(scopeKey);
      }
    });
    return () => controller.abort();
  }, [api, scopeKey]);

  const update = (transform: (content: HotelWebsiteContent) => HotelWebsiteContent) => {
    setDraft((current) => ({ ...current, content: transform(current.content) }));
    setHasUnsavedChanges(true);
  };
  const updateMedia = (transform: (media: HotelCmsMedia[]) => HotelCmsMedia[]) => {
    setDraft((current) => ({ ...current, media: transform(current.media) }));
    setHasUnsavedChanges(true);
  };
  function resetMessages() { setError(""); setNotice(""); }
  async function perform(action: () => Promise<unknown>, success: string, post?: () => void) {
    resetMessages(); setBusy(true);
    try {
      await action();
      await reload();
      post?.();
      setNotice(success);
    } catch (cause) {
      setError(cause instanceof HotelCmsRequestError ? cause.message : cause instanceof Error ? cause.message : "عملیات انجام نشد.");
    } finally { setBusy(false); }
  }
  async function selectRevision(id: string) {
    if (hasUnsavedChanges && !window.confirm("تغییرات ذخیره‌نشده کنار گذاشته شود؟")) return;
    resetMessages(); setBusy(true);
    try {
      const version = await api.preview(id, locale);
      // Current eligible media is returned by C1B1; never silently discard
      // existing associations when preparing a new immutable revision.
      const media: HotelCmsMedia[] = version.media.map((item) => ({
        imageId: item.imageId, scope: item.scope, roomTypeId: item.roomTypeId,
        slot: item.slot as HotelCmsMedia["slot"], sortOrder: item.sortOrder,
        altText: item.altText,
      }));
      setDraft({ content: version.content, media });
      setSelectedId(id);
      setPreview(version);
      setHasUnsavedChanges(false);
      setTab("preview");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "پیش‌نمایش این نسخه در دسترس نیست.");
    } finally { setBusy(false); }
  }
  async function openPreview() {
    if (!selectedId) { setError("ابتدا یک نسخه ذخیره‌شده را انتخاب کنید."); return; }
    resetMessages(); setBusy(true);
    try {
      setPreview(await api.preview(selectedId, locale)); setTab("preview");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "پیش‌نمایش در دسترس نیست."); }
    finally { setBusy(false); }
  }
  const submitDraft = async () => {
    const invalid = checkDraftMinimum(draft);
    if (invalid) { setError(invalid); return; }
    await perform(async () => {
      const response = await api.createDraft(draft);
      setSelectedId(response.result.id);
    }, "نسخه جدید ذخیره شد. اکنون می‌توانید آن را برای بررسی ارسال کنید.", () => setHasUnsavedChanges(false));
  };
  const submitReview = () => {
    if (!selected || selected.status !== "DRAFT" || hasUnsavedChanges) return;
    void perform(() => api.submit(selected.revisionId, note.trim() || undefined), "نسخه برای بررسی ارسال شد.", () => setNote(""));
  };
  const decide = (decision: "APPROVED" | "REJECTED") => {
    if (!selected || selected.status !== "IN_REVIEW" || !isAdmin) return;
    void perform(() => api.decide(selected.revisionId, decision, note.trim() || undefined), decision === "APPROVED" ? "نسخه تأیید شد." : "نسخه رد شد.", () => setNote(""));
  };
  const publish = () => {
    if (!selected || selected.status !== "APPROVED" || activePublication || !isAdmin) return;
    void perform(() => api.publish(selected.revisionId), "نسخه تأییدشده منتشر شد.");
  };
  const revoke = () => {
    if (!activePublication || !isAdmin || !window.confirm("با لغو انتشار، ممکن است صفحه هتل تا انتشار نسخه بعدی بدون محتوا بماند. ادامه می‌دهید؟")) return;
    void perform(() => api.revoke(activePublication.id, note.trim() || undefined), "انتشار لغو شد و تاریخچه حفظ شده است.", () => setNote(""));
  };

  return <section className={styles.shell} lang="fa" dir="rtl" aria-label="مدیریت محتوای وب‌سایت هتل">
    <header className={styles.header}>
      <div><p className={styles.kicker}>بازارباز / مدیریت وب‌سایت هتل</p><h1>{propertyLabel}</h1><p className={styles.subhead}>محتوا را آماده کنید، نسخه جدید بسازید و آن را برای تأیید بفرستید.</p></div>
      <div className={styles.headerActions}>
        <span className={styles.scopeChip}>سایت هتل · بدون عملیات رزرو</span>
        <button type="button" onClick={() => void perform(async () => { await reload(); }, "فهرست به‌روز شد.")} disabled={busy}>تازه‌سازی</button>
      </div>
    </header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.columns}>
      <aside className={styles.sidebar} aria-label="نسخه‌های محتوا">
        <div className={styles.sideHeading}><h2>نسخه‌ها</h2><button disabled={busy} onClick={() => { if (hasUnsavedChanges && !window.confirm("تغییرات ذخیره‌نشده کنار گذاشته شود؟")) return; setDraft(blankDraft()); setSelectedId(null); setPreview(null); setHasUnsavedChanges(false); setTab("editor"); resetMessages(); }}>+ نسخه تازه</button></div>
        {loading ? <p>در حال بارگذاری…</p> : revisions.length === 0 ? <p className={styles.muted}>هنوز نسخه‌ای ساخته نشده است.</p> : <ul className={styles.versionList}>{revisions.map((revision) => {
          const published = revision.publications.some((p) => !p.revokedAt);
          return <li key={revision.revisionId}><button className={`${styles.version} ${selectedId === revision.revisionId ? styles.selected : ""}`} disabled={busy} onClick={() => void selectRevision(revision.revisionId)}>
            <span>نسخه {revision.revisionNumber}</span><small>{statusFa[revision.status]}{published ? " · منتشرشده" : ""}</small>
          </button></li>;
        })}</ul>}
        <div className={styles.sideFooter}><strong>انتشار فعلی</strong><p>{activePublication ? `نسخه ${activePublication.revisionNumber}` : "محتوای فعالی منتشر نشده است."}</p></div>
      </aside>
      <div className={styles.main}>
        <nav className={styles.tabs} aria-label="بخش‌های مدیریت">
          <button aria-current={tab === "editor" ? "page" : undefined} onClick={() => setTab("editor")}>ویرایش محتوا</button>
          <button aria-current={tab === "preview" ? "page" : undefined} onClick={() => void openPreview()}>پیش‌نمایش ذخیره‌شده</button>
          <button aria-current={tab === "history" ? "page" : undefined} onClick={() => setTab("history")}>تاریخچه</button>
        </nav>
        {tab === "editor" && <div className={styles.editor}>
          <div className={styles.explain}>هر ذخیره، <strong>نسخه‌ای جدید و تغییرناپذیر</strong> می‌سازد. ویرایش این فرم نسخه منتشرشده را تغییر نمی‌دهد.</div>
          <div className={styles.toolbar}><h2>محتوای صفحه اصلی</h2><label>زبان ویرایش <select value={locale} onChange={(event) => setLocale(event.target.value as HotelCmsLocale)}>{locales.map((id) => <option key={id} value={id}>{localeNames[id]}</option>)}</select></label></div>
          <div className={styles.formGrid}>
            <InlineField label="عنوان صفحه" value={localized(draft.content.title, locale)} onChange={(value) => update((c) => ({ ...c, title: setLocalized(c.title, locale, value) }))} />
            <InlineField label="عنوان اصلی صفحه" value={localized(draft.content.hero.heading, locale)} onChange={(value) => update((c) => ({ ...c, hero: { ...c.hero, heading: setLocalized(c.hero.heading, locale, value) } }))} />
            <InlineField label="متن کوتاه بالای عنوان" value={localized(draft.content.hero.eyebrow, locale)} onChange={(value) => update((c) => ({ ...c, hero: { ...c.hero, eyebrow: setLocalized(c.hero.eyebrow, locale, value) } }))} />
            <InlineField label="زیرعنوان صفحه" value={localized(draft.content.hero.subheading, locale)} onChange={(value) => update((c) => ({ ...c, hero: { ...c.hero, subheading: setLocalized(c.hero.subheading, locale, value) } }))} />
            <InlineField label="عنوان بخش معرفی" value={localized(draft.content.introduction.heading, locale)} onChange={(value) => update((c) => ({ ...c, introduction: { ...c.introduction, heading: setLocalized(c.introduction.heading, locale, value) } }))} />
            <InlineField label="تلفن تماس" value={draft.content.contact.phone ?? ""} onChange={(value) => update((c) => ({ ...c, contact: { ...c.contact, phone: value || undefined } }))} />
            <InlineField label="ایمیل" value={draft.content.contact.email ?? ""} onChange={(value) => update((c) => ({ ...c, contact: { ...c.contact, email: value || undefined } }))} />
            <InlineField label="نشانی هتل (داخلی؛ فعلاً در سایت عمومی نمایش داده نمی‌شود)" value={localized(draft.content.contact.address, locale)} onChange={(value) => update((c) => ({ ...c, contact: { ...c.contact, address: setLocalized(c.contact.address, locale, value) } }))} />
          </div>
          <InlineField label="متن معرفی هتل" multiline value={localized(draft.content.introduction.body, locale)} onChange={(value) => update((c) => ({ ...c, introduction: { ...c.introduction, body: setLocalized(c.introduction.body, locale, value) } }))} />
          <div className={styles.sectionHeading}><h3>بخش‌های صفحه</h3><div className={styles.headerActions}>
            <button type="button" disabled={busy || draft.content.sections.length >= 40} onClick={() => update((c) => addSection(c, "TEXT"))}>+ بخش متنی</button>
            <button type="button" disabled={busy || draft.content.sections.length >= 40} onClick={() => update((c) => addSection(c, "FEATURE_LIST"))}>+ فهرست امکانات</button>
            <button type="button" disabled={busy || draft.content.sections.length >= 40} onClick={() => update((c) => addSection(c, "FAQ"))}>+ پرسش‌های متداول</button>
          </div></div>
          {draft.content.sections.length === 0 && <p className={styles.muted}>هنوز بخشی اضافه نشده است.</p>}
          {draft.content.sections.map((section, index) => <div key={section.key} className={styles.sectionCard}>
            <div className={styles.sectionHeading}><strong>بخش {index + 1} · {section.kind}</strong><button onClick={() => update((c) => ({ ...c, sections: c.sections.filter((s) => s.key !== section.key) }))}>حذف</button></div>
            {section.kind === "TEXT" ? <>
              <InlineField label="عنوان بخش" value={localized(section.heading, locale)} onChange={(value) => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "TEXT" ? { ...s, heading: setLocalized(s.heading, locale, value) } : s) }))} />
              <InlineField label="متن بخش" multiline value={localized(section.body, locale)} onChange={(value) => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "TEXT" ? { ...s, body: setLocalized(s.body, locale, value) } : s) }))} />
            </> : section.kind === "FEATURE_LIST" ? <>
              <InlineField label="عنوان فهرست امکانات" value={localized(section.heading, locale)} onChange={(value) => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FEATURE_LIST" ? { ...s, heading: setLocalized(s.heading, locale, value) } : s) }))} />
              {section.items.map((item, itemIndex) => <div className={styles.nestedRow} key={item.key}>
                <InlineField label={`عنوان مورد ${itemIndex + 1}`} value={localized(item.label, locale)} onChange={(value) => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FEATURE_LIST" ? { ...s, items: s.items.map((i) => i.key === item.key ? { ...i, label: setLocalized(i.label, locale, value) } : i) } : s) }))} />
                <InlineField label="توضیح اختیاری" multiline value={localized(item.description, locale)} onChange={(value) => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FEATURE_LIST" ? { ...s, items: s.items.map((i) => i.key === item.key ? { ...i, description: setLocalized(i.description, locale, value) } : i) } : s) }))} />
                <button type="button" className={styles.remove} disabled={busy} onClick={() => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FEATURE_LIST" ? { ...s, items: s.items.filter((i) => i.key !== item.key) } : s) }))}>حذف مورد</button>
              </div>)}
              <button type="button" disabled={busy || section.items.length >= 30} onClick={() => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FEATURE_LIST" ? addFeatureItem(s) : s) }))}>+ افزودن مورد</button>
            </> : <>
              <InlineField label="عنوان پرسش‌های متداول" value={localized(section.heading, locale)} onChange={(value) => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FAQ" ? { ...s, heading: setLocalized(s.heading, locale, value) } : s) }))} />
              {section.items.map((item, itemIndex) => <div className={styles.nestedRow} key={`${section.key}-faq-${itemIndex}`}>
                <InlineField label={`پرسش ${itemIndex + 1}`} value={localized(item.question, locale)} onChange={(value) => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FAQ" ? { ...s, items: s.items.map((i, n) => n === itemIndex ? { ...i, question: setLocalized(i.question, locale, value) } : i) } : s) }))} />
                <InlineField label="پاسخ" multiline value={localized(item.answer, locale)} onChange={(value) => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FAQ" ? { ...s, items: s.items.map((i, n) => n === itemIndex ? { ...i, answer: setLocalized(i.answer, locale, value) } : i) } : s) }))} />
                <button type="button" className={styles.remove} disabled={busy} onClick={() => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FAQ" ? { ...s, items: s.items.filter((_, n) => n !== itemIndex) } : s) }))}>حذف پرسش</button>
              </div>)}
              <button type="button" disabled={busy || section.items.length >= 30} onClick={() => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key && s.kind === "FAQ" ? addFaqItem(s) : s) }))}>+ افزودن پرسش</button>
            </>}
            <label className={styles.checkbox}><input type="checkbox" checked={section.visible} onChange={(event) => update((c) => ({ ...c, sections: c.sections.map((s) => s.key === section.key ? { ...s, visible: event.target.checked } : s) }))} />نمایش بخش</label>
          </div>)}
          <div className={styles.sectionHeading}><h3>تصاویر پیوست</h3><button disabled={busy || draft.media.length >= 80} onClick={() => updateMedia((media) => [...media, { imageId: "", scope: "PROPERTY", roomTypeId: null, slot: "GALLERY", sortOrder: Math.max(-1, ...media.filter((m) => m.scope === "PROPERTY" && m.slot === "GALLERY").map((m) => m.sortOrder)) + 1, altText: {} }])}>+ افزودن تصویر</button></div>
          <p className={styles.muted}>فعلاً باید شناسه تصویری را وارد کنید که از قبل در رسانه‌های همین سازمان بارگذاری و عمومی شده است. تصویر جدید از این صفحه آپلود نمی‌شود. در API عمومی فعلی فقط تصاویر جایگاه «گالری» نمایش داده می‌شوند؛ تصاویر اصلی دسکتاپ و موبایل برای توسعه آینده ذخیره می‌شوند.</p>
          {draft.media.map((item, index) => <div className={styles.mediaRow} key={index}>
            <InlineField label="شناسه تصویر" value={item.imageId} onChange={(value) => updateMedia((media) => media.map((m, i) => i === index ? { ...m, imageId: value } : m))} />
            <label className={styles.field}><span>محل نمایش</span><select value={item.scope} onChange={(event) => updateMedia((media) => media.map((m, i) => i === index ? { ...m, scope: event.target.value as HotelCmsMedia["scope"], roomTypeId: event.target.value === "PROPERTY" ? null : "" } : m))}><option value="PROPERTY">هتل</option><option value="ROOM_CATEGORY">نوع اتاق</option></select></label>
            {item.scope === "ROOM_CATEGORY" && <InlineField label="شناسه نوع اتاق" value={item.roomTypeId ?? ""} onChange={(value) => updateMedia((media) => media.map((m, i) => i === index ? { ...m, roomTypeId: value } : m))} />}
            <label className={styles.field}><span>جایگاه</span><select value={item.slot} onChange={(event) => updateMedia((media) => media.map((m, i) => i === index ? { ...m, slot: event.target.value as HotelCmsMedia["slot"] } : m))}><option value="GALLERY">گالری</option><option value="HERO_DESKTOP">تصویر اصلی دسکتاپ</option><option value="HERO_MOBILE">تصویر اصلی موبایل</option></select></label>
            <label className={styles.field}><span>ترتیب</span><input type="number" min={0} max={1000} value={item.sortOrder} onChange={(event) => updateMedia((media) => media.map((m, i) => i === index ? { ...m, sortOrder: Number(event.target.value) } : m))} /></label>
            <InlineField label={`متن جایگزین (${localeNames[locale]})`} value={localized(item.altText, locale)} onChange={(value) => updateMedia((media) => media.map((m, i) => i === index ? { ...m, altText: setLocalized(m.altText, locale, value) } : m))} />
            <button type="button" className={styles.remove} onClick={() => updateMedia((media) => media.filter((_, i) => i !== index))}>حذف تصویر</button>
          </div>)}
          <div className={styles.footerBar}><span>پس از ذخیره، برای ارسال نسخه ثبت‌شده از بخش گردش کار استفاده کنید.</span><button className={styles.primary} disabled={busy} onClick={() => void submitDraft()}>{busy ? "در حال انجام…" : "ثبت نسخه جدید"}</button></div>
        </div>}
        {tab === "preview" && <div className={styles.editor}>
          <div className={styles.previewFlag}>پیش‌نمایش خصوصی · غیرقابل نمایش عمومی</div>
          {preview ? <><div className={styles.toolbar}><h2>نسخه {preview.revisionNumber}</h2><span>{statusFa[preview.status]}</span></div>
            <h2>{localized(preview.content.hero.heading, preview.locale) || "ترجمه این عنوان موجود نیست"}</h2>
            <p>{localized(preview.content.hero.subheading, preview.locale)}</p>
            <div className={styles.previewBody}>{localized(preview.content.introduction.body, preview.locale) || "ترجمه معرفی موجود نیست"}</div>
            <p className={styles.muted}>تعداد رسانه‌های مجاز فعلی: {preview.media.length}</p>
            <div className={styles.previewMedia}>{preview.media.map((item) => <figure key={`${item.imageId}-${item.slot}-${item.sortOrder}`}><span>{item.slot} · {item.scope}</span><a href={item.src} target="_blank" rel="noopener noreferrer">مشاهده فایل پیوست</a><figcaption>{localized(item.altText, preview.locale) || "متن جایگزین ندارد"}</figcaption></figure>)}</div>
          </> : <p className={styles.muted}>برای دیدن پیش‌نمایش، یک نسخه ذخیره‌شده انتخاب کنید.</p>}
        </div>}
        {tab === "history" && <div className={styles.editor}><h2>تاریخچه بررسی و انتشار</h2>
          <h3>انتشارها</h3>{history.publications.length === 0 ? <p className={styles.muted}>انتشاری ثبت نشده است.</p> : <ul className={styles.activity}>{history.publications.map((record) => <li key={record.id}><strong>{record.revokedAt ? "لغوشده" : "منتشرشده"}</strong><span>شناسه نسخه: {record.revisionId}</span><time>{new Date(record.publishedAt).toLocaleString("fa-IR")}</time></li>)}</ul>}
          <h3>بازبینی‌ها</h3>{history.reviews.length === 0 ? <p className={styles.muted}>تاریخچه‌ای ثبت نشده است.</p> : <ul className={styles.activity}>{history.reviews.map((record) => <li key={record.id}><strong>{record.action}</strong><span>{record.note || "بدون یادداشت"}</span><time>{new Date(record.createdAt).toLocaleString("fa-IR")}</time></li>)}</ul>}
        </div>}
      </div>
      <aside className={styles.workflow} aria-label="گردش کار انتشار">
        <h2>گردش کار</h2>
        <p className={styles.muted}>نسخه انتخاب‌شده: {selected ? `شماره ${selected.revisionNumber}` : "هیچ‌کدام"}</p>
        {selected && <span className={styles.workflowStatus}>{statusFa[selected.status]}</span>}
        <label className={styles.field}><span>یادداشت بررسی یا دلیل لغو</span><textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="اختیاری" /></label>
        {hasUnsavedChanges && selected && <p className={styles.warning}>تغییرات فرم هنوز نسخه جدیدی نشده‌اند. ابتدا «ثبت نسخه جدید» را بزنید.</p>}
        <button disabled={busy || !selected || selected.status !== "DRAFT" || hasUnsavedChanges} onClick={submitReview}>ارسال برای بررسی</button>
        {isAdmin && <>
          <button disabled={busy || !selected || selected.status !== "IN_REVIEW"} onClick={() => decide("APPROVED")}>تأیید نسخه</button>
          <button disabled={busy || !selected || selected.status !== "IN_REVIEW"} onClick={() => decide("REJECTED")}>رد نسخه</button>
          <button className={styles.primary} disabled={busy || !selected || selected.status !== "APPROVED" || Boolean(activePublication)} onClick={publish}>انتشار نسخه تأییدشده</button>
          {activePublication && <button className={styles.danger} disabled={busy} onClick={revoke}>لغو انتشار فعلی</button>}
        </>}
        <p className={styles.footnote}>تأییدکننده باید شخصی غیر از سازنده نسخه باشد. سرور این محدودیت و تمام مجوزها را مستقلاً بررسی می‌کند.</p>
        <p className={styles.warning}>انتشار نسخه به‌تنهایی سایت را عمومی نمی‌کند؛ نمایش عمومی وابسته به مجوزهای هتل و فعال‌بودن جداگانه درگاه وب‌سایت است.</p>
        {activePublication && <p className={styles.warning}>برای انتشار جایگزین، ابتدا باید انتشار قبلی را لغو کرد؛ ممکن است در این فاصله سایت بدون محتوای منتشرشده بماند.</p>}
      </aside>
    </div>
  </section>;
}
