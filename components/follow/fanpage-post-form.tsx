"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary, getDictValue } from "@/lib/dictionary";

export function FanpagePostForm({ slug, locale }: { slug: string; locale: string }) {
  const router = useRouter();
  const dict = getDictionary(locale);
  const t = (key: string) => getDictValue(dict, key);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [video, setVideo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/public/organizations/${slug}/fanpage/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || null, body, image: image || null, video: video || null }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === "string" ? payload.error : t("fanpage.createError"));
      }

      setTitle("");
      setBody("");
      setImage("");
      setVideo("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("fanpage.createError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fanpage.createPost")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("fanpage.titlePlaceholder")} maxLength={120} />
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("fanpage.bodyPlaceholder")} required maxLength={4000} />
          <Input value={image} onChange={(event) => setImage(event.target.value)} placeholder={t("fanpage.imagePlaceholder")} maxLength={500} />
          <Input value={video} onChange={(event) => setVideo(event.target.value)} placeholder={t("fanpage.videoPlaceholder") || "Video URL (optional)"} maxLength={500} />
          {error && <p className="text-sm text-destructive" role="status">{error}</p>}
          <Button type="submit" disabled={isSubmitting || body.trim().length === 0}>
            {isSubmitting ? t("common.loading") : t("fanpage.publish")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
