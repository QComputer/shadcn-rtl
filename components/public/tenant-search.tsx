"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { appPath } from "@/lib/app-base-path";
import { publicCatalogProductsPageSchema } from "@/lib/public-catalog/contracts";
import { matchesTenantSearch } from "@/lib/tenant-search";
import { TenantInformation } from "./tenant-information";

const labels = {
  fa: { title: "جست‌وجو", hint: "در محصولات و محتوای همین سایت جست‌وجو کنید", placeholder: "نام محصول، برند یا موضوع…", all: "همه", products: "محصولات", pages: "درباره و تماس", empty: "نتیجه‌ای پیدا نشد. عبارت دیگری را امتحان کنید.", start: "دنبال چه چیزی می‌گردید؟", error: "دریافت محصولات انجام نشد.", retry: "تلاش دوباره", more: "مشاهدهٔ همهٔ نتایج", about: "دربارهٔ ما", contact: "تماس با ما", loading: "در حال جست‌وجو…" },
  en: { title: "Search", hint: "Search products and content on this site", placeholder: "Product, brand or topic…", all: "All", products: "Products", pages: "About & contact", empty: "No results. Try another search.", start: "What are you looking for?", error: "Products could not be loaded.", retry: "Try again", more: "View all results", about: "About us", contact: "Contact us", loading: "Searching…" },
  ar: { title: "بحث", hint: "ابحث في منتجات ومحتوى هذا الموقع", placeholder: "منتج أو علامة تجارية أو موضوع…", all: "الكل", products: "المنتجات", pages: "من نحن والتواصل", empty: "لا توجد نتائج. جرّب عبارة أخرى.", start: "عمّ تبحث؟", error: "تعذر تحميل المنتجات.", retry: "حاول مجددًا", more: "عرض جميع النتائج", about: "من نحن", contact: "اتصل بنا", loading: "جارٍ البحث…" },
};
type Props = { locale: string; name: string; organization?: string; storefrontHref: string; searchHref?: string; description?: string | null; address?: string | null; phone?: string | null; email?: string | null; pages?: Array<{ label: string; href: string; description?: string }> };

export function TenantSearch(props: Props) {
  const { locale, name, organization, storefrontHref, searchHref, description, address, phone, email, pages = [] } = props;
  const copy = labels[locale as keyof typeof labels] ?? labels.fa;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "products" | "pages">("all");
  const [result, setResult] = useState<{ key: string; products: ReturnType<typeof publicCatalogProductsPageSchema.parse>["products"]; failed: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const inputId = useId();
  const panelId = useId();
  const term = query.trim();
  const requestKey = `${organization}:${term}:${retry}`;
  const includeProducts = Boolean(organization && tab !== "pages");
  const loading = open && includeProducts && Boolean(term) && result?.key !== requestKey;

  useEffect(() => {
    if (!open || !term || !includeProducts || !organization || (result?.key === requestKey && !result.failed)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term, limit: "6", sort: "relevance" });
        const response = await fetch(appPath(`/api/public/v1/organizations/${encodeURIComponent(organization)}/products?${params}`), { signal: controller.signal, headers: { accept: "application/json" } });
        if (!response.ok) throw new Error("search unavailable");
        const payload = await response.json();
        const parsed = publicCatalogProductsPageSchema.parse(payload.data);
        if (!controller.signal.aborted) setResult({ key: requestKey, products: parsed.products, failed: false });
      } catch {
        if (!controller.signal.aborted) setResult({ key: requestKey, products: [], failed: true });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, term, includeProducts, organization, requestKey, result?.key, result?.failed]);

  const products = includeProducts && term && result?.key === requestKey ? result.products : [];
  const info = tab === "products" ? [] : ([
    { kind: "about" as const, label: copy.about, text: description },
    { kind: "contact" as const, label: copy.contact, text: [address, phone, email].filter(Boolean).join(" · ") },
  ]).filter(item => !term || matchesTenantSearch(term, item.label, name, item.text));
  const pageResults = tab === "products" ? [] : pages.filter(page => !term || matchesTenantSearch(term, page.label, page.description));
  const failed = includeProducts && result?.key === requestKey && result.failed;
  const allHref = searchHref ? `${searchHref}?${new URLSearchParams({ q: term })}` : null;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label={copy.title} className="h-11 w-11 shrink-0 rounded-full"><Search className="h-5 w-5" /></Button></DialogTrigger>
    <DialogContent dir={locale === "en" ? "ltr" : "rtl"} className="flex max-h-[85svh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 text-foreground shadow-2xl sm:rounded-3xl [&>button:last-child]:right-auto [&>button:last-child]:end-4">
      <DialogHeader className="shrink-0 px-5 pb-4 pt-6 text-start sm:px-6">
        <DialogTitle className="pe-8 text-xl">{copy.title} <span className="text-muted-foreground">{name}</span></DialogTitle>
        <DialogDescription className="pt-2 text-sm">{copy.hint}</DialogDescription>
      </DialogHeader>
      <form role="search" action={searchHref ? appPath(searchHref) : undefined} onSubmit={event => { if (!searchHref || !term || tab === "pages") event.preventDefault(); else setOpen(false); }} className="mx-5 flex shrink-0 items-center gap-3 rounded-2xl border border-input bg-muted/40 px-4 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:mx-6">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <label htmlFor={inputId} className="sr-only">{copy.title}</label>
        <input id={inputId} name="q" type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} placeholder={copy.placeholder} autoComplete="off" className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
      </form>
      <div role="tablist" aria-label={copy.title} className="mx-5 my-4 flex shrink-0 gap-1 rounded-xl bg-muted/50 p-1 sm:mx-6">
        {(["all", ...(organization ? ["products" as const] : []), "pages"] as const).map(value => <button key={value} id={`${panelId}-${value}`} role="tab" tabIndex={tab === value ? 0 : -1} type="button" aria-selected={tab === value} aria-controls={panelId} onClick={() => setTab(value)} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const tabs = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const index = tabs.indexOf(event.currentTarget);
          const forward = event.key === (locale === "en" ? "ArrowRight" : "ArrowLeft");
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (forward ? 1 : tabs.length - 1)) % tabs.length;
          tabs[next].focus(); tabs[next].click();
        }} className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{copy[value]}</button>)}
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${tab}`} className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6" aria-busy={loading}>
        <div role="status" className="sr-only">{loading ? copy.loading : ""}</div>
        {!term && <p className="py-3 text-sm text-muted-foreground">{copy.start}</p>}
        {loading && <p className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />{copy.loading}</p>}
        {failed && <div className="flex items-center justify-between gap-3 py-3 text-sm"><p role="alert">{copy.error}</p><Button variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>{copy.retry}</Button></div>}
        {products.length > 0 && <section aria-label={copy.products} className="mb-4"><h3 className="mb-2 text-xs font-medium text-muted-foreground">{copy.products}</h3><ul className="space-y-1">{products.map(product => <li key={product.id}><Link href={`${storefrontHref.replace(/\/$/, "")}/product/${encodeURIComponent(product.slug ?? product.id)}`} onClick={() => setOpen(false)} className="flex min-h-20 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {product.media.card && <Image src={product.media.card} alt="" width={64} height={64} unoptimized className="h-16 w-16 shrink-0 rounded-lg bg-card object-cover" />}
          <span className="min-w-0"><span className="block text-sm font-semibold leading-6">{product.name}</span><span className="text-xs text-muted-foreground">{product.category.name}</span></span>
        </Link></li>)}</ul></section>}
        {(info.length > 0 || pageResults.length > 0) && <section aria-label={copy.pages} className="space-y-1 border-t border-border pt-3"><h3 className="mb-2 text-xs font-medium text-muted-foreground">{copy.pages}</h3>{info.map(item => <TenantInformation key={item.kind} kind={item.kind} locale={locale} name={name} description={description} address={address} phone={phone} email={email}><button type="button" className="block w-full rounded-xl px-3 py-3 text-start text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block font-medium">{item.label}</span>{item.text && <span className="mt-1 line-clamp-2 block text-xs leading-6 text-muted-foreground">{item.text}</span>}</button></TenantInformation>)}{pageResults.map(page => <Link key={page.href} href={page.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{page.label}</Link>)}</section>}
        {term && !loading && !failed && products.length === 0 && info.length === 0 && pageResults.length === 0 && <p role="status" className="py-8 text-center text-sm text-muted-foreground">{copy.empty}</p>}
      </div>
      {allHref && term && tab !== "pages" && <Link href={allHref} onClick={() => setOpen(false)} className="flex min-h-14 shrink-0 items-center justify-between border-t border-border px-6 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">{copy.more}<ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" /></Link>}
    </DialogContent>
  </Dialog>;
}
