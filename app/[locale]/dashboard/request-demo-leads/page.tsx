import { Metadata } from "next";
import { RequestDemoLeadsClient } from "./client";

export const metadata: Metadata = {
  title: {
    default: "درخواست‌های دمو | بازارباز",
    template: "%s | بازارباز",
  },
  description: "بررسی و مدیریت درخواست‌های دمو دریافت شده از کسب‌وکارها.",
};

export default function RequestDemoLeadsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <RequestDemoLeadsClient />;
}
