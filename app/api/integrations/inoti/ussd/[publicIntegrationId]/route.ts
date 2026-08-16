import { inotiUssdWorkflow } from "@/lib/integrations/inoti-ussd/workflow";
import { inotiPlainTextResponse } from "@/lib/integrations/inoti-ussd/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicIntegrationId: string }> },
) {
  try {
    const { publicIntegrationId } = await params;
    const url = new URL(request.url);
    const requestHost = request.headers.get("host");
    return inotiPlainTextResponse(await inotiUssdWorkflow.handle(publicIntegrationId, requestHost, url.searchParams));
  } catch {
    return inotiPlainTextResponse("سرویس در دسترس نیست");
  }
}
