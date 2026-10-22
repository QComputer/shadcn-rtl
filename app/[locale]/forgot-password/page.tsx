import Link from "next/link";
import { appPath } from "@/lib/app-base-path";
import { RECOVERY_UNAVAILABLE } from "@/lib/security/recovery.server";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <main dir="rtl" className="mx-auto flex min-h-[70dvh] max-w-lg items-center px-4 py-12">
    <section className="w-full space-y-5 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm" aria-labelledby="recovery-title">
      <h1 id="recovery-title" className="text-xl font-semibold">بازیابی امن حساب</h1>
      <p role="status" className="rounded-lg bg-muted p-4 text-sm leading-7">{RECOVERY_UNAVAILABLE}</p>
      <p className="text-sm leading-7 text-muted-foreground">اگر هنوز وارد حساب هستید، از تنظیمات حساب و با رمز فعلی، رمز خود را تغییر دهید. پس از تغییر یا بازیابی رمز، ورود دوباره در همه دستگاه‌ها لازم است.</p>
      <p className="text-sm leading-7 text-muted-foreground">پیوند بازیابی معتبر فقط ۱۵ دقیقه اعتبار خواهد داشت و یک بار قابل استفاده است. پس از انقضا باید درخواست جدیدی ثبت شود. در حال حاضر هیچ کد یا پیوندی ارسال نمی‌شود.</p>
      <Link href={appPath(`/${locale}/login`)} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4">بازگشت به ورود</Link>
    </section>
  </main>;
}
