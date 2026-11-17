import translations from "./translations.js";
import { damoonAttractionsData } from "./damoon-attractions-data.js";

export const site = {
  name: "هتل دامون",
  eyebrow: "مهمان‌نوازی در شهرکرد",
  tagline: "اقامتی آرام در شهرکرد",
  description: "برای آشنایی با اقامت در هتل دامون شهرکرد، گروه‌های اقامتی و اطلاعات برنامه‌ریزی سفر را ببینید.",
  city: "شهرکرد",
  phone: "+983832261988",
  phoneDisplay: "۰۳۸ ۳۲۲۶ ۱۹۸۸",
  phoneLines: [
    { number: "+983832261984", display: "+98 38 3226 1984" },
    { number: "+983832261985", display: "+98 38 3226 1985" },
    { number: "+983832261987", display: "+98 38 3226 1987" },
    { number: "+983832261988", display: "+98 38 3226 1988" },
  ],
  fax: { number: "+983832261986", display: "+98 38 3226 1986" },
  receptionHours: "۰۶:۰۰ تا ۰۱:۰۰ بامداد روز بعد",
  address: "شهرکرد، خیابان دوازده محرم شمالی، میدان بسیج",
  mapUrl: "https://www.waze.com/live-map/directions?to=place.w.33358147.333319329.15567976",
  imageNote: "تصویر مفهومی برای نمایش چیدمان سایت؛ عکس واقعی هتل نیست.",
  nav: [
    ["/", "خانه"],
    ["/rooms", "اتاق‌ها و سوئیت‌ها"],
    ["/attractions", "دیدنی‌های شهرکرد"],
    ["/facilities", "خدمات مهمانان"],
    ["/virtual-tour", "تور مجازی"],
  ],
};

export const rooms = [
  { slug: "single", title: "اتاق یک‌نفره", description: "گروه اتاق یک‌نفره؛ ظرفیت دقیق و امکانات داخل واحد را از پذیرش بپرسید.", image: "/assets/room-concept-1.webp" },
  { slug: "double", title: "اتاق دونفره", description: "گروه اتاق دونفره؛ ظرفیت دقیق و امکانات داخل واحد را از پذیرش بپرسید.", image: "/assets/room-concept-2.webp" },
  { slug: "suite", title: "سوئیت", description: "گروه سوئیت؛ ظرفیت دقیق و امکانات داخل واحد را از پذیرش بپرسید.", image: "/assets/room-concept-3.webp" },
];

export const gallery = [
  { src: "/assets/architecture-concept.webp", alt: "تصویرسازی مفهومی معماری برای چیدمان صفحه" },
  { src: "/assets/lobby-concept.webp", alt: "تصویرسازی مفهومی فضای لابی، نه عکس هتل" },
  { src: "/assets/room-concept-1.webp", alt: "تصویرسازی مفهومی اتاق، نه عکس هتل" },
  { src: "/assets/room-concept-2.webp", alt: "تصویرسازی مفهومی فضای اقامت، نه عکس هتل" },
  { src: "/assets/room-concept-3.webp", alt: "تصویرسازی مفهومی سوئیت، نه عکس هتل" },
  { src: "/assets/gallery-concept-1.webp", alt: "تصویر مفهومی برای نمایش گالری سایت" },
];

export const pages = {
  "/": {
    title: "اقامت و مهمان‌نوازی در شهرکرد",
    intro: "به هتل دامون خوش آمدید",
    text: "هتل دامون در شهرکرد با ۳۱ واحد اقامتی، شامل ۲۰ اتاق و ۱۱ سوئیت، پذیرای مهمانان است. گروه‌های اقامتی را ببینید و برای برنامه‌ریزی سفر با پذیرش هماهنگ کنید.",
    image: "/assets/architecture-concept.webp",
    actions: [["/rooms", "دیدن اتاق‌ها"], ["/contact", "تماس و هماهنگی"]],
    sections: [
      { heading: "فضای اقامت شما", text: "گروه‌های اتاق و سوئیت را ببینید. اطلاعات دقیق هر واحد پس از تأیید هتل تکمیل می‌شود.", link: "/rooms", label: "آشنایی با اتاق‌ها", image: "/assets/room-concept-2.webp", note: "تصویر مفهومی؛ عکس واقعی نیست." },
      { heading: "آسایش مهمانان", text: "برای آگاهی از خدمات قابل استفاده در طول اقامت، با پذیرش هماهنگ کنید.", link: "/facilities", label: "اطلاعات خدمات مهمانان" },
      { heading: "زمان برنامه‌ریزی اقامت", text: "پذیرش از ساعت ۱۴:۰۰ و خروج تا ساعت ۱۲:۰۰ است. برای هماهنگی سفر با پذیرش در تماس باشید.", link: "/policies", label: "اطلاعات اقامت" },
      { heading: "تور مجازی", text: "با تور مجازی دامون، پیش از سفر با فضای هتل آشنا شوید. نمایش آنلاین تور در حال آماده‌سازی است.", link: "/virtual-tour", label: "تور مجازی دامون", image: "/assets/lobby-concept.webp", note: "تصویر مفهومی؛ نمای تور نیست." },
    ],
  },
  "/rooms": {
    title: "اتاق‌ها و سوئیت‌ها",
    intro: "فضاهای اقامت",
    text: "هتل دامون ۳۱ واحد اقامتی دارد: ۲۰ اتاق و ۱۱ سوئیت. نام گروه‌های اقامتی در این صفحه آمده است؛ ظرفیت دقیق، امکانات اختصاصی، نرخ و موجودی هر گروه نمایش داده نمی‌شوند.",
    sections: rooms.map((room) => ({ heading: room.title, text: room.description, link: `/rooms/${room.slug}`, label: "جزئیات", image: room.image, note: "تصویر مفهومی؛ عکس واقعی اتاق نیست." })),
  },
  "/attractions": {
    title: damoonAttractionsData.labels.fa.headline,
    intro: damoonAttractionsData.labels.fa.headline,
    text: `${damoonAttractionsData.labels.fa.lead} فاصله‌ها مستقیم و تقریبی‌اند؛ پین هتل تأیید نشده و مسافت جاده‌ای در دسترس نیست.`,
  },
  "/restaurant": {
    title: "اطلاعات پذیرایی هتل دامون",
    intro: "اطلاعات پذیرایی مهمانان",
    text: "هتل دامون رستوران فعال یا تالار پذیرایی ندارد. سالن بزرگ صرف صبحانهٔ مهمانان در دست آماده‌سازی است و هنوز بهره‌برداری نمی‌شود.",
    actions: [["/rooms", "مشاهدهٔ اقامتگاه‌ها"], ["/contact", "تماس با پذیرش"]],
    sections: [
      { heading: "صبحانهٔ مهمانان", text: "سالن بزرگ صبحانهٔ رایگان در دست آماده‌سازی است؛ این سالن هنوز عملیاتی نیست. دربارهٔ وضعیت خدمات در تاریخ سفر از پذیرش پرس‌وجو کنید.", link: "/contact", label: "پرس‌وجو از پذیرش" },
      { heading: "برنامه‌ریزی اقامت", text: "اطلاعات اقامت و گروه‌های اتاق و سوئیت را ببینید و برای هماهنگی با پذیرش تماس بگیرید.", link: "/rooms", label: "مشاهدهٔ اقامتگاه‌ها" },
    ],
  },
  "/cafe": {
    title: "پذیرایی در اتاق مهمان",
    intro: "خدمات پذیرایی در اتاق",
    text: "هتل دامون فضای مستقل کافی‌شاپ یا محل نشستن برای کافی‌شاپ ندارد. خدمات نوشیدنی و پذیرایی به مهمانان در اتاق ارائه می‌شود؛ برای جزئیات در تاریخ اقامت با پذیرش هماهنگ کنید.",
    actions: [["/contact", "تماس با هتل"]],
    sections: [{ heading: "پذیرایی در اتاق", text: "خدمات کافی‌شاپ‌مانند فقط برای مهمانان و در اتاق ارائه می‌شود؛ فضای مستقل کافی‌شاپ وجود ندارد. برای اطلاع از خدمات قابل ارائه با پذیرش تماس بگیرید.", link: "/contact", label: "راه‌های تماس" }],
  },
  "/facilities": {
    title: "امکانات هتل",
    intro: "امکانات و خدمات",
    text: "برای اطلاع از خدمات در دسترس، ساعت فعالیت و امکانات هر اتاق، با پذیرش تماس بگیرید.",
    actions: [["/contact", "راه‌های تماس"]],
    sections: [
      { heading: "پذیرش و خدمات", text: "پذیرش همه‌روزه از ساعت ۰۶:۰۰ تا ۰۱:۰۰ بامداد روز بعد فعالیت می‌کند. این ساعت‌ها مربوط به پذیرش است؛ ورود به اتاق از ساعت ۱۴:۰۰ و خروج تا ساعت ۱۲:۰۰ است." },
      { heading: "سالن صبحانه", text: "سالن بزرگ صبحانهٔ رایگان مهمانان در دست آماده‌سازی است و هنوز عملیاتی نیست. خدمات موجود را برای تاریخ سفر از پذیرش بپرسید.", link: "/restaurant", label: "اطلاعات پذیرایی مهمانان" },
      { heading: "پذیرایی در اتاق", text: "خدمات نوشیدنی و پذیرایی به مهمانان در اتاق ارائه می‌شود؛ هتل فضای مستقل کافی‌شاپ ندارد.", link: "/cafe", label: "اطلاعات پذیرایی در اتاق" },
      { heading: "پارکینگ", text: "پارکینگ هتل با ظرفیت محدود در دسترس است؛ برای هماهنگی و اطمینان از امکان استفاده در زمان سفر، پیشاپیش با پذیرش تماس بگیرید.", link: "/contact", label: "تماس با پذیرش" }
    ],
  },
  "/gallery": {
    title: "گالری هتل دامون",
    intro: "گالری تصاویر",
    text: "تصاویر زیر صرفاً تصاویر مفهومی طراحی هستند و وضعیت یا ظاهر واقعی هتل را نشان نمی‌دهند. تصاویر قابل انتشار پس از تأیید جایگزین می‌شوند.",
    gallery: true,
  },
  "/about": {
    title: "دربارهٔ هتل دامون",
    intro: "دربارهٔ هتل",
    text: "هتل دامون در شهرکرد، با ۲۰ اتاق و ۱۱ سوئیت، در مجموع ۳۱ واحد اقامتی دارد. برای هماهنگی اقامت و پرسش دربارهٔ خدمات با پذیرش تماس بگیرید.",
    actions: [["/contact", "تماس با هتل"]],
    sections: [
      { heading: "مهمان‌نوازی دامون", text: "دامون با رویکردی گرم، صمیمی و آرام، می‌خواهد مهمان در طول اقامت احساس آسودگی و خانهٔ دوم داشته باشد." },
      { heading: "اقامت در دامون", text: "اتاق یک‌تخته، اتاق دوتخته و سوئیت‌های سه، چهار و پنج‌تخته در گروه‌های اقامتی سایت معرفی شده‌اند. برای ظرفیت دقیق، امکانات واحد و نرخ روز با پذیرش هماهنگ کنید.", link: "/rooms", label: "دیدن گروه‌های اقامتی" },
      { heading: "زمان ورود و خروج", text: "زمان ورود ساعت ۱۴:۰۰ و زمان خروج ساعت ۱۲:۰۰ است.", link: "/policies", label: "اطلاعات اقامت" },
    ],
  },
  "/contact": {
    title: "تماس با هتل دامون",
    intro: "برای هماهنگی با ما در تماس باشید",
    text: "برای هماهنگی اقامت و پرسش دربارهٔ خدمات با پذیرش هتل تماس بگیرید. دامون در شهرکرد، خیابان دوازده محرم شمالی، میدان بسیج قرار دارد.",
    sections: [
      { heading: "برای هماهنگی اقامت", text: "تاریخ ورود و خروج، تعداد مهمانان و گروه اقامتی موردنظر را هنگام تماس مطرح کنید. ظرفیت دقیق، نرخ و موجودی را پذیرش اعلام می‌کند.", link: "/rooms", label: "مرور گروه‌های اقامتی" },
      { heading: "نشانی هتل", text: "هتل دامون در شهرکرد، خیابان دوازده محرم شمالی، میدان بسیج قرار دارد. از دکمهٔ مسیریابی برای مشاهدهٔ مسیر استفاده کنید." },
    ],
  },
  "/policies": {
    title: "قوانین و حریم خصوصی",
    intro: "قوانین اقامت و حریم خصوصی",
    text: "ورود از ساعت ۱۴:۰۰ و خروج تا ساعت ۱۲:۰۰ است. برای سایر شرایط اقامت با پذیرش هماهنگ کنید.",
    sections: [
      { heading: "زمان ورود و خروج", text: "زمان ورود ساعت ۱۴:۰۰ و زمان خروج ساعت ۱۲:۰۰ است." },
      { heading: "انتخاب تاریخ و مهمان", text: "انتخاب تاریخ و تعداد مهمان در سایت برای برنامه‌ریزی است؛ اتاقی رزرو یا نگه داشته نمی‌شود و پرداخت آنلاین انجام نمی‌شود. برای نهایی‌کردن اقامت با پذیرش هماهنگ کنید." },
      { heading: "هماهنگی رزرو", text: "برای آگاهی از نرخ، موجودی، شرایط تغییر یا لغو و مدارک موردنیاز، با پذیرش تماس بگیرید و پاسخ را برای تاریخ سفر خود تأیید کنید.", link: "/contact", label: "تماس با پذیرش" },
      { heading: "حریم خصوصی", text: "انتخاب رنگ و حالت نمایش در مرورگر شما ذخیره می‌شود. تاریخ، تعداد بزرگسالان و کودکان و سن‌های واردشده کودکان در همین نشست مرورگر و پیوند هماهنگی نگه داشته می‌شود. هنگام اشتراک‌گذاری پیوند، این اطلاعات نیز در دسترس دریافت‌کننده است؛ در این نسخه فرم ارسال نام یا شماره تماس و پرداخت آنلاین وجود ندارد." }
    ],
  },
  "/virtual-tour": {
    title: "تور مجازی هتل دامون",
    intro: "تور مجازی",
    text: "دامون از خدمت تور مجازی بهره می‌برد. نمایش آنلاین تور در این سایت در حال آماده‌سازی است؛ برای آشنایی با فضاهای اقامت، صفحهٔ اتاق‌ها را ببینید.",
    badge: "نمایش آنلاین در حال آماده‌سازی",
    image: "/assets/lobby-concept.webp",
    actions: [["/contact", "تماس با هتل"]],
    sections: [{ heading: "آشنایی با فضاهای دامون", text: "تور پس از آماده‌شدن نمایشگر از همین صفحه در دسترس خواهد بود. تصاویر گالری این سایت مفهومی هستند و نمای واقعی تور را نشان نمی‌دهند.", link: "/contact", label: "تماس با هتل" }],
  },
};

export function normalizePath(pathname) {
  let path = decodeURIComponent(pathname || "/").replace(/\/+$/, "") || "/";
  const prefix = path.match(/^\/(fa|en|ar)(?=\/|$)/)?.[1];
  if (prefix) path = path.slice(prefix.length + 1) || "/";
  if (path === "/rooms/suite-3-bed" || path === "/rooms/suite-4-5-bed") path = "/rooms/suite";
  return path;
}

export function localeForPath(pathname) {
  return decodeURIComponent(pathname || "/").match(/^\/(fa|en|ar)(?=\/|$)/)?.[1] || "fa";
}

export function siteForLocale(locale = "fa") {
  return locale === "fa" ? site : translations[locale]?.site || site;
}

export function galleryForLocale(locale = "fa") {
  return locale === "fa" ? gallery : translations[locale]?.gallery || gallery;
}

export function roomForLocale(slug, locale = "fa") {
  const original = rooms.find((item) => item.slug === slug);
  if (!original || locale === "fa") return original;
  return translations[locale]?.rooms?.[slug] ? { ...original, ...translations[locale].rooms[slug] } : original;
}

export function pageForPath(path, locale = "fa") {
  const attractionMatch = path.match(/^\/attractions\/([a-z0-9-]+)$/);
  if (attractionMatch) {
    const attraction = damoonAttractionsData.attractions.find((item) => item.id === attractionMatch[1]);
    if (!attraction) return null;
    const copy = attraction.content[locale] || attraction.content.fa;
    return { path, title: copy.name, intro: copy.name, text: copy.summary };
  }
  const source = locale === "fa" ? pages : translations[locale]?.pages;
  if (source?.[path]) {
    const base = pages[path] || {};
    const localized = { ...base, ...source[path], path };
    if (base.sections && localized.sections) {
      localized.sections = localized.sections.map((section, index) => ({ ...base.sections[index], ...section }));
    }
    return localized;
  }
  const roomMatch = path.match(/^\/rooms\/([a-z0-9-]+)$/i);
  if (roomMatch) {
    const room = roomForLocale(roomMatch[1], locale);
    if (room) return {
      path,
      title: room.title,
      intro: room.title,
      text: locale === "fa"
        ? `${room.description} ظرفیت دقیق، امکانات اختصاصی، نرخ و موجودی را برای تاریخ سفر از پذیرش بپرسید.`
        : `${room.description} ${translations[locale].roomDetails.textSuffix}`,
      image: room.image,
      imageNote: locale === "fa" ? "تصویر مفهومی؛ عکس واقعی اتاق نیست." : translations[locale].roomDetails.imageNote,
      actions: [locale === "fa" ? ["/contact", "تماس برای هماهنگی"] : translations[locale].roomDetails.action],
      sections: locale === "fa" ? [
        { heading: "پیش از انتخاب", text: "عنوان این گروه به‌تنهایی جزئیات چیدمان، تخت‌ها یا امکانات داخل واحد را مشخص نمی‌کند. هنگام تماس، تعداد مهمانان و نیازهای خود را بگویید تا پذیرش گزینهٔ مناسب را بررسی کند.", link: "/contact", label: "گفت‌وگو با پذیرش" },
        { heading: "زمان‌بندی اقامت", text: "ورود ساعت ۱۴:۰۰ و خروج ساعت ۱۲:۰۰ ظهر است. ظرفیت دقیق، نرخ و موجودی را برای تاریخ دلخواه از هتل بپرسید.", link: "/policies", label: "اطلاعات زمان ورود و خروج" },
        { heading: "امکانات هتل", text: "برای اطلاع از امکانات در دسترس در این واحد، خدمات و ساعت فعالیت آن‌ها، از پذیرش سؤال کنید.", link: "/facilities", label: "مشاهدهٔ امکانات" },
      ] : translations[locale].roomDetails.shared,
    };
  }
  return null;
}

