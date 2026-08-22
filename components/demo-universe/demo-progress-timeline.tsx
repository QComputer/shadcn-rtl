"use client";

import { Check, Lock, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DemoJourneyStep } from "@/lib/demo-universe/demo-walkthrough";

const STATE_LABELS = {
  COMPLETED: "انجام شد",
  AVAILABLE: "در دسترس",
  LOCKED: "قفل",
} as const;

const STAGE_LABELS = {
  DIGITAL_PRESENCE: "Digital Presence",
  BUSINESS_OPERATIONS: "Business Operations",
  CUSTOMER_INTELLIGENCE: "Customer Intelligence",
  GROWTH_INTELLIGENCE: "Growth Intelligence",
  CUSTOMER_ENGAGEMENT: "Customer Engagement",
} as const;

function StateIcon({ state }: { state: DemoJourneyStep["state"] }) {
  if (state === "COMPLETED") return <Check className="h-4 w-4" aria-hidden="true" />;
  if (state === "LOCKED") return <Lock className="h-4 w-4" aria-hidden="true" />;
  return <Circle className="h-4 w-4" aria-hidden="true" />;
}

export function DemoProgressTimeline({ steps }: { steps: DemoJourneyStep[] }) {
  return (
    <Card className="min-w-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">مسیر تحول کسب‌وکار</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">پیشرفت دمو از حضور دیجیتال تا رشد و تعامل مشتری.</p>
        </div>
        <Badge variant="secondary">{steps.filter((step) => step.state === "COMPLETED").length}/{steps.length}</Badge>
      </div>
      <ol className="mt-5 min-w-0 space-y-3" aria-label="Demo walkthrough progress">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={`rounded-lg border p-4 ${step.state === "AVAILABLE" ? "border-primary bg-primary/5" : "bg-background"}`}
            aria-current={step.state === "AVAILABLE" ? "step" : undefined}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                step.state === "COMPLETED" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                <StateIcon state={step.state} />
              </span>
              <div className="min-w-0 flex-1 break-words">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{index + 1}</span>
                  <Badge variant={step.state === "AVAILABLE" ? "default" : "outline"}>{STATE_LABELS[step.state]}</Badge>
                  <Badge variant="secondary">{STAGE_LABELS[step.stage]}</Badge>
                  {step.relatedCapability ? <Badge variant="outline">{step.relatedCapability}</Badge> : null}
                </div>
                <h3 className="mt-3 text-base font-bold">{step.title}</h3>
                {step.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p> : null}
                <p className="mt-3 text-sm leading-6">{step.businessValue}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-1">{step.artifact}</span>
                  <span className="rounded-md bg-muted px-2 py-1">{step.role}</span>
                  {!step.visibleForRole ? <span className="rounded-md bg-muted px-2 py-1">برای نقش دیگر</span> : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
