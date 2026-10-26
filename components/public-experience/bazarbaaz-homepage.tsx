import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, CalendarDays, Check, CircleCheck, Store, UsersRound } from "lucide-react";
import { BazarbaazLogo } from "@/components/brand/BazarbaazLogo";
import { DashboardEntryLink } from "@/components/public-experience/dashboard-entry-link";
import { HomepageHeroVisual } from "@/components/public-experience/homepage-hero-visual";
import { getBusinessShowcaseSamples } from "@/lib/public-experience/business-showcase";
import { buttonVariants } from "@/components/ui/button";

type Locale = "fa" | "en" | "ar";

const content = {
  fa: {
    nav: ["امکانات", "نمونه‌ها", "شروع کار"],
    eyebrow: "برای رشد کسب‌وکارهای محلی",
    title: "کسب‌وکارت را آنلاین راه بینداز و از یک پنل مدیریت کن",
    intro: "صفحه کسب‌وکار، محصولات و ارتباط با مشتریانت را یک‌جا بساز و هر روز ساده‌تر مدیریت کن.",
    start: "کسب‌وکارت را بساز",
    examples: "دیدن نمونه‌ها",
    promises: ["یک صفحه برای کسب‌وکارت", "مدیریت ساده و یکپارچه"],
    featureEyebrow: "همه‌چیز کنار هم",
    featureTitle: "از معرفی تا مدیریت روزانه، ساده و یکپارچه",
    features: [
      { icon: Store, title: "صفحه آنلاین کسب‌وکار", body: "اطلاعات، خدمات و محصولاتت را در یک صفحه مرتب و آماده‌ی اشتراک‌گذاری معرفی کن." },
      { icon: CalendarDays, title: "مدیریت سفارش و نوبت", body: "درخواست‌ها، سفارش‌ها و زمان‌های رزرو را از یک فضای روشن دنبال کن." },
      { icon: UsersRound, title: "ارتباط بهتر با مشتری", body: "گفت‌وگوها و اطلاعات مشتریانت را کنار فعالیت‌های روزانه نگه دار." },
    ],
    showcaseEyebrow: "نمونه کسب‌وکارها",
    showcaseTitle: "ببین حضور آنلاین می‌تواند چطور باشد",
    viewSample: "مشاهده نمونه",
    stepsEyebrow: "شروع در سه گام",
    stepsTitle: "راه‌اندازی ساده، مدیریت یک‌جا",
    steps: ["حساب کسب‌وکارت را بساز", "صفحه و خدماتت را معرفی کن", "از پنل، کارها را مدیریت کن"],
    finalTitle: "آماده‌ای کسب‌وکارت را آنلاین کنی؟",
    finalBody: "همین حالا حساب بساز و فضای کاری‌ات را راه‌اندازی کن.",
    brand: "بازارباز",
    home: "صفحه اصلی",
  },
  en: {
    nav: ["Features", "Examples", "How it works"], eyebrow: "Made for local businesses",
    title: "Bring your business online and manage it from one place",
    intro: "Create your business page, share your products, and keep everyday work moving from one simple workspace.",
    start: "Get started", examples: "Explore examples", promises: ["One page for your business", "Simple, connected management"], featureEyebrow: "All in one place",
    featureTitle: "From your first introduction to the everyday details",
    features: [
      { icon: Store, title: "Your business online", body: "Present your business, services, and products on a page that is easy to share." },
      { icon: CalendarDays, title: "Orders and appointments", body: "Keep requests, orders, and bookings organized in one clear workspace." },
      { icon: UsersRound, title: "Closer customer relationships", body: "Keep customer details and conversations close to your daily work." },
    ],
    showcaseEyebrow: "Business examples", showcaseTitle: "See what your online presence can look like",
    viewSample: "View example", stepsEyebrow: "Get started in three steps", stepsTitle: "Simple to set up, easy to manage",
    steps: ["Create your business account", "Add your page and services", "Manage your work from one place"],
    finalTitle: "Ready to bring your business online?", finalBody: "Create an account and set up your workspace today.",
    brand: "Bazarbaaz",
  },
  ar: {
    nav: ["المزايا", "أمثلة", "كيف تبدأ"], eyebrow: "لنمو الأعمال المحلية",
    title: "أطلق نشاطك التجاري عبر الإنترنت وأدِره من مكان واحد",
    intro: "أنشئ صفحة لنشاطك، واعرض منتجاتك، وأدر أعمالك اليومية بسهولة من مساحة واحدة.",
    start: "ابدأ الآن", examples: "استكشف الأمثلة", promises: ["صفحة واحدة لنشاطك", "إدارة سهلة ومتكاملة"], featureEyebrow: "كل شيء في مكان واحد",
    featureTitle: "من التعريف بنشاطك إلى إدارة تفاصيله اليومية",
    features: [
      { icon: Store, title: "صفحة لنشاطك التجاري", body: "عرّف بخدماتك ومنتجاتك في صفحة سهلة المشاركة." },
      { icon: CalendarDays, title: "إدارة الطلبات والمواعيد", body: "تابع الطلبات والحجوزات من مساحة عمل واضحة." },
      { icon: UsersRound, title: "تواصل أفضل مع العملاء", body: "احتفظ بمعلومات العملاء وتواصلهم بجانب أعمالك اليومية." },
    ],
    showcaseEyebrow: "أمثلة للأعمال", showcaseTitle: "اكتشف شكل حضورك التجاري عبر الإنترنت",
    viewSample: "عرض المثال", stepsEyebrow: "ابدأ بثلاث خطوات", stepsTitle: "إعداد بسيط وإدارة من مكان واحد",
    steps: ["أنشئ حساب نشاطك التجاري", "أضف صفحتك وخدماتك", "أدر أعمالك من مكان واحد"],
    finalTitle: "هل أنت مستعد لإطلاق نشاطك عبر الإنترنت؟", finalBody: "أنشئ حسابك وابدأ إعداد مساحة عملك اليوم.",
    brand: "بازارباز",
  },
} as const;

export function BazarBaazHomepage({ locale }: { locale: string }) {
  const lang: Locale = locale === "en" || locale === "ar" ? locale : "fa";
  const copy = content[lang];
  const showcaseSamples = getBusinessShowcaseSamples(lang);
  const direction = lang === "en" ? "ltr" : "rtl";
  const startHref = `/${lang}/register/organization`;

  return (
    <div dir={direction} className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="container mx-auto flex min-h-16 items-center justify-between gap-4 px-4">
          <Link href={`/${lang}`} aria-label={copy.brand} className="shrink-0">
            <BazarbaazLogo language={lang === "fa" ? "fa" : "en"} className="h-9 w-auto" />
          </Link>
          <nav aria-label={lang === "fa" ? "ناوبری اصلی" : lang === "ar" ? "التنقل الرئيسي" : "Main navigation"} className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">{copy.nav[0]}</a>
            <a href="#examples" className="transition-colors hover:text-foreground">{copy.nav[1]}</a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">{copy.nav[2]}</a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <DashboardEntryLink locale={lang} />
            <Link href={startHref} className={buttonVariants({ size: "sm", className: "rounded-lg" })}>{copy.start}<ArrowLeft className="ms-2 h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
        <nav aria-label={lang === "fa" ? "ناوبری اصلی" : lang === "ar" ? "التنقل الرئيسي" : "Main navigation"} className="container mx-auto flex gap-5 overflow-x-auto px-4 pb-3 text-sm font-medium text-muted-foreground md:hidden">
          <a href="#features" className="shrink-0">{copy.nav[0]}</a>
          <a href="#examples" className="shrink-0">{copy.nav[1]}</a>
          <a href="#how-it-works" className="shrink-0">{copy.nav[2]}</a>
        </nav>
      </header>

      <section className="relative isolate border-b bg-gradient-to-b from-primary/[0.07] via-background to-background">
        <div aria-hidden="true" className="pointer-events-none absolute -top-36 start-1/4 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="container mx-auto grid gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-4 lg:py-20">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-sm font-semibold text-primary"><CircleCheck className="h-4 w-4" aria-hidden="true" />{copy.eyebrow}</p>
            <h1 className="text-4xl font-black leading-[1.3] tracking-tight sm:text-5xl lg:text-6xl">{copy.title}</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">{copy.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={startHref} className={buttonVariants({ size: "lg", className: "rounded-xl px-6 shadow-lg shadow-primary/15" })}>{copy.start}<ArrowLeft className="ms-2 h-4 w-4" aria-hidden="true" /></Link>
              <a href="#examples" className={buttonVariants({ size: "lg", variant: "outline", className: "rounded-xl bg-background/80 px-6" })}>{copy.examples}<ArrowUpLeft className="ms-2 h-4 w-4" aria-hidden="true" /></a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {copy.promises.map((item) => <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-primary" aria-hidden="true" />{item}</span>)}
            </div>
          </div>
          <div className="min-w-0"><HomepageHeroVisual locale={lang} /></div>
        </div>
      </section>

      <main>
        <section id="features" className="scroll-mt-20 py-16 sm:py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold text-primary">{copy.featureEyebrow}</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{copy.featureTitle}</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {copy.features.map(({ icon: Icon, title, body }) => (
                <article key={title} className="group rounded-2xl border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                  <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="examples" className="scroll-mt-20 border-y bg-muted/25 py-16 sm:py-20">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-sm font-bold text-primary">{copy.showcaseEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{copy.showcaseTitle}</h2></div>
              <Link href={startHref} className={buttonVariants({ variant: "ghost", className: "rounded-lg" })}>{copy.start}<ArrowLeft className="ms-2 h-4 w-4" aria-hidden="true" /></Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {showcaseSamples.map((sample) => (
                <article key={sample.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-lg">
                  <Link href={sample.href} aria-label={`${sample.name}: ${copy.viewSample}`} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                      <Image src={sample.image} alt={sample.alt} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />
                      <span className="absolute bottom-3 start-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold backdrop-blur">{sample.category}</span>
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-extrabold">{sample.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{sample.description}</p>
                      <span className="mt-4 inline-flex items-center text-sm font-bold text-primary">{copy.viewSample}<ArrowLeft className="ms-1.5 h-4 w-4" aria-hidden="true" /></span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-bold text-primary">{copy.stepsEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{copy.stepsTitle}</h2></div>
            <ol className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
              {copy.steps.map((step, index) => <li key={step} className="flex items-start gap-4 rounded-2xl border bg-card p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">{index + 1}</span><p className="pt-1.5 font-bold leading-6">{step}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="px-4 pb-16 sm:pb-24">
          <div className="container mx-auto overflow-hidden rounded-3xl bg-primary px-6 py-10 text-center text-primary-foreground sm:px-10 sm:py-14">
            <h2 className="text-2xl font-black sm:text-3xl">{copy.finalTitle}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-primary-foreground/80 sm:text-base">{copy.finalBody}</p>
            <Link href={startHref} className={buttonVariants({ size: "lg", variant: "secondary", className: "mt-6 rounded-xl px-7 font-bold" })}>{copy.start}<ArrowLeft className="ms-2 h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
    </div>
  );
}
