import "server-only";
import { createHash,createHmac,timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-guards";
import type { TenantContext } from "@/lib/tenant-context";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { createMerchantRetailProduct,updateMerchantRetailProduct,retailProductCreateSchema,retailProductUpdateSchema,merchantProductSelect,serializeMerchantProduct } from "@/lib/retail/merchant-catalog.server";
import { validateRetailAttributeValue } from "@/lib/retail/attribute-validation";
import { readGallerySettings } from "@/lib/retail/product-galleries";
import { normalizeDetailSlug } from "@/lib/detail-slugs";
import { readRetailSpreadsheet,retailImportInput,splitIds,decimalCell,stockCell,boolCell,writeRetailSpreadsheet,type RetailImportInput } from "./retail-spreadsheet";

type Tx=Prisma.TransactionClient;
type Create=z.infer<typeof retailProductCreateSchema>;
type Update=z.infer<typeof retailProductUpdateSchema>;
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const clear=(value:string)=>value==="[[CLEAR]]"?null:value;
const contract="RETAIL_R3";
const countsSchema=z.object({productsCreate:z.number().int().nonnegative(),variantsCreate:z.number().int().nonnegative(),productsUpdate:z.number().int().nonnegative(),variantsUpdate:z.number().int().nonnegative(),unchanged:z.number().int().nonnegative(),invalidRows:z.number().int().nonnegative(),warnings:z.number().int().nonnegative()});
const executeSchema=retailImportInput.extend({token:z.string().min(1).max(3000),idempotencyKey:z.string().uuid(),confirmed:z.literal(true)}).strict();
export { executeSchema as retailImportExecutionSchema };
async function authorize(context:TenantContext) {
  if(!["ADMIN","MANAGER","SUPER_ADMIN"].includes(context.role))throw new ApiError(403,"دسترسی مدیریت کاتالوگ ندارید.");
  const org=await prisma.organization.findFirst({where:{id:context.organizationId,slug:context.organizationSlug,isActive:true,deletedAt:null},select:{id:true}});
  if(!org)throw new ApiError(403,"فروشگاه فعال نیست.");
  await requireActiveOrganizationCapability({organizationId:context.organizationId,capability:"SHOP"});
}
export async function retailImportMetadata(context:TenantContext) {
  await authorize(context);
  const [categories,definitions,media,jobs]=await Promise.all([
    prisma.productCategory.findMany({where:{organizationId:context.organizationId,isActive:true,deletedAt:null},select:{id:true,name:true},take:200,orderBy:{id:"asc"}}),
    prisma.retailAttributeDefinition.findMany({where:{organizationId:context.organizationId,isActive:true},select:{id:true,key:true,label:true,scope:true},take:80,orderBy:{id:"asc"}}),
    prisma.image.findMany({where:{organizationId:context.organizationId,access:"PUBLIC"},select:{id:true,url:true},take:200,orderBy:{id:"asc"}}),
    prisma.externalImportJob.findMany({where:{organizationId:context.organizationId,summary:{path:["contract"],equals:contract}},select:{id:true,status:true,createdAt:true,summary:true},take:10,orderBy:{createdAt:"desc"}}),
  ]);return {categories,definitions,media,jobs};
}
function secret() {const key=process.env.NEXTAUTH_SECRET||process.env.AUTH_SECRET;if(!key)throw new ApiError(503,"پیکربندی امن پیش‌نمایش فراهم نیست.");return key;}
function signature(body:string){return createHmac("sha256",secret()).update("retail-import:"+body).digest("base64url");}
function tokenFor(context:TenantContext,input:RetailImportInput,fingerprint:string) {
  const body=Buffer.from(JSON.stringify({org:context.organizationId,actor:context.actorUserId,input:hash(input),fingerprint,expires:Date.now()+900_000})).toString("base64url");
  return body+"."+signature(body);
}
function verifyToken(token:string,context:TenantContext,input:RetailImportInput,fingerprint:string) {
  const [body,sig]=token.split(".");const expected=signature(body||"");
  if(!sig||sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))throw new ApiError(409,"پیش‌نمایش معتبر نیست؛ دوباره بررسی کنید.");
  let data:{org:string;actor:string;input:string;fingerprint:string;expires:number};try{data=JSON.parse(Buffer.from(body,"base64url").toString());}catch{throw new ApiError(409,"پیش‌نمایش معتبر نیست.");}
  if(data.org!==context.organizationId||data.actor!==context.actorUserId||data.input!==hash(input)||data.fingerprint!==fingerprint||data.expires<Date.now())throw new ApiError(409,"کاتالوگ یا پیش‌نمایش تغییر کرده یا منقضی شده است؛ دوباره بررسی کنید.");
}
async function plan(tx:Tx,context:TenantContext,input:RetailImportInput) {
  const source=readRetailSpreadsheet(input);if(!source.length)throw new ApiError(400,"فایل خالی است.");
  const ids=source.map(r=>r.data.product_id).filter(Boolean);
  const slugs=source.map(r=>r.data.slug||r.data.product_key).filter(Boolean).map(value=>normalizeDetailSlug(value));
  const skuValues=source.map(r=>r.data.sku).filter(Boolean);
  const [stored,definitions,categories,media,skuOwners]=await Promise.all([
    tx.product.findMany({where:{organizationId:context.organizationId,deletedAt:null,OR:[{id:{in:ids}},{slug:{in:slugs}}]},select:merchantProductSelect,orderBy:{id:"asc"}}),
    tx.retailAttributeDefinition.findMany({where:{organizationId:context.organizationId,isActive:true},orderBy:{id:"asc"}}),
    tx.productCategory.findMany({where:{organizationId:context.organizationId,isActive:true,deletedAt:null},select:{id:true},orderBy:{id:"asc"}}),
    tx.image.findMany({where:{organizationId:context.organizationId,access:"PUBLIC",id:{in:source.flatMap(r=>["image_ids","variant_image_ids","color_image_ids"].flatMap(k=>splitIds(r.data[k]||""))) }},select:{id:true},orderBy:{id:"asc"}}),
    tx.productVariant.findMany({where:{sku:{in:skuValues}},select:{id:true,sku:true},orderBy:{id:"asc"}}),
  ]);
  const products=stored.map(serializeMerchantProduct);
  const fingerprint=hash([stored,definitions,categories,media,skuOwners]);
  const rows=source.map(row=>({...row,productKey:row.data.product_id||row.data.product_key||"",sku:row.data.sku||null,action:"UNCHANGED",errors:[] as string[],warnings:[] as string[]}));
  const groups=new Map<string,typeof rows>();for(const row of rows){if(!row.productKey)row.errors.push("کلید محصول یا شناسه محصول لازم است.");const group=groups.get(row.productKey)||[];group.push(row);groups.set(row.productKey,group);}
  if(groups.size>10)throw new ApiError(400,"حداکثر ۱۰ محصول در هر دسته مجاز است.");
  const changes:Array<{key:string;productId?:string;create?:Create;update?:Update}>=[];
  const counts={productsCreate:0,variantsCreate:0,productsUpdate:0,variantsUpdate:0,unchanged:0,invalidRows:0,warnings:0};
  const seenSku=new Set<string>(),seenVariants=new Set<string>(),seenProducts=new Set<string>();
  const plannedSlugs=new Set<string>();
  for(const [key,group] of groups) {
    const fail=(message:string)=>group.forEach(row=>row.errors.push(message));
    const merged:Record<string,string>={};
    const productFields=["product_id","product_name","slug","brand","description","category_id","category_ids","tags","published","track_inventory","image_ids"];
    productFields.push(...new Set(group.flatMap(row=>Object.keys(row.data).filter(key=>key.startsWith("product_attribute:")))));
    for(const field of productFields){const values=[...new Set(group.map(r=>r.data[field]).filter(Boolean))];if(values.length>1)fail("مقدار "+field+" در ردیف‌های یک محصول یکسان نیست.");if(values[0])merged[field]=values[0];}
    const current=products.find(p=>p.id===merged.product_id);
    if(merged.product_id&&!current)fail("شناسه محصول متعلق به فروشگاه فعال نیست.");
    const creating=!merged.product_id;
    if(input.mode==="CREATE"&&!creating)fail("حالت ایجاد، شناسه محصول موجود نمی‌پذیرد.");
    if(input.mode==="UPDATE"&&creating)fail("برای به‌روزرسانی product_id خروجی را وارد کنید.");
    if(current&&seenProducts.has(current.id))fail("یک محصول با چند کلید متفاوت تکرار شده است.");if(current)seenProducts.add(current.id);
    const productData:Record<string,unknown>={};
    try{
      for(const [column,field] of [["product_name","name"],["slug","slug"],["brand","brand"],["description","description"],["category_id","categoryId"]] as const)if(merged[column])productData[field]=clear(merged[column]);
      if(merged.category_ids)productData.categoryIds=splitIds(merged.category_ids);
      if(merged.tags)productData.tagNames=splitIds(merged.tags);
      if(merged.track_inventory)productData.trackInventory=boolCell(merged.track_inventory);
      if(merged.image_ids)productData.imageIds=splitIds(merged.image_ids);
      if(merged.published)productData.isActive=boolCell(merged.published);
      const attributes=current?.attributes.map(a=>({definitionId:a.definitionId,value:a.value as string|number|boolean}))||[];
      let hasAttributes=false;
      for(const [column,value] of Object.entries(merged).filter(([key])=>key.startsWith("product_attribute:"))){
        const def=definitions.find(d=>d.key===column.slice(18)&&d.scope==="PRODUCT");
        if(!def)throw new Error("ویژگی محصول متعلق به فروشگاه نیست.");
        const index=attributes.findIndex(a=>a.definitionId===def.id);if(index>=0)attributes.splice(index,1);
        if(value!=="[[CLEAR]]"){const typed=def.valueType==="NUMBER"?Number(normalizeAttributeNumber(value)):def.valueType==="BOOLEAN"?boolCell(value):value;
          validateRetailAttributeValue({valueType:def.valueType,allowedValues:Array.isArray(def.allowedValues)?def.allowedValues.filter((x):x is string=>typeof x==="string"):null},typed);attributes.push({definitionId:def.id,value:typed});}
        hasAttributes=true;
      }
      if(hasAttributes)productData.attributes=attributes;
      if(creating){productData.slug=normalizeDetailSlug(String(productData.slug||key));if(plannedSlugs.has(String(productData.slug)))throw new Error("نامک چند محصول در فایل یکسان است.");plannedSlugs.add(String(productData.slug));if(productData.isActive===true)throw new Error("محصول جدید فقط به‌صورت پیش‌نویس ایجاد می‌شود.");delete productData.isActive;}
      else if(productData.slug)productData.slug=normalizeDetailSlug(String(productData.slug));
      for(const id of [productData.categoryId,...(productData.categoryIds as string[]||[])].filter(Boolean))if(!categories.some(c=>c.id===id))throw new Error("شناسه دسته‌بندی نامعتبر یا خارج از فروشگاه است.");
      for(const id of productData.imageIds as string[]||[])if(!media.some(m=>m.id===id))throw new Error("رسانه باید عمومی و متعلق به همین فروشگاه باشد.");
      if(creating&&products.some(p=>p.slug===productData.slug))throw new Error("کلید یا نامک محصول موجود است؛ برای ویرایش از شناسه پایدار استفاده کنید.");
      if(current&&productData.slug&&products.some(p=>p.id!==current.id&&p.slug===productData.slug))throw new Error("نامک محصول تکراری است.");
    }catch(e){fail((e as Error).message);}
    const variants:Create["variants"]=[],updates:NonNullable<Update["variantUpdates"]>=[];
    const colorGroups=new Map<string,{definitionId:string;value:string;imageIds:string[]}>();
    for(const row of group){
      const d=row.data;const old=current?.variants.find(v=>v.id===d.variant_id);
      if(d.variant_id&&(!old||seenVariants.has(d.variant_id)))row.errors.push("شناسه گونه نامعتبر، تکراری یا متعلق به محصول دیگری است.");if(d.variant_id)seenVariants.add(d.variant_id);
      const hasVariant=creating||Boolean(d.variant_id)||["sku","variant_name","stock","price_toman"].some(k=>Boolean(d[k]));
      if(!hasVariant){row.warnings.push("این ردیف فقط اطلاعات محصول را تغییر می‌دهد؛ گونه‌ای حذف یا ایجاد نمی‌شود.");continue;}
      try{
        const v:Record<string,unknown>={};
        if(d.variant_name)v.name=d.variant_name;
        if(d.sku){if(d.sku==="[[CLEAR]]"||/\s/.test(d.sku))throw new Error("SKU بدون فاصله و غیرخالی لازم است.");v.sku=d.sku;if(seenSku.has(d.sku)||skuOwners.some(owner=>owner.sku===d.sku&&owner.id!==old?.id))throw new Error("SKU تکراری یا در حال استفاده است.");seenSku.add(d.sku);}
        if(d.price_toman)v.price=decimalCell(d.price_toman);
        if(d.stock){v.inventory=stockCell(d.stock);if(old&&(v.inventory as number)<old.reservedQuantity)throw new Error("موجودی کمتر از تعداد رزروشده مجاز نیست.");}
        if(d.allow_backorder)v.allowBackOrder=boolCell(d.allow_backorder);
        if(d.gallery_mode){if(!["INHERIT","OVERRIDE"].includes(d.gallery_mode))throw new Error("gallery_mode باید INHERIT یا OVERRIDE باشد.");v.galleryMode=d.gallery_mode;}
        if(d.variant_image_ids){v.imageIds=splitIds(d.variant_image_ids);v.galleryMode=d.gallery_mode||"OVERRIDE";}
        for(const id of v.imageIds as string[]||[])if(!media.some(m=>m.id===id))throw new Error("تصویر گونه متعلق به این فروشگاه نیست.");
        const options=old?.options.map(o=>({definitionId:o.definitionId,value:o.value as string|number|boolean}))||[];
        let changedOptions=false;
        for(const [column,value] of Object.entries(d).filter(([column,value])=>column.startsWith("attribute:")&&value)){
          const def=definitions.find(x=>x.key===column.slice(10)&&x.scope==="VARIANT_OPTION");if(!def)throw new Error("ویژگی گونه در فروشگاه تعریف نشده است: "+column);
          const index=options.findIndex(x=>x.definitionId===def.id);if(index>=0)options.splice(index,1);
          if(value!=="[[CLEAR]]"){
            const typed=def.valueType==="NUMBER"?Number(normalizeAttributeNumber(value)):def.valueType==="BOOLEAN"?boolCell(value):value;
            validateRetailAttributeValue({valueType:def.valueType,allowedValues:Array.isArray(def.allowedValues)?def.allowedValues.filter((x):x is string=>typeof x==="string"):null},typed);
            options.push({definitionId:def.id,value:typed});
          }changedOptions=true;
        }
        if(changedOptions||!old)v.options=options;
        if(d.color_image_ids){
          const def=definitions.find(x=>x.key===d.color_attribute&&x.scope==="VARIANT_OPTION");if(!def||!d.color_value)throw new Error("برای گالری رنگ، کلید ویژگی و مقدار رنگ لازم است.");
          const imageIds=splitIds(d.color_image_ids);for(const id of imageIds)if(!media.some(m=>m.id===id))throw new Error("تصویر رنگ متعلق به این فروشگاه نیست.");
          if(!options.some(o=>o.definitionId===def.id&&String(o.value)===d.color_value))throw new Error("رنگ گالری با ویژگی‌های گونه مطابقت ندارد.");
          const groupKey=def.id+":"+d.color_value;const previous=colorGroups.get(groupKey);if(previous&&hash(previous.imageIds)!==hash(imageIds))throw new Error("ترتیب تصاویر یک رنگ در ردیف‌ها متفاوت است.");
          colorGroups.set(groupKey,{definitionId:def.id,value:d.color_value,imageIds});
          if (!old && !v.galleryMode) v.galleryMode="INHERIT";
          if (old && old.galleryMode!=="INHERIT" && !d.gallery_mode) row.warnings.push("گالری اختصاصی گونه حفظ می‌شود؛ برای استفاده از رنگ، gallery_mode را INHERIT کنید.");
        }
        if(old){const parsed=retailProductUpdateSchema.parse({variantUpdates:[{...v,id:old.id}]}).variantUpdates![0];for(const field of Object.keys(parsed) as Array<keyof typeof parsed>){if(field==="id")continue;const existing=field==="options"?old.options.map(o=>({definitionId:o.definitionId,value:o.value})):field==="galleryMode"?old.galleryMode:old[field as keyof typeof old];if(hash(parsed[field])===hash(existing))delete parsed[field];}
          if(Object.keys(parsed).length>1){updates.push(parsed);row.action="UPDATE";counts.variantsUpdate++;}else counts.unchanged++;
        }else{
          if(!v.sku||v.price===undefined||v.inventory===undefined)throw new Error("گونه جدید به SKU، قیمت و موجودی صریح نیاز دارد.");
          variants.push(retailProductCreateSchema.shape.variants.element.parse({...v,name:v.name||String(v.sku)}));row.action="CREATE";counts.variantsCreate++;
        }
      }catch(e){row.errors.push(e instanceof z.ZodError?"مقدار گونه معتبر نیست: "+e.issues.map(x=>x.path.join(".")).join("، "):(e as Error).message);}
    }
    const settings=readGallerySettings(current?.gallerySettings);
    if(colorGroups.size||productData.imageIds!==undefined||[...variants,...updates].some(v=>v.galleryMode==="INHERIT")){
      productData.gallerySettings={version:1,productImageIds:productData.imageIds??current?.imageIds??[],colors:[...(settings?.colors||[]).filter(c=>!colorGroups.has(c.definitionId+":"+c.value)),...colorGroups.values()]};
    }
    try{
      const allVariants=[...(current?.variants||[]).map(v=>{const patch=updates.find(u=>u.id===v.id);return {...v,...patch,options:patch?.options??v.options};}),...variants];
      const combos=new Set<string>();for(const v of allVariants){if(!v.options?.length)continue;const combination=JSON.stringify(v.options.map(o=>[o.definitionId,o.value]).sort(([a],[b])=>String(a).localeCompare(String(b))));if(combos.has(combination))throw new Error("ترکیب ویژگی‌های گونه تکراری است.");combos.add(combination);}
      if(creating){const data=retailProductCreateSchema.parse({...productData,variants});changes.push({key,create:data});counts.productsCreate++;group.forEach(row=>row.warnings.push("محصول جدید پیش‌نویس خواهد بود؛ انتشار از ویرایشگر محصول انجام می‌شود."));}
      else if(current){
        const comparable:Record<string,unknown>={name:current.name,slug:current.slug,brand:current.brand,description:current.description,categoryId:current.category.id,categoryIds:current.categoryIds,tagNames:current.tags.map(t=>t.name),imageIds:current.imageIds,trackInventory:current.trackInventory,isActive:current.isActive};
        for(const key of Object.keys(productData))if(key in comparable&&hash(productData[key])===hash(comparable[key]))delete productData[key];
        if((productData.isActive??current.isActive)&&((productData.imageIds as string[]|undefined)?.length===0||(!(productData.imageIds as string[]|undefined)?.length&&!current.imageIds.length))&&(variants.length||updates.length||productData.isActive===true))throw new Error("برای محصول منتشرشده، تصویر عمومی متعلق به فروشگاه لازم است.");
        const data=retailProductUpdateSchema.parse({...productData,...(updates.length?{variantUpdates:updates}:{}),...(variants.length?{newVariants:variants}:{})});
        if ((data.isActive??current.isActive) && (data.isActive===true||allVariants.length)){
          if(!allVariants.length||allVariants.some(v=>!v.sku||!v.price||v.price<=0))throw new Error("محصول منتشرشده به گونه با SKU و قیمت مثبت نیاز دارد.");
          if(!categories.some(c=>c.id===(data.categoryId||current.category.id)))throw new Error("دسته‌بندی فعال برای انتشار لازم است.");
        }
        for(const color of data.gallerySettings?.colors||[])if(!allVariants.some(v=>v.options?.some(o=>o.definitionId===color.definitionId&&String(o.value)===color.value)))throw new Error("رنگ گالری با گزینه‌های فعلی محصول مطابقت ندارد.");
        if (data.gallerySettings && settings && hash(data.gallerySettings)===hash({version:settings.version,productImageIds:settings.productImageIds,colors:settings.colors})) delete data.gallerySettings;
        if(Object.keys(data).length){changes.push({key,productId:current.id,update:data});counts.productsUpdate++;group.forEach(row=>{if(row.action==="UNCHANGED")row.action="UPDATE";});}
      }
    }catch(e){fail(e instanceof z.ZodError?"اطلاعات محصول ناقص است: "+e.issues.map(x=>x.path.join(".")).join("، "):(e as Error).message);}
  }
  counts.invalidRows=rows.filter(r=>r.errors.length).length;counts.warnings=rows.reduce((n,r)=>n+r.warnings.length,0);
  return {fingerprint,rows:rows.map(({rowNumber,productKey,sku,action,errors,warnings,data})=>{
    const existing=products.find(p=>p.id===data.product_id);
    const variant=existing?.variants.find(v=>v.id===data.variant_id);
    const values:Record<string,string>={product_name:existing?.name||groups.get(productKey)?.find(r=>r.data.product_name)?.data.product_name||"",variant_name:variant?.name||"",sku:variant?.sku||"",price_toman:variant?.price===null||variant?.price===undefined?"":String(variant.price),stock:variant?String(variant.inventory):""};
    for(const option of variant?.options||[])values["attribute:"+option.key]=String(option.value);
    for(const [key,value] of Object.entries(data))if(value)values[key]=value;
    return {rowNumber,productKey,sku:sku||variant?.sku||null,action,errors,warnings,values};
  }),counts,changes,source};
}
function normalizeAttributeNumber(value:string){return value.replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>="۰"&&c<="۹"?1776:1632)));}
export async function previewRetailImport(context:TenantContext,raw:RetailImportInput) {
  await authorize(context);const input=retailImportInput.parse(raw);const result=await prisma.$transaction(tx=>plan(tx,context,input),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  return {rows:result.rows,counts:result.counts,token:tokenFor(context,input,result.fingerprint)};
}
export async function executeRetailImport(context:TenantContext,raw:z.infer<typeof executeSchema>) {
  await authorize(context);const parsed=executeSchema.parse(raw);const input=retailImportInput.parse({format:parsed.format,content:parsed.content,mode:parsed.mode});
  try{
    const result=await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id"=${context.organizationId} FOR UPDATE`;
      const existing=await tx.externalImportJob.findFirst({where:{organizationId:context.organizationId,inputText:"retail-r3:"+parsed.idempotencyKey},select:{id:true,status:true,summary:true}});
      if(existing){const summary=existing.summary as {inputHash?:string;counts?:unknown};if(summary.inputHash!==hash(input))throw new ApiError(409,"شناسه اجرا برای فایل دیگری استفاده شده است.");return {jobId:existing.id,status:existing.status,counts:countsSchema.parse(summary.counts)};}
      const result=await plan(tx,context,input);verifyToken(parsed.token,context,input,result.fingerprint);
      if(result.counts.invalidRows)throw new ApiError(400,"فایل ردیف نامعتبر دارد؛ خطاهای پیش‌نمایش را اصلاح کنید.");
      const limit=await tx.externalImportJob.count({where:{organizationId:context.organizationId,createdAt:{gte:new Date(Date.now()-86400000)}}});if(limit>=50)throw new ApiError(429,"سقف روزانه ۵۰ اجرای ورود تکمیل شده است.");
      const job=await tx.externalImportJob.create({data:{organizationId:context.organizationId,type:input.format==="CSV"?"CSV":"EXCEL",status:"COMPLETED",inputText:"retail-r3:"+parsed.idempotencyKey,consentConfirmed:true,consentText:"Explicit retail catalog preview confirmation",requestedByUserId:context.actorUserId,startedAt:new Date(),completedAt:new Date(),summary:json({contract,inputHash:hash(input),mode:input.mode,counts:result.counts})}});
      for(const change of result.changes){
        const product=change.create?await createMerchantRetailProduct(context,context.actorUserId,change.create,tx):await updateMerchantRetailProduct(context,context.actorUserId,change.productId!,change.update!,tx);
        for(const row of result.source.filter(r=>(r.data.product_id||r.data.product_key)===change.key))await tx.importedProductDraft.create({data:{organizationId:context.organizationId,jobId:job.id,status:"IMPORTED",name:product.name,sku:row.data.sku||null,rawData:json(row.data),currency:"TOMAN",rowNumber:row.rowNumber,importedAt:new Date(),importedProductId:product.id,reviewedAt:new Date(),reviewedByUserId:context.actorUserId}});
      }
      await tx.auditLog.create({data:{action:"CREATE",entityType:"ExternalImportJob",entityId:job.id,userId:context.actorUserId,organizationId:context.organizationId,organizationSlug:context.organizationSlug,description:"Retail bulk catalog import applied atomically",newValue:json({contract,mode:input.mode,counts:result.counts})}});
      return {jobId:job.id,status:job.status,counts:result.counts};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5000,timeout:30000});
    for(const locale of ["fa","en","ar"])revalidatePath("/"+locale+"/"+context.organizationSlug+"/shop","layout");return result;
  }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&["P2034","P2002"].includes(e.code))throw new ApiError(409,"کاتالوگ هم‌زمان تغییر کرد یا شناسه تکراری است؛ پیش‌نمایش تازه بگیرید.");throw e;}
}

export async function downloadRetailCatalog(context:TenantContext,kind:"template"|"export",format:"CSV"|"XLSX") {
  await authorize(context);
  if(kind==="template"){
    const category=await prisma.productCategory.findFirst({where:{organizationId:context.organizationId,isActive:true,deletedAt:null},select:{id:true},orderBy:{id:"asc"}});
    return writeRetailSpreadsheet([{product_key:"synthetic-example-001",product_name:"کالای نمونه آزمایشی — فقط الگو",category_id:category?.id||"شناسه دسته‌بندی را وارد کنید",variant_name:"گزینه نمونه",sku:"000123",price_toman:"2500000",stock:"0",track_inventory:"true",allow_backorder:"false",published:"false"}],format);
  }
  const products=await prisma.product.findMany({where:{organizationId:context.organizationId,deletedAt:null},select:merchantProductSelect,orderBy:{id:"asc"},take:501});
  if(products.length>500||products.reduce((n,p)=>n+Math.max(1,p.variants.length),0)>1000)throw new ApiError(400,"خروجی حداکثر ۱۰۰۰ گونه است؛ برای کاتالوگ بزرگ‌تر خروجی محدودشده لازم است.");
  const rows:Record<string,string>[]=[];
  for(const raw of products){
    const p=serializeMerchantProduct(raw);
    const common:Record<string,string>={product_key:p.id,product_id:p.id,product_name:p.name,slug:p.slug||"",brand:p.brand??"",description:p.description??"",category_id:p.category.id,category_ids:p.categoryIds.join("|"),tags:p.tags.map(t=>t.name).join("|"),published:String(p.isActive),track_inventory:String(p.trackInventory),image_ids:p.imageIds.join("|")};
    for(const attribute of p.attributes)common["product_attribute:"+attribute.key]=String(attribute.value);
    if(!p.variants.length)rows.push(common);
    for(const v of p.variants){
      const row={...common,variant_id:v.id,variant_name:v.name,sku:v.sku||"",price_toman:v.price===null?"":String(v.price),stock:String(v.inventory),allow_backorder:String(v.allowBackOrder),gallery_mode:v.galleryMode||"OVERRIDE",variant_image_ids:v.imageIds.length?v.imageIds.join("|"):"[[CLEAR]]"} as Record<string,string>;
      for(const option of v.options)row["attribute:"+option.key]=String(option.value);
      const color=p.gallerySettings?.colors.find(c=>v.options.some(o=>o.definitionId===c.definitionId&&String(o.value)===c.value));
      if(color){row.color_attribute=v.options.find(o=>o.definitionId===color.definitionId)!.key;row.color_value=color.value;row.color_image_ids=color.imageIds.length?color.imageIds.join("|"):"[[CLEAR]]";}
      rows.push(row);
    }
  }
  return writeRetailSpreadsheet(rows,format);
}
