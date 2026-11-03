"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appFetch } from "@/lib/app-base-path";
import { RetailProductCard } from "@/components/retail/retail-product-card";
import type { PublicCatalogProduct } from "@/lib/public-catalog/contracts";
import { retailBrandStyle } from "@/lib/retail/brand-color";
import styles from "./retail-brand-color-editor.module.css";

type Props = { organizationId: string; product?: PublicCatalogProduct; storeName?: string };
type BrandingResponse = { storefrontPrimaryColor?: string | null };

const DEFAULT_COLOR = "#2563EB";
const COLOR_PATTERN = /^#[\da-fA-F]{6}$/;
const PRESETS = [
  { name: "آبی", value: "#2563EB" },
  { name: "سبز", value: "#16825D" },
  { name: "قرمز", value: "#C2413A" },
  { name: "بنفش", value: "#7654B8" },
  { name: "نارنجی", value: "#D97724" },
  { name: "ذغالی", value: "#374151" },
] as const;

function normalizeColor(value: unknown): string | null {
  return typeof value === "string" && COLOR_PATTERN.test(value) ? value.toUpperCase() : null;
}

export function RetailBrandColorEditor(props: Props) {
  return <BrandColorEditor key={props.organizationId} {...props} />;
}

function BrandColorEditor({ organizationId, product, storeName }: Props) {
  const [savedColor, setSavedColor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadSucceeded, setLoadSucceeded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
  const mountedTenant = useRef(organizationId);
  const saveController = useRef<AbortController | null>(null);
  const dirty = draft !== (savedColor ?? "");
  const validColor = normalizeColor(draft);

  useEffect(() => {
    mountedTenant.current = organizationId;
    saveController.current?.abort();
    const controller = new AbortController();

    appFetch(`/api/organizations/${encodeURIComponent(organizationId)}/branding`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 403 ? "دسترسی به تنظیمات رنگ فروشگاه مجاز نیست." : "بارگذاری رنگ فروشگاه انجام نشد.");
        return response.json() as Promise<BrandingResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted || mountedTenant.current !== organizationId) return;
        const color = normalizeColor(data.storefrontPrimaryColor);
        setSavedColor(color);
        setDraft(color ?? "");
        setLoadSucceeded(true);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || mountedTenant.current !== organizationId) return;
        setError(reason instanceof Error ? reason.message : "بارگذاری رنگ فروشگاه انجام نشد.");
      })
      .finally(() => {
        if (!controller.signal.aborted && mountedTenant.current === organizationId) setLoading(false);
      });

    return () => controller.abort();
  }, [organizationId, loadAttempt]);

  useEffect(() => () => saveController.current?.abort(), []);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmLinkNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.href === window.location.href) return;
      if (!window.confirm("تغییر رنگ ذخیره نشده است. از این صفحه خارج می‌شوید؟")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    document.addEventListener("click", confirmLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeave);
      document.removeEventListener("click", confirmLinkNavigation, true);
    };
  }, [dirty]);

  const chooseColor = useCallback((value: string) => {
    setDraft(value.toUpperCase());
    setError("");
    setNotice("");
  }, []);

  async function save() {
    if (!loadSucceeded || (!validColor && draft !== "") || loading || saving) return;
    const valueToSave = validColor;
    const tenantAtStart = organizationId;
    const controller = new AbortController();
    saveController.current?.abort();
    saveController.current = controller;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await appFetch(`/api/organizations/${encodeURIComponent(tenantAtStart)}/branding`, {
        method: "PATCH",
        signal: controller.signal,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefrontPrimaryColor: valueToSave }),
      });
      if (!response.ok) throw new Error(response.status === 403 ? "اجازهٔ تغییر رنگ این فروشگاه را ندارید." : "ذخیرهٔ رنگ فروشگاه انجام نشد.");

      const reread = await appFetch(`/api/organizations/${encodeURIComponent(tenantAtStart)}/branding`, { signal: controller.signal, cache: "no-store" });
      if (!reread.ok) throw new Error("ذخیره انجام شد، اما بررسی دوبارهٔ رنگ ممکن نشد. صفحه را دوباره بارگذاری کنید.");
      const data = (await reread.json()) as BrandingResponse;
      if (controller.signal.aborted || mountedTenant.current !== tenantAtStart) return;
      const confirmedColor = normalizeColor(data.storefrontPrimaryColor);
      if (confirmedColor !== valueToSave) throw new Error("رنگ ذخیره‌شده با مقدار انتخابی یکسان نیست. دوباره تلاش کنید.");
      setSavedColor(confirmedColor);
      setDraft(confirmedColor ?? "");
      setNotice("رنگ ذخیره شد و دوباره از فروشگاه خوانده شد. این تغییر بلافاصله در فروشگاه اعمال می‌شود.");
    } catch (reason) {
      if (controller.signal.aborted || mountedTenant.current !== tenantAtStart) return;
      setError(reason instanceof Error ? reason.message : "ذخیرهٔ رنگ فروشگاه انجام نشد.");
    } finally {
      if (!controller.signal.aborted && mountedTenant.current === tenantAtStart) setSaving(false);
    }
  }

  const previewColor = validColor ?? (draft === "" ? null : savedColor);
  const previewStyle = retailBrandStyle(previewColor, previewMode);

  return (
    <section className={styles.editor} dir="rtl" aria-labelledby="retail-brand-color-title">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>ظاهر فروشگاه</p>
          <h2 id="retail-brand-color-title">رنگ اصلی فروشگاه</h2>
          <p className={styles.description}>رنگ دکمه‌ها و بخش‌های برجستهٔ فروشگاه را انتخاب کنید. این تنظیم به رنگ برنامهٔ نصب‌شده ارتباطی ندارد.</p>
        </div>
        <span className={styles.colorMark} style={previewColor ? { backgroundColor: previewColor } : undefined} aria-hidden="true" />
      </header>

      {loading ? <p className={styles.state} role="status">در حال بارگذاری رنگ فروشگاه…</p> : !loadSucceeded ? (
        <div className={styles.loadFailure} role="alert">
          <p>{error || "خواندن رنگ ذخیره‌شده انجام نشد. برای جلوگیری از بازنویسی ناخواسته، ویرایش تا بارگذاری موفق غیرفعال است."}</p>
          <button type="button" className={styles.resetButton} onClick={() => { setError(""); setLoading(true); setLoadAttempt((attempt) => attempt + 1); }}>تلاش دوباره</button>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.controls}>
            <label className={styles.label} htmlFor="retail-storefront-color">انتخاب رنگ</label>
            <div className={styles.colorInputRow}>
              <input
                id="retail-storefront-color"
                className={styles.nativePicker}
                type="color"
                aria-label="انتخاب رنگ از پنجرهٔ رنگ"
                value={validColor ?? savedColor ?? DEFAULT_COLOR}
                onChange={(event) => chooseColor(event.currentTarget.value)}
                disabled={saving}
              />
              <label className={styles.hexLabel} htmlFor="retail-storefront-hex">کد HEX</label>
              <input
                id="retail-storefront-hex"
                className={styles.hexInput}
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                spellCheck={false}
                dir="ltr"
                maxLength={7}
                placeholder="#2563EB"
                value={draft}
                onChange={(event) => chooseColor(event.currentTarget.value)}
                aria-invalid={draft.length > 0 && !validColor}
                aria-describedby="retail-color-format"
                disabled={saving}
              />
            </div>
            <p id="retail-color-format" className={styles.hint}>کد باید دقیقاً با قالب ‎#RRGGBB‎ وارد شود.</p>

            <fieldset className={styles.presetFieldset}>
              <legend className={styles.label}>رنگ‌های پیشنهادی</legend>
              <div className={styles.presets}>
                {PRESETS.map((preset) => (
                  <button
                    className={styles.preset}
                    type="button"
                    key={preset.value}
                    onClick={() => chooseColor(preset.value)}
                    disabled={saving}
                    aria-label={`انتخاب رنگ ${preset.name}`}
                    aria-pressed={validColor === preset.value}
                    title={`${preset.name} ${preset.value}`}
                  ><span style={{ backgroundColor: preset.value }} aria-hidden="true" /><span>{preset.name}</span></button>
                ))}
              </div>
            </fieldset>

            <div className={styles.actions}>
              <button className={styles.saveButton} type="button" onClick={save} disabled={!dirty || (!validColor && draft !== "") || saving}>
                {saving ? "در حال ذخیره…" : "ذخیرهٔ رنگ"}
              </button>
              <button className={styles.resetButton} type="button" onClick={() => chooseColor("")} disabled={saving || (!savedColor && draft === "")}>
                بازگردانی به پیش‌فرض
              </button>
            </div>
            {dirty && <p className={styles.warning} role="status">تغییر ذخیره‌نشده دارید. پیش از خروج، ذخیره کنید یا آن را بازگردانید.</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {notice && <p className={styles.success} role="status" aria-live="polite">{notice}</p>}
          </div>

          <aside className={styles.previewWrap} aria-label="پیش‌نمایش رنگ انتخابی">
            <div className={styles.previewHeading}>
              <p className={styles.previewTitle}>پیش‌نمایش نمونه</p>
              <div className={styles.modeSwitch} role="group" aria-label="حالت نمایش پیش‌نمایش">
                <button type="button" aria-pressed={previewMode === "light"} onClick={() => setPreviewMode("light")}>روشن</button>
                <button type="button" aria-pressed={previewMode === "dark"} onClick={() => setPreviewMode("dark")}>تیره</button>
              </div>
            </div>
            <div className={`${styles.preview} ${previewMode === "dark" ? "dark" : ""}`} data-preview-mode={previewMode} style={previewStyle}>
              <div className={styles.previewTopline}><span>{storeName || "فروشگاه نمونه"}</span><span className={styles.previewDot} /></div>
              <div className={styles.previewHero}>
                <span className={styles.previewTag}>مجموعهٔ تازه</span>
                <h3>یک انتخاب تازه برای امروز</h3>
                <p>نمونه‌ای از دکمه و انتخاب‌های فروشگاه</p>
                <button type="button" className={styles.previewCta}>مشاهدهٔ محصولات</button>
                <div className={styles.previewSizes} aria-label="نمونهٔ انتخاب سایز">
                  <button type="button">۳۸</button><button type="button" className={styles.previewSizeSelected}>۳۹</button><button type="button">۴۰</button>
                </div>
              </div>
              {product ? <div className={styles.productCard}><RetailProductCard product={product} organization={storeName || "preview"} storefrontPath="/retail-preview" previewOnly view="detailed" /></div> : (
                <p className={styles.previewNote}>هنوز محصولی برای پیش‌نمایش در دسترس نیست.</p>
              )}
            </div>
            <p className={styles.previewNote}>برای خوانایی، طیف رنگ در حالت روشن و تیره خودکار تنظیم می‌شود. کد اصلی رنگ شما حفظ می‌شود.</p>
          </aside>
        </div>
      )}
    </section>
  );
}
