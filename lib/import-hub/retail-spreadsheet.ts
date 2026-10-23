import { parseCsvRows } from "@/lib/import-hub/spreadsheet-parser";
import * as XLSX from "xlsx";
import { inflateRawSync } from "node:zlib";
import { z } from "zod";

export const retailImportInput = z.object({format:z.enum(["CSV","XLSX"]),content:z.string().min(1).max(1_400_000),mode:z.enum(["CREATE","UPDATE","UPSERT"])}).strict();
export type RetailImportInput = z.infer<typeof retailImportInput>;
import { MAX_RETAIL_ROWS } from "./retail-batches";
export { MAX_RETAIL_ROWS } from "./retail-batches";
export const retailColumns=["product_key","product_id","variant_id","product_name","slug","brand","description","category_id","category_ids","tags","published","track_inventory","variant_name","sku","price_toman","stock","allow_backorder","image_ids","gallery_mode","variant_image_ids","color_attribute","color_value","color_image_ids"];
export const normalizeDigits=(s:string)=>s.replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>="۰"&&c<="۹"?1776:1632)));
export const splitIds=(s:string)=>s==="[[CLEAR]]"?[]:s.split("|").map(x=>x.trim()).filter(Boolean);
export function decimalCell(s:string) {
  const n=normalizeDigits(s);
  if(!/^\d+(\.\d{1,2})?$/.test(n)||Number(n)<=0||Number(n)>9_999_999_999.99)throw new Error("قیمت باید عدد مثبت به تومان، بدون جداکننده و حداکثر دو رقم اعشار باشد.");
  return Number(n);
}
export function stockCell(s:string) {
  const n=normalizeDigits(s);if(!/^\d+$/.test(n)||Number(n)>1_000_000_000)throw new Error("موجودی باید عدد صحیح نامنفی باشد.");return Number(n);
}
export function boolCell(s:string) {
  const n=normalizeDigits(s).toLowerCase();if(["true","1","بله"].includes(n))return true;if(["false","0","خیر"].includes(n))return false;throw new Error("مقدار باید true یا false باشد.");
}
function assertWorkbookArchive(buffer:Buffer) {
  // Bound decompression before SheetJS reads the ZIP. No files are extracted.
  let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw new Error("فایل XLSX معتبر نیست.");
  const entries=buffer.readUInt16LE(end+10),offset=buffer.readUInt32LE(end+16);
  if(entries>128||entries===65535||buffer.readUInt16LE(end+4)!==0||buffer.readUInt16LE(end+6)!==0)throw new Error("ساختار فایل اکسل پشتیبانی نمی‌شود.");
  let cursor=offset,total=0;
  for(let i=0;i<entries;i++){
    if(cursor+46>buffer.length||buffer.readUInt32LE(cursor)!==0x02014b50)throw new Error("ساختار فایل اکسل معتبر نیست.");
    const size=buffer.readUInt32LE(cursor+24),method=buffer.readUInt16LE(cursor+10);
    total+=size;if(size===0xffffffff||total>8_000_000||![0,8].includes(method)||(buffer.readUInt16LE(cursor+8)&1))throw new Error("حجم بازشده یا ساختار فایل اکسل بیش از حد مجاز است.");
    const local=buffer.readUInt32LE(cursor+42),compressed=buffer.readUInt32LE(cursor+20);
    if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)throw new Error("ساختار فایل اکسل معتبر نیست.");
    const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
    if(start+compressed>buffer.length)throw new Error("ساختار فایل اکسل معتبر نیست.");
    const payload=buffer.subarray(start,start+compressed);
    const decoded=method===8?inflateRawSync(payload,{maxOutputLength:8_000_000}):payload;
    if(decoded.length!==size)throw new Error("اندازه داده‌های اکسل معتبر نیست.");
    cursor+=46+buffer.readUInt16LE(cursor+28)+buffer.readUInt16LE(cursor+30)+buffer.readUInt16LE(cursor+32);
  }
  if(cursor>end)throw new Error("ساختار فایل اکسل معتبر نیست.");
}
export function readRetailSpreadsheet(input:RetailImportInput) {
  let table:string[][];
  if(input.format==="CSV"){
    if(Buffer.byteLength(input.content,"utf8")>1_000_000)throw new Error("حجم فایل بیش از یک مگابایت است.");
    table=parseCsvRows(input.content.replace(/^\uFEFF/,""),MAX_RETAIL_ROWS);
  }else{
    const buffer=Buffer.from(input.content,"base64");if(buffer.length>1_000_000)throw new Error("حجم فایل بیش از یک مگابایت است.");
    assertWorkbookArchive(buffer);
    const book=XLSX.read(buffer,{type:"buffer",sheetRows:MAX_RETAIL_ROWS+2,cellFormula:true,cellText:true});
    const sheet=book.Sheets[book.SheetNames[0]];if(!sheet)throw new Error("برگه‌ای در فایل نیست.");
    const range=XLSX.utils.decode_range(sheet["!fullref"]||sheet["!ref"]||"A1");
    if(range.e.r>MAX_RETAIL_ROWS||range.e.c>80)throw new Error("حداکثر ۵۰۰ ردیف و ۸۱ ستون مجاز است.");
    for(const [key,cell] of Object.entries(sheet))if(!key.startsWith("!")&&cell.f)throw new Error("فرمول در فایل ورودی مجاز نیست؛ مقادیر را به متن تبدیل کنید.");
    table=XLSX.utils.sheet_to_json<string[]>(sheet,{header:1,raw:false,defval:"",blankrows:true});
  }
  if(table.length<2||table.length>MAX_RETAIL_ROWS+1)throw new Error("فایل باید بین ۱ تا ۵۰۰ ردیف کالا داشته باشد.");
  const headers=table[0].map(x=>String(x).trim().toLowerCase());
  if(headers.length>81||new Set(headers).size!==headers.length||headers.some(x=>!x||(!retailColumns.includes(x)&&! /^(product_)?attribute:[a-z0-9_-]+$/.test(x))))throw new Error("نام ستون ناشناخته یا تکراری است؛ از فایل الگو استفاده کنید.");
  if(!headers.includes("product_key")&&!headers.includes("product_id"))throw new Error("ستون شناسه یا کلید محصول لازم است.");
  return table.slice(1).map((cells,i)=>{
    if(cells.length>headers.length)throw new Error("تعداد ستون‌های ردیف "+(i+2)+" معتبر نیست.");
    const data:Record<string,string>={};headers.forEach((h,j)=>{let value=String(cells[j]??"").trim();if(/^'(?=\s*[=+\-@])/.test(value))value=value.slice(1);if(value.length>5000)throw new Error("متن سلول طولانی است.");data[h]=value;});
    return {rowNumber:i+2,data};
  }).filter(x=>Object.values(x.data).some(Boolean));
}
export function writeRetailSpreadsheet(rows:Record<string,string>[],format:"CSV"|"XLSX") {
  const columns=[...new Set([...retailColumns,...rows.flatMap(r=>Object.keys(r))])];
  const table=[columns,...rows.map(row=>columns.map(key=>row[key]??""))];
  if(format==="XLSX"){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(table),"Retail");return XLSX.write(book,{type:"buffer",bookType:"xlsx"}) as Buffer;}
  const escape=(s:string)=>'"'+(/^(\s*[=+\-@]|[\t\r\n])/.test(s)?"'"+s:s).replaceAll('"','""')+'"';
  return Buffer.from("\uFEFF"+table.map(row=>row.map(escape).join(",")).join("\r\n"),"utf8");
}
