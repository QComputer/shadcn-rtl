import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/api-guards";
import { OrganizationOnboardingError } from "@/lib/organization-onboarding/service";

export function provisioningError(error: unknown, _fallback?: string) {
  void _fallback;
  const status = error instanceof ApiError || error instanceof OrganizationOnboardingError ? error.status : error instanceof ZodError ? 400 : 500;
  const message = error instanceof ApiError ? error.message
    : error instanceof OrganizationOnboardingError ? "هویت، دسترسی یا وضعیت دعوت‌نامه نیاز به بررسی دارد"
    : error instanceof ZodError ? "اطلاعات طرح معتبر نیست؛ ورودی‌ها را بررسی کنید"
    : "عملیات انجام نشد؛ بدون تغییر اطلاعات دوباره تلاش کنید";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}
