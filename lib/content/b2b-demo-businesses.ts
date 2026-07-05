export type BusinessModel = "shop" | "service" | "hybrid"

export type DemoBusiness = {
  id: string
  name: string
  label: string
  description: string
  industry: string
  model: BusinessModel
  slug: string
  primaryWorkflows: string[]
  dashboardCapabilities: string[]
  customerFacingCapabilities: string[]
  needsProducts: boolean
  needsServices: boolean
  needsCustomerClub: boolean
  needsCouponsCampaigns: boolean
  needsNotificationsSms: boolean
}

export const demoBusinesses: DemoBusiness[] = [
  {
    id: "demo-fashion-shop",
    name: "فروشگاه پوشاک نمونه",
    label: "نمونه نمایشی",
    industry: "فروشگاهی / پوشاک",
    description: "دموی فروشگاه پوشاک با کاتالوگ محصولات، دسته‌بندی، سبد خرید، سفارش‌گیری و باشگاه مشتریان.",
    model: "shop",
    slug: "demo-fashion-shop",
    primaryWorkflows: ["ثبت سفارش", "پیگیری سفارش", "مدیریت موجودی", "نرخ بازگشت مشتری"],
    dashboardCapabilities: ["مدیریت محصولات", "دسته‌بندی", "قیمت‌گذاری", "گزارش فروش", "باشگاه مشتریان"],
    customerFacingCapabilities: ["مشاهده محصولات", "سبد خرید", "پرداخت آنلاین", "پیگیری سفارش"],
    needsProducts: true,
    needsServices: false,
    needsCustomerClub: true,
    needsCouponsCampaigns: true,
    needsNotificationsSms: true,
  },
  {
    id: "demo-restaurant",
    name: "رستوران نمونه",
    label: "نمونه نمایشی",
    industry: "رستوران و کافه",
    description: "دموی رستوران با منو دیجیتال، سفارش آنلاین، رزرو میز، کمپین‌های ویژه و یادآوری سفارش.",
    model: "hybrid",
    slug: "demo-restaurant",
    primaryWorkflows: ["سفارش آنلاین", "رزرو میز", "مدیریت منو", "کمپین‌های غذایی"],
    dashboardCapabilities: ["مدیریت منو", "دسته‌بندی غذا", "گزارش سفارش", "اعلان سفارش", "کمپین تخفیف"],
    customerFacingCapabilities: ["مشاهده منو", "ثبت سفارش", "رزرو میز", "پیگیری وضعیت"],
    needsProducts: true,
    needsServices: true,
    needsCustomerClub: true,
    needsCouponsCampaigns: true,
    needsNotificationsSms: true,
  },
  {
    id: "demo-pharmacy",
    name: "داروخانه نمونه",
    label: "نمونه نمایشی",
    industry: "داروخانه",
    description: "دموی داروخانه با کاتالوگ محصولات، درخواست دارو، نوبت‌دهی و اطلاع‌رسانی موجودی.",
    model: "hybrid",
    slug: "demo-pharmacy",
    primaryWorkflows: ["جستجوی محصول", "درخواست دارو", "نوبت‌دهی مشاوره", "اطلاع‌رسانی موجودی"],
    dashboardCapabilities: ["مدیریت کاتالوگ", "مدیریت موجودی", "نوبت‌دهی", "اعلان‌های موجودی", "گزارش فروش"],
    customerFacingCapabilities: ["مشاهده محصولات", "جستجوی دارو", "درخواست محصول", "رزرو نوبت"],
    needsProducts: true,
    needsServices: true,
    needsCustomerClub: true,
    needsCouponsCampaigns: false,
    needsNotificationsSms: true,
  },
  {
    id: "demo-clinic",
    name: "مطب نمونه",
    label: "نمونه نمایشی",
    industry: "مطب و کلینیک",
    description: "دموی مطب پزشکی با نوبت‌دهی آنلاین، مدیریت پزشکان، یادآوری نوبت و پرونده بیمار.",
    model: "service",
    slug: "demo-clinic",
    primaryWorkflows: ["رزرو نوبت", "یادآوری نوبت", "انتخاب پزشک", "پیگیری درمان"],
    dashboardCapabilities: ["مدیریت پزشکان", "تقویم نوبت", "اعلان یادآوری", "گزارش ویزیت", "باشگاه مشتریان"],
    customerFacingCapabilities: ["مشاهده پزشکان", "رزرو نوبت", "ویزیته", "یادآوری پیامک"],
    needsProducts: false,
    needsServices: true,
    needsCustomerClub: true,
    needsCouponsCampaigns: false,
    needsNotificationsSms: true,
  },
  {
    id: "demo-service-center",
    name: "مرکز خدماتی نمونه",
    label: "نمونه نمایشی",
    industry: "خدمات فنی و تعمیراتی",
    description: "دموی مرکز خدماتی با درخواست سرویس، مدیریت تکنسین‌ها، پیگیری تعمیرات و اطلاع‌رسانی مشتری.",
    model: "service",
    slug: "demo-service-center",
    primaryWorkflows: ["ثبت درخواست سرویس", "اختصاص تکنسین", "پیگیری وضعیت", "ارائه خدمات"],
    dashboardCapabilities: ["مدیریت درخواست‌ها", "تقویم تکنسین", "گزارش عملکرد", "اعلان مشتری", "قیمت‌گذاری سرویس"],
    customerFacingCapabilities: ["ثبت درخواست سرویس", "پیگیری وضعیت", "مشاهده هزینه", "امتیازدهی خدمت"],
    needsProducts: false,
    needsServices: true,
    needsCustomerClub: false,
    needsCouponsCampaigns: false,
    needsNotificationsSms: true,
  },
  {
    id: "demo-beauty-salon",
    name: "سالن زیبایی نمونه",
    label: "نمونه نمایشی",
    industry: "زیبایی و آرایشی",
    description: "دموی سالن زیبایی با رزرو خدمات، پکیج‌های تخفیف، باشگاه مشتریان و یادآوری نوبت.",
    model: "service",
    slug: "demo-beauty-salon",
    primaryWorkflows: ["رزرو خدمات زیبایی", "خرید پکیج تخفیف", "امتیاز وفاداری", "یادآوری نوبت"],
    dashboardCapabilities: ["مدیریت خدمات", "تقویم رزرو", "کوپن و تخفیف", "باشگاه مشتریان", "گزارش درآمد"],
    customerFacingCapabilities: ["مشاهده خدمات", "رزرو آنلاین", "خرید کوپن", "مشاهده امتیازات"],
    needsProducts: false,
    needsServices: true,
    needsCustomerClub: true,
    needsCouponsCampaigns: true,
    needsNotificationsSms: true,
  },
  {
    id: "demo-education-center",
    name: "مرکز آموزشی نمونه",
    label: "نمونه نمایشی",
    industry: "آموزشی",
    description: "دموی مرکز آموزشی با ثبت‌نام دوره، مدیریت مدرس، کلاس‌های آنلاین و حضوری و یادآوری جلسه.",
    model: "hybrid",
    slug: "demo-education-center",
    primaryWorkflows: ["ثبت‌نام دوره", "رزرو کلاس", "یادآوری جلسه", "ارائه مدرس"],
    dashboardCapabilities: ["مدیریت دوره‌ها", "تقویم کلاس", "گزارش حضور", "باشگاه هنرجویان", "اعلان جلسه"],
    customerFacingCapabilities: ["مشاهده دوره‌ها", "ثبت‌نام", "ورود به کلاس", "دیدن مدرس"],
    needsProducts: false,
    needsServices: true,
    needsCustomerClub: true,
    needsCouponsCampaigns: true,
    needsNotificationsSms: true,
  },
  {
    id: "demo-repair-center",
    name: "مرکز خدمات فنی نمونه",
    label: "نمونه نمایشی",
    industry: "تعمیرات و خدمات فنی",
    description: "دموی مرکز تعمیرات با درخواست سرویس، مدیریت تکنسین‌ها، پیگیری تعمیرات و اطلاع‌رسانی مشتری.",
    model: "service",
    slug: "demo-repair-center",
    primaryWorkflows: ["ثبت درخواست تعمیر", "ارزیابی دستگاه", "اختصاص تکنسین", "تحویل دستگاه"],
    dashboardCapabilities: ["مدیریت درخواست‌ها", "تقویم تکنسین", "گزارش تعمیرات", "اعلان مشتری", "قیمت‌گذاری سرویس"],
    customerFacingCapabilities: ["ثبت درخواست تعمیر", "پیگیری وضعیت", "مشاهده هزینه", "امتیازدهی تعمیر"],
    needsProducts: false,
    needsServices: true,
    needsCustomerClub: false,
    needsCouponsCampaigns: false,
    needsNotificationsSms: true,
  },
]

export const demoIndustries = [
  {
    id: "shop",
    name: "فروشگاهی",
    description: "مدیریت محصول، موجودی، سفارش و مشتریان برای فروشگاه‌های آنلاین و فیزیکی.",
  },
  {
    id: "restaurant",
    name: "رستوران و کافه",
    description: "منو دیجیتال، سفارش آنلاین، رزرو میز و مدیریت مشتریان.",
  },
  {
    id: "pharmacy",
    name: "داروخانه",
    description: "درخواست دارو، نوبت‌دهی، اطلاع‌رسانی موجودی و مشاوره آنلاین.",
  },
  {
    id: "clinic",
    name: "مطب و کلینیک",
    description: "نوبت‌دهی پزشک، مدیریت پرونده، یادآوری و پیگیری درمان.",
  },
  {
    id: "beauty",
    name: "زیبایی و آرایشی",
    description: "رزرو خدمات زیبایی، مدیریت کارکنان، پکیج‌های تخفیف.",
  },
  {
    id: "education",
    name: "آموزشی",
    description: "ثبت‌نام دوره، مدیریت مدرس، کلاس‌های آنلاین و حضوری.",
  },
  {
    id: "repair",
    name: "تعمیرات و خدمات فنی",
    description: "درخواست سرویس، مدیریت تیم فنی، پیگیری تعمیرات.",
  },
  {
    id: "service",
    name: "مراکز خدماتی",
    description: "مدیریت درخواست سرویس، کارکنان، پیگیری وضعیت و اطلاع‌رسانی مشتری.",
  },
]

export const demoCapabilitySummary = [
  "مدیریت فروشگاه و سفارش‌ها",
  "مدیریت خدمات و نوبت‌دهی",
  "باشگاه مشتریان و وفادارسازی",
  "پیامک، اعلان و اطلاع‌رسانی",
  "کمپین‌ها، تخفیف‌ها و پیشنهادهای ویژه",
  "داشبورد مدیریتی و گزارش‌ها",
  "صفحه اختصاصی کسب‌وکار",
  "مدیریت کارکنان و دسترسی‌ها",
  "چندزبانه، فارسی‌محور و راست‌چین",
]
