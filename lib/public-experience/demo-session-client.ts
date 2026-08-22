import type { DemoRole } from "@/lib/public-experience/types";

export async function startPublicDemoSession(input: {
  organizationSlug: string;
  role: DemoRole;
}) {
  const response = await fetch(`/api/public/demo/${input.organizationSlug}/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: input.role }),
  });

  if (!response.ok) {
    throw new Error("Demo session could not be started");
  }

  return response.json();
}
