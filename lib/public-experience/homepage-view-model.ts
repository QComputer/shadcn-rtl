import type { DemoRole } from "@/lib/public-experience/types";
import type { PublicDemoShowcase } from "@/lib/demo-universe/demo-showcase";
import type { PlatformFeature } from "@/lib/public-experience/platform-features";

export type PublicDemoOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  logo?: string | null;
  coverImage?: string | null;
  description?: string | null;
  capabilities: string[];
  demoRoles: DemoRole[];
  showcase?: PublicDemoShowcase | null;
  demoLinks?: {
    publicProfile?: string;
    session?: string;
  };
};

export type PublicDemoJourneySummary = {
  key: string;
  title: string;
  role: DemoRole;
  route: string;
  ordering: number;
};

export type PublicDemoExperienceSummary = {
  platformFeatures: PlatformFeature[];
  demoOrganizations: PublicDemoOrganizationSummary[];
  demoShowcases?: PublicDemoShowcase[];
  journeys: readonly PublicDemoJourneySummary[];
  storytelling: readonly {
    key: string;
    ordering: number;
    title: string;
    description: string;
    simulatedOnly: boolean;
  }[];
  investorReadiness: {
    demoBusinessCount: number;
    capabilitiesDemonstrated: string[];
    integrationsAvailable: number;
    seoOpportunitiesDetected: number;
    crmActivitySimulation: { customerIdentities: number; interactions: number };
  };
};

export type HomepageViewModel = {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  problem: {
    title: string;
    subtitle: string;
    points: string[];
  };
  solution: {
    title: string;
    subtitle: string;
    stages: Array<{ title: string; description: string }>;
  };
  industries: Array<{ key: string; title: string; description: string; capabilityHint: string }>;
  ecosystem: Array<{ key: string; title: string; description: string }>;
  demo: {
    title: string;
    subtitle: string;
    organizations: PublicDemoOrganizationSummary[];
    journeys: PublicDemoJourneySummary[];
  };
  metrics: Array<{ label: string; value: string; description: string }>;
  platformFeatures: PlatformFeature[];
  storytelling: PublicDemoExperienceSummary["storytelling"];
};

const ROLE_ORDER: DemoRole[] = ["CUSTOMER", "MANAGER", "STAFF", "DRIVER", "PLATFORM_ADMIN", "ORGANIZATION_OWNER"];

function orderJourneys(journeys: readonly PublicDemoJourneySummary[]) {
  return [...journeys].sort((a, b) => {
    const roleOrder = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
    return roleOrder || a.ordering - b.ordering;
  });
}

export function buildHomepageViewModel(input: PublicDemoExperienceSummary): HomepageViewModel {
  return {
    hero: {
      eyebrow: "Business operating system for local businesses",
      title: "از یک کسب‌وکار سنتی تا یک حضور دیجیتال هوشمند",
      subtitle:
        "بازارباز داده‌های پراکنده کسب‌وکار را به صفحه عمومی، منو یا خدمات دیجیتال، CRM، محتوای قابل انتشار و تجربه نمایشی قابل لمس تبدیل می‌کند.",
      primaryCta: "مشاهده دموی واقعی",
      secondaryCta: "ساخت صفحه کسب‌وکار",
    },
    problem: {
      title: "ابزارهای پراکنده، رشد کند",
      subtitle:
        "بسیاری از کسب‌وکارها همزمان بین تلفن، شبکه‌های اجتماعی، فایل مشتریان، منو، تبلیغات و نوبت‌دهی جابه‌جا می‌شوند.",
      points: [
        "منو، خدمات، سفارش و نوبت در چند جای مختلف نگهداری می‌شود.",
        "اطلاعات مشتریان قابل پیگیری و قابل تبدیل به رابطه بلندمدت نیست.",
        "محتوای عمومی و SEO بعد از عملیات روزانه فراموش می‌شود.",
        "اتصال به اکوسیستم‌های بیرونی بدون لایه عملیاتی منسجم دشوار است.",
      ],
    },
    solution: {
      title: "بازارباز کسب‌وکار را به یک سیستم قابل رشد تبدیل می‌کند",
      subtitle:
        "هر بخش از تجربه عمومی از مدل‌های واقعی پلتفرم تغذیه می‌شود: قابلیت‌های سازمان، گراف موجودیت، CRM، SEO و دموهای ایزوله.",
      stages: [
        { title: "Business", description: "اطلاعات پایه، محصولات، خدمات و تیم" },
        { title: "Digital Presence", description: "صفحه عمومی، منو، نوبت‌دهی و لینک قابل اشتراک" },
        { title: "Customer Relationship", description: "هویت مشتری، تعاملات، باشگاه مشتریان و کمپین" },
        { title: "Growth", description: "SEO، محتوا، تحلیل و اتصال‌های اکوسیستم" },
      ],
    },
    industries: [
      {
        key: "restaurant",
        title: "رستوران و کافه",
        description: "منوی دیجیتال، سفارش، آماده‌سازی، تحویل و تعامل مشتری.",
        capabilityHint: "SHOP + CRM + USSD",
      },
      {
        key: "shop",
        title: "فروشگاه",
        description: "کاتالوگ، دسته‌بندی، صفحه محصول، سفارش و پیگیری.",
        capabilityHint: "SHOP + SEO",
      },
      {
        key: "appointment",
        title: "کسب‌وکار نوبتی",
        description: "خدمات، زمان‌بندی، کارکنان، رزرو و یادآوری.",
        capabilityHint: "APPOINTMENT + CRM",
      },
      {
        key: "education",
        title: "آموزش و خدمات تخصصی",
        description: "معرفی خدمات، جذب مشتری، محتوا و پیگیری رابطه.",
        capabilityHint: "APPOINTMENT + CONTENT",
      },
    ],
    ecosystem: [
      { key: "iMenu", title: "iMenu", description: "منبع یا نمایش منو در سناریوهای خشک و بدون فراخوان واقعی." },
      { key: "BazarBaaz", title: "BazarBaaz", description: "لایه عملیاتی کسب‌وکار، داده، CRM، SEO و دمو." },
      { key: "iAM", title: "iAM", description: "آداپتر dry-run برای آمادگی هویت و دسترسی." },
      { key: "iCV", title: "iCV", description: "ظرفیت اکوسیستم آینده بدون ادعای اتصال واقعی." },
      { key: "EBC", title: "EBC", description: "زمینه ارتباطات کسب‌وکار در سطح قرارداد آداپتر." },
      { key: "USSD", title: "USSD", description: "جریان dry-run کد دستوری و پرداخت فقط در شبیه‌سازی." },
    ],
    demo: {
      title: "Explore how different businesses use BazarBaaz",
      subtitle: "داروخانه، کلینیک، کافه رستوران و مزون را از حضور دیجیتال تا عملیات، CRM، رشد و تعامل مشتری دنبال کنید.",
      organizations: input.demoOrganizations,
      journeys: orderJourneys(input.journeys),
    },
    metrics: [
      {
        label: "کسب‌وکار نمایشی",
        value: String(input.investorReadiness.demoBusinessCount),
        description: "فقط سازمان‌های demo-enabled",
      },
      {
        label: "قابلیت فعال در دمو",
        value: String(input.investorReadiness.capabilitiesDemonstrated.length),
        description: "بر اساس capability model",
      },
      {
        label: "فرصت SEO",
        value: String(input.investorReadiness.seoOpportunitiesDetected),
        description: "از گراف موجودیت نمایشی",
      },
      {
        label: "تعامل CRM",
        value: String(input.investorReadiness.crmActivitySimulation.interactions),
        description: "فقط شبیه‌سازی Demo Universe",
      },
    ],
    platformFeatures: input.platformFeatures,
    storytelling: input.storytelling,
  };
}
