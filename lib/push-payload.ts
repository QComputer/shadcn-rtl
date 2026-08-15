import { normalizePushTargetUrl } from "@/lib/push-target-url";

export function buildMinimalWebPushPayload(input: {
  title: string;
  body: string;
  targetUrl?: string | null;
}) {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    url: normalizePushTargetUrl(input.targetUrl),
  });
}
