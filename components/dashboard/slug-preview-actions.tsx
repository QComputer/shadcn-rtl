"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type SlugPreviewActionsProps = {
  path?: string | null;
  label?: string;
};

export function SlugPreviewActions({ path, label = "Public URL" }: SlugPreviewActionsProps) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const publicUrl = useMemo(() => {
    if (!origin || !path) return "";
    return new URL(path, origin).toString();
  }, [origin, path]);

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 truncate font-mono text-xs" dir="ltr">
            {publicUrl || "Enter a slug to preview the public URL"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!publicUrl}
            onClick={handleCopy}
            title="Copy public URL"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!publicUrl}
            onClick={() => publicUrl && window.open(publicUrl, "_blank", "noopener,noreferrer")}
            title="Open public URL"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
