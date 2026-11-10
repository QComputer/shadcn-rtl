import translations from "./translations.js";

export const site = {
  name: "هتل دامون",
  eyebrow: "مهمان‌نوازی در شهرکرد",
  tagline: "برای لحظه‌هایی آرام، در دل شهرکرد",
  description: "در هتل دامون، برای اقامت و دورهمی خود برنامه‌ریزی کنید.",
  city: "شهرکرد",
  phone: "+983832261988",
  phoneDisplay: "۰۳۸ ۳۲۲۶ ۱۹۸۸",
  address: "شهرکرد، خیابان دوازده محرم شمالی، میدان بسیج",
  mapUrl: "https://www.waze.com/live-map/directions?to=place.w.33358147.333319329.15567976",
  imageNote: "تصویر مفهومی برای نمایش چیدمان سایت؛ عکس واقعی هتل نیست.",
  nav: [
    ["/", "خانه"],
    ["/rooms", "اتاق‌ها و سوئیت‌ها"],
    ["/restaurant", "رستوران"],
    ["/cafe", "کافی‌شاپ"],
    ["/virtual-tour", "تور مجازی"],
  ],
};

export const rooms = [
  { slug: "single", title: "اتاق یک‌تخته", description: "گروه اقامتی یک‌تختهٔ هتل دامون برای برنامه‌هایی با یک مهمان معرفی شده است.", image: "/damoon-front/assets/room-concept-1.webp" },
  { slug: "double", title: "اتاق دوتخته", description: "گروه اقامتی دوتخته برای برنامهٔ اقامت دو مهمان معرفی شده است.", image: "/damoon-front/assets/room-concept-2.webp" },
  { slug: "suite-3-bed", title: "سوئیت سه‌تخته", description: "سوئیت سه‌تخته یکی از گروه‌های اقامتی معرفی‌شدهٔ دامون است.", image: "/damoon-front/assets/room-concept-3.webp" },
  { slug: "suite-4-5-bed", title: "سوئیت چهار و پنج‌تخته", description: "سوئیت‌های چهار و پنج‌تخته برای گروه‌های اقامتی با این عنوان معرفی شده‌اند.", image: "/damoon-front/assets/lobby-concept.webp" },
];

export const gallery = [
  { src: "/damoon-front/assets/architecture-concept.webp", alt: "تصویرسازی مفهومی معماری برای چیدمان صفحه" },
  { src: "/damoon-front/assets/lobby-concept.webp", alt: "تصویرسازی مفهومی فضای لابی، نه عکس هتل" },
  { src: "/damoon-front/assets/room-concept-1.webp", alt: "تصویرسازی مفهومی اتاق، نه عکس هتل" },
  { src: "/damoon-front/assets/room-concept-2.webp", alt: "تصویرسازی مفهومی فضای اقامت، نه عکس هتل" },
  { src: "/damoon-front/assets/room-concept-3.webp", alt: "تصویرسازی مفهومی سوئیت، نه عکس هتل" },
  { src: "/damoon-front/assets/gallery-concept-1.webp", alt: "تصویر مفهومی برای نمایش گالری سایت" },
];

export const pages = {
  "/": {
    title: "اقامت و مهمان‌نوازی در شهرکرد",
    intro: "به هتل دامون خوش آمدید",
    text: "برای آشنایی با فضاهای اقامت، رستوران و کافی‌شاپ هتل دامون، از بخش‌های سایت دیدن کنید.",
    image: "/damoon-front/assets/architecture-concept.webp",
    actions: [["/rooms", "دیدن اتاق‌ها"], ["/contact", "تماس و هماهنگی"]],
    sections: [
      { heading: "فضای اقامت شما", text: "گروه‌های اتاق و سوئیت را ببینید. اطلاعات دقیق هر واحد پس از تأیید هتل تکمیل می‌شود.", link: "/rooms", label: "آشنایی با اتاق‌ها", image: "/damoon-front/assets/room-concept-2.webp", note: "تصویر مفهومی؛ عکس واقعی نیست." },
      { heading: "رستوران هتل", text: "رستوران هتل آماده است. برای هماهنگی و دریافت اطلاعات روز، با هتل در تماس باشید.", link: "/restaurant", label: "دربارهٔ رستوران", image: "/damoon-front/assets/gallery-concept-2.webp", note: "تصویر مفهومی؛ عکس رستوران نیست." },
      { heading: "کافی‌شاپ لوکس", text: "کافی‌شاپ هتل در حال تکمیل است. اطلاعات افتتاح و خدمات پس از آماده‌شدن اعلام می‌شود.", link: "/cafe", label: "مشاهدهٔ وضعیت", image: "/damoon-front/assets/gallery-concept-3.webp", note: "تصویر مفهومی؛ عکس کافی‌شاپ نیست.", badge: "در حال تکمیل" },
      { heading: "تور مجازی", text: "با تور مجازی دامون، پیش از سفر با فضای هتل آشنا شوید. نمایش آنلاین تور در حال آماده‌سازی است.", link: "/virtual-tour", label: "تور مجازی دامون", image: "/damoon-front/assets/lobby-concept.webp", note: "تصویر مفهومی؛ نمای تور نیست." },
    ],
  },
  "/rooms": {
    title: "اتاق‌ها و سوئیت‌ها",
    intro: "فضاهای اقامت",
    text: "نام گروه‌های اقامتی در این صفحه آمده است. ظرفیت، امکانات اختصاصی، نرخ و موجودی تا تأیید نهایی نمایش داده نمی‌شوند.",
    sections: rooms.map((room) => ({ heading: room.title, text: room.description, link: `/rooms/${room.slug}`, label: "جزئیات", image: room.image, note: "تصویر مفهومی؛ عکس واقعی اتاق نیست." })),
  },
  "/restaurant": {
    title: "رستوران هتل دامون",
    intro: "رستوران هتل آماده است",
    text: "رستوران هتل دامون آماده است. برای اطلاع از منو، ساعت فعالیت و هماهنگی مراجعه، با پذیرش تماس بگیرید؛ این جزئیات در سایت منتشر نشده‌اند.",
    image: "/damoon-front/assets/gallery-concept-2.webp",
    actions: [["/contact", "راه‌های تماس"]],
    sections: [
      { heading: "هماهنگی مراجعه", text: "پیش از مراجعه، دربارهٔ ساعت فعالیت و شرایط پذیرش از هتل سؤال کنید تا اطلاعات روز را دریافت کنید.", link: "/contact", label: "تماس با پذیرش" },
      { heading: "صبحانهٔ هتل", text: "برای اطلاع از وضعیت فعلی صبحانه و زمان سرو احتمالی، با پذیرش هماهنگ کنید.", link: "/facilities", label: "دیدن امکانات" },
    ],
  },
  "/cafe": {
    title: "کافی‌شاپ هتل دامون",
    intro: "کافی‌شاپ لوکس در حال تکمیل است",
    text: "کافی‌شاپ لوکس هتل دامون در حال تکمیل است. زمان افتتاح، منو و ساعت فعالیت هنوز برای انتشار اعلام نشده‌اند.",
    badge: "در حال تکمیل",
    image: "/damoon-front/assets/gallery-concept-3.webp",
    actions: [["/contact", "تماس با هتل"]],
    sections: [{ heading: "وضعیت کافی‌شاپ", text: "کافی‌شاپ لوکس در حال تکمیل است. برای پرس‌وجو دربارهٔ وضعیت فعلی، با هتل تماس بگیرید؛ جزئیات افتتاح و خدمات پس از اعلام رسمی به‌روزرسانی می‌شوند.", link: "/contact", label: "راه‌های تماس" }],
  },
  "/facilities": {
    title: "امکانات هتل",
    intro: "امکانات و خدمات",
    text: "برای اطلاع از خدمات در دسترس، ساعت فعالیت و امکانات هر اتاق، با پذیرش تماس بگیرید.",
    actions: [["/contact", "راه‌های تماس"]],
    sections: [
      { heading: "پذیرش و خدمات", text: "برای اطلاع از خدمات در دسترس و ساعت فعالیت آن‌ها، با پذیرش هماهنگ کنید." },
      { heading: "صبحانه و رستوران", text: "رستوران هتل آماده است. دربارهٔ منو و ساعت فعالیت رستوران، و وضعیت فعلی و زمان سرو صبحانه از پذیرش سؤال کنید.", link: "/restaurant" },
      { heading: "پارکینگ", text: "برای اطلاع از امکان استفاده از پارکینگ و شرایط آن در زمان سفر، پیشاپیش با پذیرش هماهنگ کنید.", link: "/contact", label: "تماس با پذیرش" }
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
    text: "هتل دامون در شهرکرد قرار دارد. در این سایت می‌توانید گروه‌های اقامتی، امکانات ثبت‌شده و وضعیت رستوران و کافی‌شاپ را ببینید و برای هماهنگی با پذیرش تماس بگیرید.",
    actions: [["/contact", "تماس با هتل"]],
    sections: [
      { heading: "مهمان‌نوازی دامون", text: "دامون با رویکردی گرم، صمیمی و آرام، می‌خواهد مهمان در طول اقامت احساس آسودگی و خانهٔ دوم داشته باشد." },
      { heading: "اقامت در دامون", text: "اتاق یک‌تخته، اتاق دوتخته و سوئیت‌های سه، چهار و پنج‌تخته در گروه‌های اقامتی سایت معرفی شده‌اند. برای ظرفیت دقیق، امکانات واحد و نرخ روز با پذیرش هماهنگ کنید.", link: "/rooms", label: "دیدن گروه‌های اقامتی" },
      { heading: "خدمات و زمان‌بندی", text: "برای اطلاع از خدمات در دسترس، ساعت فعالیت و زمان ورود و خروج، پیش از سفر با هتل تماس بگیرید.", link: "/facilities", label: "آشنایی با امکانات" },
    ],
  },
  "/contact": {
    title: "تماس با هتل دامون",
    intro: "برای هماهنگی با ما در تماس باشید",
    text: "برای هماهنگی اقامت، پرسش دربارهٔ امکانات یا مراجعه به رستوران با پذیرش هتل تماس بگیرید. دامون در شهرکرد، خیابان دوازده محرم شمالی، میدان بسیج قرار دارد.",
    sections: [
      { heading: "برای هماهنگی اقامت", text: "تاریخ ورود و خروج، تعداد مهمانان و گروه اقامتی موردنظر را هنگام تماس مطرح کنید. ظرفیت دقیق، نرخ و موجودی را پذیرش اعلام می‌کند.", link: "/rooms", label: "مرور گروه‌های اقامتی" },
      { heading: "نشانی هتل", text: "هتل دامون در شهرکرد، خیابان دوازده محرم شمالی، میدان بسیج قرار دارد. از دکمهٔ مسیریابی برای مشاهدهٔ مسیر استفاده کنید." },
    ],
  },
  "/policies": {
    title: "قوانین و حریم خصوصی",
    intro: "قوانین اقامت و حریم خصوصی",
    text: "برای آگاهی از زمان‌های ورود و خروج و سایر شرایط اقامت، پیش از برنامه‌ریزی با پذیرش تماس بگیرید.",
    sections: [
      { heading: "زمان ورود و خروج", text: "زمان‌های ورود و خروج را پیش از سفر مستقیماً از پذیرش بپرسید. امکان هماهنگی با زمان‌های دیگر را نیز بررسی کنید." },
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
    image: "/damoon-front/assets/lobby-concept.webp",
    actions: [["/contact", "تماس با هتل"]],
    sections: [{ heading: "آشنایی با فضاهای دامون", text: "تور پس از آماده‌شدن نمایشگر از همین صفحه در دسترس خواهد بود. تصاویر گالری این سایت مفهومی هستند و نمای واقعی تور را نشان نمی‌دهند.", link: "/contact", label: "تماس با هتل" }],
  },
};

export function normalizePath(pathname) {
  let path = decodeURIComponent(pathname || "/").replace(/\/+$/, "") || "/";
  const prefix = path.match(/^\/(fa|en|ar)(?=\/|$)/)?.[1];
  if (prefix) path = path.slice(prefix.length + 1) || "/";
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
        { heading: "زمان‌بندی اقامت", text: "زمان‌های ورود و خروج، ظرفیت، نرخ و موجودی را برای تاریخ دلخواه مستقیماً از هتل بپرسید.", link: "/policies", label: "اطلاعات زمان ورود و خروج" },
        { heading: "امکانات هتل", text: "برای اطلاع از امکانات در دسترس در این واحد، خدمات و ساعت فعالیت آن‌ها، از پذیرش سؤال کنید.", link: "/facilities", label: "مشاهدهٔ امکانات" },
      ] : translations[locale].roomDetails.shared,
    };
  }
  return null;
}

