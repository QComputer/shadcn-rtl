"use client";

import type { ReactNode } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type TenantInformationProps = { kind: "about" | "contact"; locale: string; name: string; description?: string | null; address?: string | null; phone?: string | null; email?: string | null; children: ReactNode };
const copy = {
  fa: { about: "دربارهٔ ما", contact: "تماس با ما", unavailable: "اطلاعات این بخش هنوز ثبت نشده است.", details: "راه‌های ارتباط با" },
  en: { about: "About us", contact: "Contact us", unavailable: "This information has not been added yet.", details: "Get in touch with" },
  ar: { about: "من نحن", contact: "اتصل بنا", unavailable: "لم تتم إضافة هذه المعلومات بعد.", details: "تواصل مع" },
};

export function TenantInformation({ kind, locale, name, description, address, phone, email, children }: TenantInformationProps) {
  const text = copy[locale as keyof typeof copy] ?? copy.fa;
  const normalizedPhone = phone?.trim().replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) - (digit >= "۰" ? 0x06f0 : 0x0660))).replace(/[^\d+]/g, "");
  const phoneHref = normalizedPhone && /^\+?\d{3,20}$/.test(normalizedPhone) ? `tel:${normalizedPhone}` : null;
  const normalizedEmail = email?.trim();
  const emailHref = normalizedEmail && normalizedEmail.length <= 254 && /^[^\s@?#;,:%&=]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(normalizedEmail)
    ? `mailto:${encodeURIComponent(normalizedEmail).replace(/%40/gi, "@")}` : null;
  return <Dialog>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent dir={locale === "en" ? "ltr" : "rtl"} className="max-h-[85svh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border-border bg-background text-foreground sm:rounded-3xl [&>button:last-child]:right-auto [&>button:last-child]:end-4">
      <DialogHeader className="pe-5 text-start"><DialogTitle className="text-xl">{text[kind]}</DialogTitle><DialogDescription>{kind === "contact" ? `${text.details} ${name}` : name}</DialogDescription></DialogHeader>
      {kind === "about" ? <p className="whitespace-pre-line text-sm leading-8 text-muted-foreground">{description?.trim() || text.unavailable}</p> : <div className="space-y-3 text-sm leading-7">
        {address?.trim() && <p className="flex items-start gap-3"><MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><span className="whitespace-pre-line">{address}</span></p>}
        {phoneHref && <a href={phoneHref} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Phone className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><bdi dir="ltr">{phone}</bdi></a>}
        {emailHref && <a href={emailHref} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Mail className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><bdi className="break-all" dir="ltr">{normalizedEmail}</bdi></a>}
        {!address?.trim() && !phoneHref && !emailHref && <p className="text-muted-foreground">{text.unavailable}</p>}
      </div>}
    </DialogContent>
  </Dialog>;
}
