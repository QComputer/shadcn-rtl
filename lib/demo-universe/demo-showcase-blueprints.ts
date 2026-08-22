import type { OrganizationCapabilityKey, OrganizationType } from "@prisma/client";
import type { DemoWalkthroughStage } from "@/lib/demo-universe/demo-walkthrough";
import type { DemoRole } from "@/lib/public-experience/types";

export type DemoShowcaseIndustry = "PHARMACY" | "DENTAL_CLINIC" | "CAFE_RESTAURANT" | "FASHION_BOUTIQUE";

export type DemoShowcaseRoleExperience = {
  role: DemoRole;
  title: string;
  description: string;
  routeHint: string;
};

export type DemoShowcaseStep = {
  key: string;
  title: string;
  description: string;
  role: DemoRole;
  action: string;
  sortOrder: number;
  businessValue: string;
  relatedCapability: OrganizationCapabilityKey;
  artifact: string;
  stage: DemoWalkthroughStage;
};

export type DemoShowcaseBlueprint = {
  organization: {
    name: string;
    slug: string;
    type: OrganizationType;
    description: string;
    address: string;
    phone: string;
    email?: string;
    logo: string;
    coverImage: string;
  };
  industry: DemoShowcaseIndustry;
  industryLabel: string;
  tagline: string;
  capabilities: OrganizationCapabilityKey[];
  demoRoles: DemoRole[];
  highlights: string[];
  roleExperiences: DemoShowcaseRoleExperience[];
  storySteps: DemoShowcaseStep[];
  ctaLabel: string;
  artifacts: string[];
  products?: Array<{
    category: string;
    items: Array<{ name: string; slug: string; description: string; price: number; sku: string }>;
  }>;
  services?: Array<{
    category: string;
    items: Array<{ name: string; slug: string; description: string; price: number; duration: number }>;
  }>;
};

const orderLifecycleSteps: DemoShowcaseStep[] = [
  {
    key: "customer-place-order",
    title: "ثبت سفارش از سمت مشتری",
    description: "مشتری از کاتالوگ نمایشی انتخاب می‌کند و سفارش ایزوله ساخته می‌شود.",
    role: "CUSTOMER",
    action: "CREATE_ORDER",
    sortOrder: 10,
    businessValue: "منوی دیجیتال به سفارش قابل پیگیری تبدیل می‌شود.",
    relatedCapability: "SHOP",
    artifact: "منو و سفارش",
    stage: "DIGITAL_PRESENCE",
  },
  {
    key: "manager-accept-order",
    title: "پذیرش و اولویت‌بندی سفارش",
    description: "مدیر وضعیت سفارش، مشتری و ظرفیت تیم را در داشبورد demo بررسی می‌کند.",
    role: "MANAGER",
    action: "ACCEPT_ORDER",
    sortOrder: 20,
    businessValue: "مدیر عملیات را بدون خروج از داشبورد کنترل می‌کند.",
    relatedCapability: "CRM",
    artifact: "داشبورد عملیات",
    stage: "BUSINESS_OPERATIONS",
  },
  {
    key: "staff-prepare-order",
    title: "آماده‌سازی توسط تیم",
    description: "کارمند سفارش را در مسیر آماده‌سازی جلو می‌برد و رخداد CRM ثبت می‌شود.",
    role: "STAFF",
    action: "PREPARE_ORDER",
    sortOrder: 30,
    businessValue: "تیم آماده‌سازی کار را از صف عملیاتی دنبال می‌کند.",
    relatedCapability: "SHOP",
    artifact: "صف آماده‌سازی",
    stage: "BUSINESS_OPERATIONS",
  },
  {
    key: "driver-deliver-order",
    title: "تحویل و تکمیل چرخه",
    description: "راننده فقط سفارش‌های همان کسب‌وکار نمایشی را می‌بیند و تحویل را کامل می‌کند.",
    role: "DRIVER",
    action: "DELIVER_ORDER",
    sortOrder: 40,
    businessValue: "تحویل به رخداد مشتری و چرخه بازگشت وصل می‌شود.",
    relatedCapability: "CRM",
    artifact: "تحویل و CRM",
    stage: "CUSTOMER_ENGAGEMENT",
  },
];

const retailFulfillmentSteps: DemoShowcaseStep[] = [
  {
    key: "customer-place-order",
    title: "ثبت سفارش از سمت مشتری",
    description: "مشتری از کاتالوگ نمایشی انتخاب می‌کند و سفارش ایزوله ساخته می‌شود.",
    role: "CUSTOMER",
    action: "CREATE_ORDER",
    sortOrder: 10,
    businessValue: "کاتالوگ عمومی به یک سفارش demo قابل مشاهده تبدیل می‌شود.",
    relatedCapability: "SHOP",
    artifact: "کاتالوگ محصول",
    stage: "DIGITAL_PRESENCE",
  },
  {
    key: "manager-review-order",
    title: "بررسی سفارش و مشتری",
    description: "مدیر سفارش، سابقه CRM و آمادگی کمپین را در همان tenant می‌بیند.",
    role: "MANAGER",
    action: "REVIEW_ORDER",
    sortOrder: 20,
    businessValue: "مدیر سابقه مشتری و سفارش را برای تصمیم عملیاتی کنار هم می‌بیند.",
    relatedCapability: "CRM",
    artifact: "سفارش + پروفایل مشتری",
    stage: "CUSTOMER_INTELLIGENCE",
  },
  {
    key: "staff-prepare-pickup",
    title: "آماده‌سازی برای تحویل حضوری",
    description: "کارمند سفارش را آماده می‌کند و رخداد عملیاتی ثبت می‌شود.",
    role: "STAFF",
    action: "PREPARE_ORDER",
    sortOrder: 30,
    businessValue: "کار آماده‌سازی از گفتگوهای پراکنده جدا و قابل پیگیری می‌شود.",
    relatedCapability: "SHOP",
    artifact: "کار تیم",
    stage: "BUSINESS_OPERATIONS",
  },
  {
    key: "manager-complete-crm",
    title: "تکمیل رابطه مشتری",
    description: "مدیر نتیجه را در CRM و مسیر وفاداری/کمپین نمایشی دنبال می‌کند.",
    role: "MANAGER",
    action: "REVIEW_CRM",
    sortOrder: 40,
    businessValue: "تعامل عملیاتی به فرصت وفاداری، کمپین و رشد تبدیل می‌شود.",
    relatedCapability: "LOYALTY",
    artifact: "CRM و کمپین",
    stage: "CUSTOMER_ENGAGEMENT",
  },
];

export const DEMO_SHOWCASE_BLUEPRINTS: readonly DemoShowcaseBlueprint[] = [
  {
    organization: {
      name: "داروخانه سلامت نوین",
      slug: "salamat-novin-pharmacy",
      type: "SHOP",
      description: "داروخانه و فروشگاه سلامت نمایشی برای محصولات عمومی سلامت، مکمل، مراقبت پوست و کودک بدون ادعای درمانی.",
      address: "تهران، خیابان ولیعصر، پلاک ۲۴۰",
      phone: "+982188660101",
      email: "demo@salamat-novin.example",
      logo: "/images/demo/salamat-novin-logo.png",
      coverImage: "/images/demo/salamat-novin-cover.jpg",
    },
    industry: "PHARMACY",
    industryLabel: "داروخانه و فروشگاه سلامت",
    tagline: "کاتالوگ سلامت، CRM، وفاداری، کمپین و آمادگی USSD در یک مسیر نمایشی.",
    capabilities: ["SHOP", "CRM", "LOYALTY", "USSD", "SMS"],
    demoRoles: ["ORGANIZATION_OWNER", "CUSTOMER", "MANAGER", "STAFF"],
    highlights: ["محصولات OTC و مکمل بدون توصیه پزشکی", "باشگاه مشتریان و کمپین‌های بازگشت", "آمادگی dry-run برای USSD و پیامک"],
    roleExperiences: [
      { role: "CUSTOMER", title: "خرید مشتری", description: "مرور محصولات عمومی سلامت و ثبت سفارش نمایشی.", routeHint: "/demo?role=CUSTOMER" },
      { role: "MANAGER", title: "مدیریت فروش", description: "مشاهده سفارش‌ها، مشتریان و آمادگی کمپین.", routeHint: "/demo?role=MANAGER" },
      { role: "STAFF", title: "آماده‌سازی", description: "حرکت سفارش در صف آماده‌سازی بدون داده واقعی.", routeHint: "/demo?role=STAFF" },
    ],
    storySteps: retailFulfillmentSteps,
    ctaLabel: "شروع دموی داروخانه",
    artifacts: ["کاتالوگ محصول", "CRM و وفاداری", "کمپین خشک", "USSD readiness"],
    products: [
      {
        category: "OTC و مراقبت عمومی",
        items: [
          { name: "محلول شست‌وشوی بینی", slug: "nasal-saline-demo", description: "محصول عمومی مراقبت روزانه؛ اطلاعات نمایشی و غیرپزشکی.", price: 880000, sku: "PH-OTC-001" },
          { name: "ژل ضدعفونی دست", slug: "hand-sanitizer-demo", description: "محصول بهداشتی عمومی برای نمایش دسته‌بندی داروخانه.", price: 620000, sku: "PH-OTC-002" },
        ],
      },
      {
        category: "ویتامین و مکمل",
        items: [
          { name: "مولتی‌ویتامین روزانه", slug: "daily-multivitamin-demo", description: "نمونه مکمل عمومی بدون ادعای درمان یا تجویز.", price: 1450000, sku: "PH-SUP-001" },
          { name: "ویتامین C جوشان", slug: "vitamin-c-demo", description: "نمونه محصول سلامت عمومی برای مسیر فروش نمایشی.", price: 760000, sku: "PH-SUP-002" },
        ],
      },
      {
        category: "مراقبت پوست، مو و کودک",
        items: [
          { name: "کرم مرطوب‌کننده پوست", slug: "skin-moisturizer-demo", description: "محصول مراقبت پوست برای سناریوی کاتالوگ.", price: 980000, sku: "PH-SKIN-001" },
          { name: "شامپو کودک ملایم", slug: "baby-shampoo-demo", description: "نمونه محصول کودک با توضیح عمومی و غیرپزشکی.", price: 690000, sku: "PH-BABY-001" },
        ],
      },
    ],
  },
  {
    organization: {
      name: "کلینیک دندانپزشکی سپیدار",
      slug: "sepidar-dental-clinic",
      type: "APPOINTMENT",
      description: "کلینیک دندانپزشکی نمایشی برای رزرو، تقویم کارکنان، CRM و یادآوری نوبت.",
      address: "تهران، خیابان شریعتی، پلاک ۱۴۸",
      phone: "+982188660202",
      email: "demo@sepidar-dental.example",
      logo: "/images/demo/sepidar-logo.png",
      coverImage: "/images/demo/sepidar-cover.jpg",
    },
    industry: "DENTAL_CLINIC",
    industryLabel: "کلینیک دندانپزشکی",
    tagline: "خدمات، نوبت، تقویم تیم و پیگیری مشتری در یک دمو APPOINTMENT.",
    capabilities: ["APPOINTMENT", "CRM", "SMS"],
    demoRoles: ["ORGANIZATION_OWNER", "CUSTOMER", "MANAGER", "STAFF"],
    highlights: ["رزرو خدمات مشاوره و زیبایی", "تقویم کارکنان و وضعیت نوبت", "آمادگی یادآوری و CRM بدون ارسال واقعی"],
    roleExperiences: [
      { role: "CUSTOMER", title: "رزرو مراجعه", description: "انتخاب خدمت و مشاهده مسیر نوبت‌دهی.", routeHint: "/demo?role=CUSTOMER" },
      { role: "MANAGER", title: "مدیریت نوبت‌ها", description: "مرور وضعیت رزروها، ظرفیت و پیگیری مشتری.", routeHint: "/demo?role=MANAGER" },
      { role: "STAFF", title: "تقویم درمانگر", description: "دیدن کارهای اختصاص‌یافته در فضای demo.", routeHint: "/demo?role=STAFF" },
    ],
    storySteps: [
      {
        key: "customer-select-service",
        title: "انتخاب خدمت",
        description: "مشتری یکی از خدمات قابل رزرو را انتخاب می‌کند.",
        role: "CUSTOMER",
        action: "SELECT_SERVICE",
        sortOrder: 10,
        businessValue: "خدمات کلینیک به صفحه رزرو قابل فهم تبدیل می‌شود.",
        relatedCapability: "APPOINTMENT",
        artifact: "لیست خدمات",
        stage: "DIGITAL_PRESENCE",
      },
      {
        key: "customer-request-slot",
        title: "درخواست زمان",
        description: "درخواست نوبت با اطلاعات نمایشی ثبت می‌شود.",
        role: "CUSTOMER",
        action: "REQUEST_APPOINTMENT",
        sortOrder: 20,
        businessValue: "درخواست مراجعه وارد جریان نوبت‌دهی قابل پیگیری می‌شود.",
        relatedCapability: "APPOINTMENT",
        artifact: "درخواست نوبت",
        stage: "BUSINESS_OPERATIONS",
      },
      {
        key: "manager-review-calendar",
        title: "بررسی تقویم",
        description: "مدیر ظرفیت کارکنان و وضعیت نوبت‌ها را می‌بیند.",
        role: "MANAGER",
        action: "REVIEW_CALENDAR",
        sortOrder: 30,
        businessValue: "ظرفیت تیم و تقویم به تصمیم مدیریتی روزانه وصل می‌شود.",
        relatedCapability: "APPOINTMENT",
        artifact: "تقویم کارکنان",
        stage: "BUSINESS_OPERATIONS",
      },
      {
        key: "staff-follow-up",
        title: "پیگیری مراجعه",
        description: "کارمند مسیر یادآوری و CRM را به‌صورت dry-run می‌بیند.",
        role: "STAFF",
        action: "FOLLOW_UP",
        sortOrder: 40,
        businessValue: "مراجعه به سابقه مشتری، یادآوری و ارتباط بعدی تبدیل می‌شود.",
        relatedCapability: "CRM",
        artifact: "CRM مراجعه‌کننده",
        stage: "CUSTOMER_INTELLIGENCE",
      },
    ],
    ctaLabel: "شروع دموی کلینیک",
    artifacts: ["خدمات قابل رزرو", "تقویم کارکنان", "CRM مراجعه‌کننده", "یادآوری dry-run"],
    services: [
      {
        category: "خدمات عمومی و پیشگیرانه",
        items: [
          { name: "مشاوره اولیه دندانپزشکی", slug: "initial-dental-consultation-demo", description: "جلسه ارزیابی و راهنمایی عمومی برای سناریوی رزرو.", price: 900000, duration: 30 },
          { name: "جرم‌گیری و بروساژ", slug: "cleaning-demo", description: "خدمت عمومی پاک‌سازی برای نمایش نوبت‌دهی.", price: 1800000, duration: 45 },
        ],
      },
      {
        category: "مشاوره تخصصی",
        items: [
          { name: "مشاوره زیبایی دندان", slug: "cosmetic-dentistry-consultation-demo", description: "بررسی گزینه‌های زیبایی در مسیر نمایشی.", price: 1200000, duration: 30 },
          { name: "مشاوره ایمپلنت", slug: "implant-consultation-demo", description: "رزرو مشاوره اولیه ایمپلنت بدون ادعای درمانی.", price: 1500000, duration: 45 },
          { name: "مشاوره ارتودنسی", slug: "orthodontics-consultation-demo", description: "نمونه خدمت برای نمایش تقویم و CRM.", price: 1500000, duration: 45 },
        ],
      },
    ],
  },
  {
    organization: {
      name: "کافه رستوران برگ",
      slug: "barg-cafe-restaurant",
      type: "SHOP",
      description: "کافه رستوران نمایشی برای منوی دیجیتال، سفارش، آماده‌سازی، تحویل، CRM و کمپین.",
      address: "اصفهان، خیابان آمادگاه، پلاک ۳۶",
      phone: "+983188660303",
      email: "demo@barg-cafe.example",
      logo: "/images/demo/barg-logo.png",
      coverImage: "/images/demo/barg-cover.jpg",
    },
    industry: "CAFE_RESTAURANT",
    industryLabel: "کافه رستوران",
    tagline: "iMenu-style catalog، سفارش، تیم، راننده و CRM در یک چرخه قابل لمس.",
    capabilities: ["SHOP", "CRM", "LOYALTY", "USSD", "SMS"],
    demoRoles: ["ORGANIZATION_OWNER", "CUSTOMER", "MANAGER", "STAFF", "DRIVER"],
    highlights: ["منو و سفارش نمایشی", "چرخه آماده‌سازی تا تحویل", "کمپین بازگشت مشتری و آمادگی delivery"],
    roleExperiences: [
      { role: "CUSTOMER", title: "سفارش غذا", description: "انتخاب از منو و ثبت سفارش demo.", routeHint: "/demo?role=CUSTOMER" },
      { role: "STAFF", title: "آشپزخانه", description: "دیدن صف آماده‌سازی و تغییر وضعیت.", routeHint: "/demo?role=STAFF" },
      { role: "DRIVER", title: "تحویل", description: "مشاهده سفارش‌های آماده همان سازمان.", routeHint: "/demo?role=DRIVER" },
      { role: "MANAGER", title: "مدیریت شعبه", description: "پیگیری فروش، مشتری و رخدادها.", routeHint: "/demo?role=MANAGER" },
    ],
    storySteps: orderLifecycleSteps,
    ctaLabel: "شروع دموی کافه رستوران",
    artifacts: ["منوی دیجیتال", "سفارش و تحویل", "CRM", "کمپین"],
    products: [
      {
        category: "نوشیدنی گرم",
        items: [
          { name: "لاته برگ", slug: "barg-latte-demo", description: "لاته نمایشی برای منوی دیجیتال.", price: 1250000, sku: "BG-CAF-001" },
          { name: "چای هل و دارچین", slug: "cardamom-tea-demo", description: "نوشیدنی گرم برای مسیر سفارش.", price: 620000, sku: "BG-TEA-001" },
        ],
      },
      {
        category: "غذا و میان‌وعده",
        items: [
          { name: "پنینی مرغ", slug: "chicken-panini-demo", description: "آیتم غذایی قابل سفارش و آماده‌سازی.", price: 2250000, sku: "BG-FOOD-001" },
          { name: "سالاد فصل برگ", slug: "seasonal-salad-demo", description: "نمونه محصول سبک برای منو.", price: 1580000, sku: "BG-FOOD-002" },
        ],
      },
    ],
  },
  {
    organization: {
      name: "مزون آریانا",
      slug: "aryana-fashion-boutique",
      type: "SHOP",
      description: "بوتیک و مزون نمایشی برای کاتالوگ مد، پروفایل سلیقه مشتری و پیشنهادهای غیرحساس.",
      address: "شیراز، خیابان عفیف‌آباد، پلاک ۷۸",
      phone: "+987188660404",
      email: "demo@aryana-fashion.example",
      logo: "/images/demo/aryana-logo.png",
      coverImage: "/images/demo/aryana-cover.jpg",
    },
    industry: "FASHION_BOUTIQUE",
    industryLabel: "مزون و بوتیک مد",
    tagline: "کاتالوگ، ترجیحات مشتری و پیشنهادهای سبک بدون تحلیل بدن یا داده بیومتریک.",
    capabilities: ["SHOP", "CRM", "LOYALTY", "SMS"],
    demoRoles: ["ORGANIZATION_OWNER", "CUSTOMER", "MANAGER", "STAFF"],
    highlights: ["پروفایل سلیقه و سایز اختیاری نمایشی", "پیشنهادهای سبک بر پایه انتخاب کاربر", "تصاویر placeholder بدون تشخیص بدن"],
    roleExperiences: [
      { role: "CUSTOMER", title: "کشف سبک", description: "مرور محصولات و دریافت پیشنهاد بر اساس علاقه‌مندی نمایشی.", routeHint: "/demo?role=CUSTOMER" },
      { role: "MANAGER", title: "CRM بوتیک", description: "تقسیم‌بندی مشتریان بر پایه رفتار خرید demo.", routeHint: "/demo?role=MANAGER" },
      { role: "STAFF", title: "آماده‌سازی سفارش", description: "مدیریت آیتم‌های انتخاب‌شده برای تحویل.", routeHint: "/demo?role=STAFF" },
    ],
    storySteps: retailFulfillmentSteps,
    ctaLabel: "شروع دموی مزون",
    artifacts: ["کاتالوگ مد", "پروفایل ترجیحی مشتری", "پیشنهاد سبک", "CRM"],
    products: [
      {
        category: "پوشاک روزمره",
        items: [
          { name: "مانتو لینن آریانا", slug: "linen-manto-demo", description: "آیتم پوشاک برای نمایش کاتالوگ و ترجیحات.", price: 6800000, sku: "AR-APP-001" },
          { name: "شال ابریشمی طرح ساده", slug: "silk-scarf-demo", description: "اکسسوری سبک برای پیشنهادهای غیرحساس.", price: 2200000, sku: "AR-ACC-001" },
        ],
      },
      {
        category: "استایل مهمانی",
        items: [
          { name: "پیراهن مجلسی ساتن", slug: "satin-dress-demo", description: "محصول نمایشی برای مدیریت موجودی و CRM.", price: 12800000, sku: "AR-EVN-001" },
          { name: "کیف دستی مینیمال", slug: "minimal-handbag-demo", description: "آیتم پیشنهادی بر اساس علاقه کاربر در demo.", price: 5400000, sku: "AR-BAG-001" },
        ],
      },
    ],
  },
] as const;

export const FEATURED_DEMO_SHOWCASE_SLUGS = DEMO_SHOWCASE_BLUEPRINTS.map((showcase) => showcase.organization.slug);
