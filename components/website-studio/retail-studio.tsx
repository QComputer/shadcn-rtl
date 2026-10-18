"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Eye, LoaderCircle, Plus, RefreshCw, Save, Smartphone, Trash2, Monitor } from "lucide-react";
import { retailContentSchema, type RetailContent, type RetailSection, type WebsiteMedia, type WebsiteRevision } from "@/lib/website-studio/retail-contract";
import { moveWebsiteSection, isEligibleWebsiteImage } from "@/lib/website-studio/core";
import { StudioField } from "./studio-field";
import styles from "./retail-studio.module.css";

type ApiPayload = { organization: { id?: string; name: string }; revision: WebsiteRevision | null; content: RetailContent; media: WebsiteMedia[] };
type Props = { organizationId: string; locale: string };
const labels: Record<RetailSection["kind"], string> = { HERO: "معرفی اصلی", ABOUT: "درباره فروشگاه", GALLERY: "گالری تصاویر", FEATURES: "ویژگی‌ها", CONTACT: "راه‌های ارتباطی" };
function responseError(data: { error?: unknown; message?: unknown }, fallback: string) {
  if (typeof data.error === "string") return data.error;
  if (data.error && typeof data.error === "object" && "message" in data.error && typeof data.error.message === "string") return data.error.message;
  if (typeof data.message === "string") return data.message;
  return fallback;
}

function retailValidationMessage(content: RetailContent) {
  const result = retailContentSchema.safeParse(content);
  if (result.success) return null;
  const issue = result.error.issues[0];
  if (issue.path[0] === "sections" && issue.path.length === 1 && issue.message.includes("شناسه")) return issue.message;
  if (issue.path.includes("imageIds")) return "برای ذخیره، هر ردیف گالری را با یک تصویر تأییدشده تکمیل کنید.";
  if (issue.path.at(-1) === "ctaHref") return "نشانی دکمه معتبر نیست؛ از مسیر داخلی، نشانی https، تلفن یا ایمیل استفاده کنید.";
  if (issue.path.at(-1) === "href") return "نشانی پیوند معتبر نیست؛ از مسیر داخلی، نشانی https، تلفن یا ایمیل استفاده کنید.";
  const field = String(issue.path.at(-1) ?? "content");
  const fieldNames: Record<string, string> = {
    title: "عنوان وب‌سایت", heading: "عنوان بخش", subtitle: "زیرعنوان", body: "متن", ctaLabel: "متن دکمه",
    address: "نشانی", phone: "تلفن", email: "ایمیل", icon: "نماد", imageId: "تصویر",
    sections: "بخش‌های صفحه", order: "ترتیب بخش‌ها", key: "شناسه بخش",
  };
  return `مقدار «${fieldNames[field] ?? "محتوا"}» معتبر نیست. آن را بررسی کنید.`;
}

function ImagePicker({ label, value, media, disabled, onChange }: { label: string; value: string; media: WebsiteMedia[]; disabled: boolean; onChange: (id: string) => void }) {
  return <label className={styles.field}><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">بدون تصویر</option>{media.map((image) => <option key={image.id} value={image.id}>{image.filename || "تصویر تأییدشده"}</option>)}</select>{value && media.find((image) => image.id === value) && <img className={styles.thumb} src={media.find((image) => image.id === value)!.url} alt="پیش‌نمایش تصویر تأییدشده" />}</label>;
}

export function RetailStudio({ organizationId, locale }: Props) {
  const endpoint = `/api/organizations/${encodeURIComponent(organizationId)}/website`;
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [content, setContent] = useState<RetailContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const usableMedia = useMemo(() => (payload?.media ?? []).filter(isEligibleWebsiteImage), [payload?.media]);
  const ordered = useMemo(() => [...(content?.sections ?? [])].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key)), [content]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(responseError(data, "بارگذاری وب‌سایت انجام نشد."));
    if (!signal?.aborted) {
      const result = data as ApiPayload;
      setPayload(result); setContent(result.content); setDirty(false); setNotice("");
    }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "بارگذاری وب‌سایت انجام نشد."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (transform: (current: RetailContent) => RetailContent) => { setContent((current) => current ? transform(current) : current); setDirty(true); setNotice(""); };
  const updateSection = (key: string, transform: (section: RetailSection) => RetailSection) => update((current) => ({ ...current, sections: current.sections.map((section) => section.key === key ? transform(section) : section) }));
  async function refresh() {
    if (dirty && !window.confirm("با بازخوانی، تغییرات ذخیره‌نشده کنار گذاشته می‌شوند. ادامه می‌دهید؟")) return;
    setLoading(true); setBusy(true);
    try { await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "بازخوانی انجام نشد."); } finally { setLoading(false); setBusy(false); }
  }
  async function save() {
    if (!content || busy) return;
    const validation = retailContentSchema.safeParse(content);
    if (!validation.success) {
      const message = retailValidationMessage(content);
      setError(message ?? "محتوا معتبر نیست. لطفاً بخش‌های ویرایش‌شده را بررسی کنید."); setNotice("");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: validation.data, baseRevisionId: payload?.revision?.id ?? null, requestId: crypto.randomUUID() }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(data, "ذخیره پیش‌نویس انجام نشد."));
      const revision = (data.revision ?? data) as WebsiteRevision;
      setPayload((current) => current ? { ...current, revision, content: revision.content } : current);
      setContent(revision.content); setDirty(false); setNotice("پیش‌نویس خصوصی ذخیره شد. این نسخه منتشر نشده است.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ذخیره انجام نشد."); }
    finally { setBusy(false); }
  }
  function openPreview() {
    if (dirty && !window.confirm("پیش‌نمایش نسخه ذخیره‌شده باز می‌شود و تغییرات ذخیره‌نشده در آن دیده نمی‌شوند. ادامه می‌دهید؟")) return;
    if (!payload?.revision?.id) { setError("برای نمایش پیش‌نمایش، ابتدا پیش‌نویس را ذخیره کنید."); return; }
    setError(""); setView("preview");
  }

  return <main className={styles.shell} dir="rtl" lang={locale}>
    <header className={styles.header}><div><p className={styles.eyebrow}>استودیوی وب‌سایت فروشگاه</p><h1>{payload?.organization.name ?? "مدیریت وب‌سایت"}</h1><p>محتوای صفحه فروشگاه را ویرایش و پیش‌نمایش خصوصی آن را بررسی کنید.</p></div><div className={styles.headerButtons}><span className={styles.privateBadge}>پیش‌نویس خصوصی</span><button type="button" disabled={busy || loading} onClick={() => void refresh()}><RefreshCw size={16} /> بازخوانی</button></div></header>
    {error && <div role="alert" className={styles.alert}>{error}<button type="button" disabled={busy} onClick={() => void refresh()}>تلاش دوباره</button></div>}
    {notice && <div role="status" className={styles.success}><Check size={17} />{notice}</div>}
    <div className={styles.workspace}>
      <nav className={styles.tabs} aria-label="نمای استودیو"><button type="button" aria-pressed={view === "edit"} onClick={() => setView("edit")}>ویرایش محتوا</button><button type="button" disabled={!payload?.revision} onClick={openPreview} aria-pressed={view === "preview"}><Eye size={16} /> پیش‌نمایش ذخیره‌شده</button></nav>
      {loading ? <div className={styles.loading}><LoaderCircle className={styles.spinner} /> در حال بارگذاری اطلاعات فروشگاه…</div> : content && view === "edit" ? <div className={styles.editorLayout}>
        <section className={styles.editor} aria-label="ویرایش محتوای فروشگاه"><fieldset disabled={busy} className={styles.fieldset}>
          <div className={styles.intro}><strong>نسخه خصوصی وب‌سایت</strong><span>ذخیره، نسخه تازه‌ای می‌سازد و هیچ محتوایی را منتشر نمی‌کند.</span></div>
          <div className={styles.publicNote} role="note">فروشگاه عمومی بدون تغییر می‌ماند؛ ذخیره این پیش‌نویس فقط یک نسخه خصوصی ایجاد می‌کند.</div>
          <StudioField className={styles.field} label="عنوان وب‌سایت" value={content.title} onChange={(value) => update((current) => ({ ...current, title: value }))} />
          <h2 className={styles.sectionTitle}>بخش‌های صفحه</h2>
          {ordered.map((section, index) => <article className={styles.card} key={section.key}>
            <div className={styles.cardHead}><div><span className={styles.order}>{String(index + 1).padStart(2, "0")}</span><h3>{labels[section.kind]}</h3></div><div className={styles.cardActions}><button type="button" aria-label={`انتقال ${labels[section.kind]} به بالا`} title="انتقال به بالا" disabled={busy || index === 0} onClick={() => update((current) => moveWebsiteSection(current, section.key, -1))}><ArrowUp size={16} /></button><button type="button" aria-label={`انتقال ${labels[section.kind]} به پایین`} title="انتقال به پایین" disabled={busy || index === ordered.length - 1} onClick={() => update((current) => moveWebsiteSection(current, section.key, 1))}><ArrowDown size={16} /></button><label className={styles.toggle}><input type="checkbox" checked={section.visible} disabled={busy} onChange={(event) => updateSection(section.key, (item) => ({ ...item, visible: event.target.checked }))} /><span>نمایش</span></label></div></div>
            {section.kind === "HERO" && <div className={styles.fields}><StudioField className={styles.field} label="تیتر اصلی" value={section.heading} onChange={(v) => updateSection(section.key, (item) => item.kind === "HERO" ? { ...item, heading: v } : item)} /><StudioField className={styles.field} label="زیرعنوان" value={section.subtitle} onChange={(v) => updateSection(section.key, (item) => item.kind === "HERO" ? { ...item, subtitle: v } : item)} /><StudioField className={styles.field} label="متن معرفی" value={section.body} multiline onChange={(v) => updateSection(section.key, (item) => item.kind === "HERO" ? { ...item, body: v } : item)} /><StudioField className={styles.field} label="متن دکمه" value={section.ctaLabel} onChange={(v) => updateSection(section.key, (item) => item.kind === "HERO" ? { ...item, ctaLabel: v } : item)} /><StudioField className={styles.field} label="پیوند دکمه" value={section.ctaHref} dir="ltr" onChange={(v) => updateSection(section.key, (item) => item.kind === "HERO" ? { ...item, ctaHref: v } : item)} /><ImagePicker label="تصویر معرفی" value={section.imageId} media={usableMedia} disabled={busy} onChange={(v) => updateSection(section.key, (item) => item.kind === "HERO" ? { ...item, imageId: v } : item)} /></div>}
            {section.kind === "ABOUT" && <div className={styles.fields}><StudioField className={styles.field} label="عنوان بخش" value={section.heading} onChange={(v) => updateSection(section.key, (item) => item.kind === "ABOUT" ? { ...item, heading: v } : item)} /><StudioField className={styles.field} label="متن درباره فروشگاه" value={section.body} multiline onChange={(v) => updateSection(section.key, (item) => item.kind === "ABOUT" ? { ...item, body: v } : item)} /><ImagePicker label="تصویر درباره ما" value={section.imageId} media={usableMedia} disabled={busy} onChange={(v) => updateSection(section.key, (item) => item.kind === "ABOUT" ? { ...item, imageId: v } : item)} /></div>}
            {section.kind === "GALLERY" && <div className={styles.nested}><StudioField className={styles.field} label="عنوان گالری" value={section.heading} onChange={(v) => updateSection(section.key, (item) => item.kind === "GALLERY" ? { ...item, heading: v } : item)} /><div className={styles.rowTitle}><strong>تصاویر گالری</strong><button type="button" disabled={busy || usableMedia.length === 0 || section.imageIds.length >= 30} onClick={() => updateSection(section.key, (item) => item.kind === "GALLERY" ? { ...item, imageIds: [...item.imageIds, ""] } : item)}><Plus size={15} /> افزودن تصویر تأییدشده</button></div>{section.imageIds.map((id, imageIndex) => <div className={styles.galleryRow} key={`${id}-${imageIndex}`}><ImagePicker label={`تصویر ${imageIndex + 1}`} value={id} media={usableMedia.filter((image) => !section.imageIds.includes(image.id) || image.id === id)} disabled={busy} onChange={(value) => updateSection(section.key, (item) => item.kind === "GALLERY" ? { ...item, imageIds: item.imageIds.map((current, i) => i === imageIndex ? value : current).filter(Boolean) } : item)} /><div className={styles.cardActions}><button type="button" title="انتقال به بالا" aria-label="انتقال تصویر به بالا" disabled={busy || imageIndex === 0} onClick={() => updateSection(section.key, (item) => { if (item.kind !== "GALLERY") return item; const imageIds = [...item.imageIds]; [imageIds[imageIndex - 1], imageIds[imageIndex]] = [imageIds[imageIndex], imageIds[imageIndex - 1]]; return { ...item, imageIds }; })}><ArrowUp size={16} /></button><button type="button" title="انتقال به پایین" aria-label="انتقال تصویر به پایین" disabled={busy || imageIndex === section.imageIds.length - 1} onClick={() => updateSection(section.key, (item) => { if (item.kind !== "GALLERY") return item; const imageIds = [...item.imageIds]; [imageIds[imageIndex + 1], imageIds[imageIndex]] = [imageIds[imageIndex], imageIds[imageIndex + 1]]; return { ...item, imageIds }; })}><ArrowDown size={16} /></button><button type="button" className={styles.iconDanger} aria-label="حذف تصویر" disabled={busy} onClick={() => updateSection(section.key, (item) => item.kind === "GALLERY" ? { ...item, imageIds: item.imageIds.filter((_, i) => i !== imageIndex) } : item)}><Trash2 size={16} /></button></div></div>)}</div>}
            {section.kind === "FEATURES" && <div className={styles.nested}><StudioField className={styles.field} label="عنوان بخش" value={section.heading} onChange={(v) => updateSection(section.key, (item) => item.kind === "FEATURES" ? { ...item, heading: v } : item)} /><div className={styles.rowTitle}><strong>موارد ویژگی‌ها</strong><button type="button" disabled={busy || section.items.length >= 30} onClick={() => updateSection(section.key, (item) => item.kind === "FEATURES" ? { ...item, items: [...item.items, { heading: "", body: "", icon: "✦" }] } : item)}><Plus size={15} /> افزودن مورد</button></div>{section.items.map((feature, itemIndex) => <div className={styles.nestedCard} key={itemIndex}><div className={styles.rowTitle}><strong>مورد {itemIndex + 1}</strong><button type="button" className={styles.iconDanger} aria-label="حذف مورد" disabled={busy} onClick={() => updateSection(section.key, (item) => item.kind === "FEATURES" ? { ...item, items: item.items.filter((_, i) => i !== itemIndex) } : item)}><Trash2 size={16} /></button></div><div className={styles.fields}><StudioField className={styles.field} label="عنوان" value={feature.heading} onChange={(v) => updateSection(section.key, (item) => item.kind === "FEATURES" ? { ...item, items: item.items.map((f, i) => i === itemIndex ? { ...f, heading: v } : f) } : item)} /><StudioField className={styles.field} label="نماد کوتاه" value={feature.icon} onChange={(v) => updateSection(section.key, (item) => item.kind === "FEATURES" ? { ...item, items: item.items.map((f, i) => i === itemIndex ? { ...f, icon: v } : f) } : item)} /><div className={styles.full}><StudioField className={styles.field} label="توضیح" value={feature.body} multiline onChange={(v) => updateSection(section.key, (item) => item.kind === "FEATURES" ? { ...item, items: item.items.map((f, i) => i === itemIndex ? { ...f, body: v } : f) } : item)} /></div></div></div>)}</div>}
            {section.kind === "CONTACT" && <div className={styles.fields}><StudioField className={styles.field} label="عنوان بخش" value={section.heading} onChange={(v) => updateSection(section.key, (item) => item.kind === "CONTACT" ? { ...item, heading: v } : item)} /><StudioField className={styles.field} label="نشانی" value={section.address} multiline onChange={(v) => updateSection(section.key, (item) => item.kind === "CONTACT" ? { ...item, address: v } : item)} /><StudioField className={styles.field} label="تلفن" value={section.phone} dir="ltr" onChange={(v) => updateSection(section.key, (item) => item.kind === "CONTACT" ? { ...item, phone: v } : item)} /><StudioField className={styles.field} label="ایمیل" value={section.email} dir="ltr" type="email" onChange={(v) => updateSection(section.key, (item) => item.kind === "CONTACT" ? { ...item, email: v } : item)} /><div className={styles.full}><div className={styles.rowTitle}><strong>پیوندهای ارتباطی</strong><button type="button" disabled={busy || section.links.length >= 12} onClick={() => updateSection(section.key, (item) => item.kind === "CONTACT" ? { ...item, links: [...item.links, { label: "", href: "" }] } : item)}><Plus size={15} /> افزودن پیوند</button></div>{section.links.map((link, linkIndex) => <div className={styles.fields} key={linkIndex}><StudioField className={styles.field} label="عنوان پیوند" value={link.label} onChange={(v) => updateSection(section.key, (item) => item.kind === "CONTACT" ? { ...item, links: item.links.map((l, i) => i === linkIndex ? { ...l, label: v } : l) } : item)} /><div className={styles.inlineField}><StudioField className={styles.field} label="نشانی پیوند" value={link.href} dir="ltr" onChange={(v) => updateSection(section.key, (item) => item.kind === "CONTACT" ? { ...item, links: item.links.map((l, i) => i === linkIndex ? { ...l, href: v } : l) } : item)} /><button type="button" className={styles.iconDanger} aria-label="حذف پیوند" disabled={busy} onClick={() => updateSection(section.key, (item) => item.kind === "CONTACT" ? { ...item, links: item.links.filter((_, i) => i !== linkIndex) } : item)}><Trash2 size={16} /></button></div></div>)}</div></div>}
          </article>)}
          <div className={styles.saveBar}><span>{dirty ? "تغییرات ذخیره نشده‌اند" : payload?.revision ? `آخرین نسخه: ${new Date(payload.revision.createdAt).toLocaleString("fa-IR")}` : "هنوز نسخه‌ای ذخیره نشده است"}</span><button type="button" className={styles.primary} disabled={busy || !dirty} onClick={() => void save()}>{busy ? <LoaderCircle className={styles.spinner} size={16} /> : <Save size={16} />} ذخیره پیش‌نویس</button></div>
        </fieldset></section><aside className={styles.help}><h2>راهنمای ویرایش</h2><p>تصویرها فقط از رسانه‌های عمومی و تأییدشده همین فروشگاه انتخاب می‌شوند.</p><p>بخش‌های پنهان در پیش‌نمایش نمایش داده نمی‌شوند. از فلش‌ها برای مرتب‌سازی استفاده کنید.</p><div className={styles.revision}>{payload?.revision ? <><span>نسخه ذخیره‌شده</span><strong>{payload.revision.id.slice(0, 8)}</strong></> : <><span>وضعیت</span><strong>پیش‌نویس تازه</strong></>}</div></aside>
      </div> : content && view === "preview" ? <div className={styles.previewPane}><div className={styles.previewToolbar}><div><h2>پیش‌نمایش خصوصی</h2><p>نسخه ذخیره‌شده · در دسترس بازدیدکنندگان نیست</p></div><div className={styles.previewActions}><button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor size={16} /> رومیزی</button><button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}><Smartphone size={16} /> موبایل</button></div></div><div className={`${styles.viewport} ${device === "mobile" ? styles.mobile : styles.desktop}`}><iframe title="پیش‌نمایش خصوصی وب‌سایت فروشگاه" src={`/${encodeURIComponent(locale)}/dashboard/website-studio/${encodeURIComponent(organizationId)}/preview/${encodeURIComponent(payload?.revision?.id ?? "")}`} /></div></div> : null}
    </div>
  </main>;
}
