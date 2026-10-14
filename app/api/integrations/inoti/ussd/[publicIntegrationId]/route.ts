import { inotiUssdWorkflow } from "@/lib/integrations/inoti-ussd/workflow";
import { createInotiUssdCallbackHandler } from "@/lib/integrations/inoti-ussd/callback-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createInotiUssdCallbackHandler(inotiUssdWorkflow);
