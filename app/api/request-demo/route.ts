import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ALLOWED_BUSINESS_TYPES = new Set([
  "shop",
  "restaurant",
  "pharmacy",
  "clinic",
  "beauty",
  "education",
  "repair",
  "service",
  "other",
]);

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `hashed-${Math.abs(hash).toString(16)}`;
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("98") && digits.length === 12) {
    return `0${digits}`;
  }
  if (digits.startsWith("0098") && digits.length === 14) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith("+98") && digits.length === 13) {
    return `0${digits.slice(1)}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return digits;
  }
  return digits;
}

function isValidIranianPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^09\d{9}$/.test(normalized);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit({
      key: `request-demo:${ip}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "درخواست شما به طور موقت محدود شده است. لطفاً بعداً تلاش کنید." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "درخواست نامعتبر است." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    const fullName = typeof data.fullName === "string" ? data.fullName.trim() : "";
    const businessName = typeof data.businessName === "string" ? data.businessName.trim() : "";
    const businessType = typeof data.businessType === "string" ? data.businessType.trim() : "";
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    const city = typeof data.city === "string" ? data.city.trim() : "";
    const preferredContactTime = typeof data.preferredContactTime === "string" ? data.preferredContactTime.trim() : "";
    const needSummary = typeof data.needSummary === "string" ? data.needSummary.trim() : "";
    const consentAccepted = typeof data.consentAccepted === "boolean" ? data.consentAccepted : false;

    if (!fullName || fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json(
        { error: "نام و نام خانوادگی باید بین ۲ تا ۱۲۰ کاراکتر باشد." },
        { status: 400 },
      );
    }

    if (!businessName || businessName.length < 2 || businessName.length > 160) {
      return NextResponse.json(
        { error: "نام کسب‌وکار باید بین ۲ تا ۱۶۰ کاراکتر باشد." },
        { status: 400 },
      );
    }

    if (!ALLOWED_BUSINESS_TYPES.has(businessType)) {
      return NextResponse.json(
        { error: "نوع کسب‌وکار نامعتبر است." },
        { status: 400 },
      );
    }

    if (!isValidIranianPhone(phone)) {
      return NextResponse.json(
        { error: "شماره تماس نامعتبر است." },
        { status: 400 },
      );
    }

    if (city.length > 80) {
      return NextResponse.json(
        { error: "نام شهر باید حداکثر ۸۰ کاراکتر باشد." },
        { status: 400 },
      );
    }

    if (preferredContactTime.length > 120) {
      return NextResponse.json(
        { error: "ترجیح زمان تماس باید حداکثر ۱۲۰ کاراکتر باشد." },
        { status: 400 },
      );
    }

    if (needSummary.length > 1000) {
      return NextResponse.json(
        { error: "توضیح کوتاه باید حداکثر ۱۰۰۰ کاراکتر باشد." },
        { status: 400 },
      );
    }

    if (!consentAccepted) {
      return NextResponse.json(
        { error: "تأییدیه رضایت الزامی است." },
        { status: 400 },
      );
    }

    const userAgent = request.headers.get("user-agent") || "";
    const ipHash = hashString(ip);
    const userAgentHash = hashString(userAgent);

    const normalizedPhone = normalizePhone(phone);

    const lead = await prisma.requestDemoLead.create({
      data: {
        fullName,
        businessName,
        businessType,
        phone: normalizedPhone,
        city: city || undefined,
        preferredContactTime: preferredContactTime || undefined,
        needSummary: needSummary || undefined,
        consentAccepted,
        ipHash,
        userAgentHash,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "درخواست شما ثبت شد. تیم بازارباز پس از بررسی اولیه برای هماهنگی دمو با شما تماس می‌گیرد.",
        leadId: lead.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[request-demo]", error);
    return NextResponse.json(
      { error: "ثبت درخواست انجام نشد. لطفاً اطلاعات را بررسی کنید و دوباره تلاش کنید." },
      { status: 500 },
    );
  }
}
