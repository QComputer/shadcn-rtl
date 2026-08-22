export type DemoRole = "PLATFORM_ADMIN" | "ORGANIZATION_OWNER" | "MANAGER" | "STAFF" | "DRIVER" | "CUSTOMER";

export const DEMO_ROLE_LABELS: Record<DemoRole, string> = {
  PLATFORM_ADMIN: "مدیر پلتفرم",
  ORGANIZATION_OWNER: "مالک کسب‌وکار",
  MANAGER: "مدیر",
  STAFF: "کارمند",
  DRIVER: "راننده",
  CUSTOMER: "مشتری",
};
