"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PublicReviewRequestModel = {
  request: {
    productId: string | null;
    serviceId: string | null;
    appointmentId: string | null;
    orderId: string | null;
  };
  organization: { name: string };
};

function Stars({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-row-reverse justify-end gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            onClick={() => onChange(rating)}
            className="rounded-md p-1 text-amber-500 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <Star className={`h-8 w-8 ${rating <= value ? "fill-current" : ""}`} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewRequestForm({
  token,
  model,
}: {
  token: string;
  model: PublicReviewRequestModel;
}) {
  const [rating, setRating] = useState(5);
  const [serviceQualityRating, setServiceQualityRating] = useState(5);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imageLabel, setImageLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch(`/api/public/review-requests/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rating,
        serviceQualityRating,
        title,
        text,
        imageMetadata: imageLabel ? { label: imageLabel, uploadPending: true } : null,
      }),
    });
    setSubmitted(response.ok);
    setBusy(false);
  }

  const contextLabel = model.request.productId || model.request.serviceId || model.request.orderId || model.request.appointmentId;

  return (
    <main className="min-h-screen bg-background px-4 py-6" dir="rtl">
      <form onSubmit={submit} className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <header className="space-y-2 py-4 text-center">
          <p className="text-sm text-muted-foreground">بازارباز</p>
          <h1 className="text-2xl font-semibold">{model.organization.name}</h1>
          <p className="text-sm leading-6 text-muted-foreground">تجربه خود را ثبت کنید. اطلاعات هویتی شما عمومی نمایش داده نمی‌شود.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">نظر شما</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {contextLabel && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                مورد تجربه: {contextLabel}
              </div>
            )}
            <Stars value={rating} onChange={setRating} label="امتیاز کلی" />
            <Stars value={serviceQualityRating} onChange={setServiceQualityRating} label="کیفیت خدمت" />
            <div className="space-y-2">
              <Label htmlFor="title">عنوان کوتاه</Label>
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text">توضیح اختیاری</Label>
              <textarea
                id="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                maxLength={1000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageLabel">اطلاعات تصویر اختیاری</Label>
              <Input id="imageLabel" value={imageLabel} onChange={(event) => setImageLabel(event.target.value)} placeholder="مثلا عکس غذا یا رسید، بدون آپلود در این مرحله" />
            </div>
            <Button type="submit" className="w-full" disabled={busy || submitted}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitted ? <CheckCircle2 className="h-4 w-4" /> : null}
              {submitted ? "ثبت شد" : "ثبت نظر"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
