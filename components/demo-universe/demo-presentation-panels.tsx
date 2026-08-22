"use client";

import { BarChart3, CalendarCheck, Network, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DemoPresentationPanels as DemoPresentationPanelsModel } from "@/lib/demo-universe/demo-walkthrough";

type PanelItem = {
  label: string;
  value: string;
};

function MetricPanel({
  title,
  description,
  items,
  icon,
}: {
  title: string;
  description: string;
  items: PanelItem[];
  icon: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <h3 className="font-black">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4 grid min-w-0 gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
            <span className="min-w-0 break-words text-muted-foreground">{item.label}</span>
            <span className="shrink-0 font-bold">{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function readiness(value: boolean) {
  return value ? "Ready" : "Demo only";
}

export function DemoPresentationPanels({ panels }: { panels: DemoPresentationPanelsModel }) {
  return (
    <section className="grid min-w-0 gap-4 md:grid-cols-2" aria-label="Investor presentation panels">
      <MetricPanel
        title="Business Growth"
        description="SEO، محتوا و تعامل مشتری از داده‌های demo."
        icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
        items={[
          { label: "SEO opportunities", value: String(panels.businessGrowth.seoOpportunities) },
          { label: "Content readiness", value: String(panels.businessGrowth.contentReadiness) },
          { label: "Engagement events", value: String(panels.businessGrowth.customerEngagement) },
        ]}
      />
      <MetricPanel
        title="Operations"
        description="سفارش، نوبت و کار تیم بدون خروج از tenant."
        icon={<CalendarCheck className="h-5 w-5" aria-hidden="true" />}
        items={[
          { label: "Active orders", value: String(panels.operations.activeOrders) },
          { label: "Appointments", value: String(panels.operations.appointments) },
          { label: "Staff workflow", value: String(panels.operations.staffWorkflowItems) },
        ]}
      />
      <MetricPanel
        title="Customer Intelligence"
        description="CRM، تعاملات و وفاداری در سطح داده نمایشی."
        icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
        items={[
          { label: "Customers", value: String(panels.customerIntelligence.customers) },
          { label: "Interactions", value: String(panels.customerIntelligence.interactions) },
          { label: "Loyalty signals", value: String(panels.customerIntelligence.loyaltySignals) },
        ]}
      />
      <Card className="min-w-0 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Network className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-black">Integration Readiness</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">آمادگی اکوسیستم بدون تماس خارجی واقعی.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries({
            iMenu: panels.integrationReadiness.iMenu,
            iAM: panels.integrationReadiness.iAM,
            iCV: panels.integrationReadiness.iCV,
            EBC: panels.integrationReadiness.ebc,
            USSD: panels.integrationReadiness.ussd,
          }).map(([label, value]) => (
            <Badge key={label} variant={value ? "secondary" : "outline"}>{label}: {readiness(value)}</Badge>
          ))}
        </div>
      </Card>
    </section>
  );
}
