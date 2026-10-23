import {NextResponse} from "next/server";
import {jsonError} from "@/lib/api-guards";
import {requireRetailMerchantContext} from "@/lib/retail/merchant-context.server";
import {retailImportMetadata} from "@/lib/import-hub/retail-catalog.server";
export async function GET(){try{const {context}=await requireRetailMerchantContext();return NextResponse.json(await retailImportMetadata(context),{headers:{"Cache-Control":"private, no-store"}});}catch(e){return jsonError(e,"دریافت اطلاعات ورود گروهی ناموفق بود.");}}
