import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {parseProductSpreadsheet} from "../../lib/import-hub/spreadsheet-parser";
import { retailExportBatches } from "../../lib/import-hub/retail-batches";
import {
  boolCell,
  decimalCell,
  normalizeDigits,
  readRetailSpreadsheet,
  stockCell,
  writeRetailSpreadsheet,
} from "../../lib/import-hub/retail-spreadsheet";

const readCsv = (content: string) => readRetailSpreadsheet({ format: "CSV", content, mode: "CREATE" });

test("patched SheetJS preserves the legacy P69 spreadsheet contract",()=>{
  const [major,minor,patch]=XLSX.version.split(".").map(Number);
  assert.ok(major>0||minor>20||minor===20&&patch>=3,"untrusted workbook imports require SheetJS 0.20.3 or newer");
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["name","price","stock","sku"],["محصول قدیمی آزمایشی","1250000","3","000LEGACY"]]),"Legacy");
  const rows=parseProductSpreadsheet({type:"EXCEL",fileBase64:XLSX.write(book,{type:"base64",bookType:"xlsx"})});
  assert.equal(rows[0].name,"محصول قدیمی آزمایشی");
  assert.equal(rows[0].basePrice,"1250000.00");
  assert.equal(rows[0].stock,3);
  assert.equal(rows[0].sku,"000LEGACY");
});

test("rejects malformed or oversized expanded XLSX archives before workbook parsing", () => {
  assert.throws(()=>readRetailSpreadsheet({format:"XLSX",content:Buffer.from("not a zip").toString("base64"),mode:"CREATE"}));
  const buffer=writeRetailSpreadsheet([{product_key:"P1",sku:"0001"}],"XLSX");
  const central=buffer.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  assert.ok(central>=0);
  const oversized=Buffer.from(buffer);oversized.writeUInt32LE(9_000_000,central+24);
  assert.throws(()=>readRetailSpreadsheet({format:"XLSX",content:oversized.toString("base64"),mode:"CREATE"}),/حجم/);
  const wrongSize=Buffer.from(buffer);wrongSize.writeUInt32LE(1,central+24);
  assert.throws(()=>readRetailSpreadsheet({format:"XLSX",content:wrongSize.toString("base64"),mode:"CREATE"}),/اندازه/);
});

test("reads BOM CSV with Persian headers/digits, quoted commas, and multiline text", () => {
  const [row] = readCsv('\uFEFFproduct_key,product_name,description,price_toman,stock\r\nP-1,"پیراهن، آبی","خط اول, با ویرگول\nخط دوم",۱۲۳۴.۵۰,۰۷');
  assert.equal(row.data.product_name, "پیراهن، آبی");
  assert.equal(row.data.description, "خط اول, با ویرگول\nخط دوم");
  assert.equal(decimalCell(row.data.price_toman), 1234.5);
  assert.equal(stockCell(row.data.stock), 7);
});

test("round-trips CSV and XLSX while preserving leading-zero SKU strings", () => {
  const rows = [{ product_key: "shirt", product_name: "Shirt", sku: "000042", price_toman: "1200", stock: "8" }];
  const csv = writeRetailSpreadsheet(rows, "CSV");
  assert.equal(readRetailSpreadsheet({ format: "CSV", content: csv.toString("utf8"), mode: "CREATE" })[0].data.sku, "000042");
  const xlsx = writeRetailSpreadsheet(rows, "XLSX");
  assert.equal(readRetailSpreadsheet({ format: "XLSX", content: xlsx.toString("base64"), mode: "CREATE" })[0].data.sku, "000042");
});

test("rejects XLSX formulas and safely prefixes formula-like CSV exports", () => {
  const sheet = XLSX.utils.aoa_to_sheet([["product_key", "product_name"], ["p1", "Name"]]);
  sheet.B2 = { t: "n", f: "1+1", v: 2 };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Retail");
  const formulaFile = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  assert.throws(() => readRetailSpreadsheet({ format: "XLSX", content: formulaFile.toString("base64"), mode: "CREATE" }), /فرمول/);

  const csv = writeRetailSpreadsheet([{ product_key: "p1", product_name: "=HYPERLINK(\"x\")" }], "CSV").toString("utf8");
  assert.match(csv, /"'=HYPERLINK/);
  assert.equal(readCsv(csv)[0].data.product_name, "=HYPERLINK(\"x\")");
});

test("validates numeric, boolean, and digit cells", () => {
  assert.equal(normalizeDigits("۱۲۳٤٥۶"), "123456");
  assert.equal(boolCell("بله"), true);
  assert.equal(boolCell("۰"), false);
  assert.throws(() => decimalCell("۱,۲۰۰"), /قیمت/);
  assert.throws(() => decimalCell("0"), /قیمت/);
  assert.throws(() => stockCell("-1"), /موجودی/);
  assert.throws(() => stockCell("1.5"), /موجودی/);
  assert.throws(() => boolCell("yes"), /مقدار/);
});

test("rejects unknown and duplicate headers and malformed quoted CSV", () => {
  assert.throws(() => readCsv("product_key,unknown\np1,x"), /ناشناخته/);
  assert.throws(() => readCsv("product_key,product_key\np1,p2"), /تکراری/);
  assert.throws(() => readCsv('product_key,product_name\np1,"not closed'), /بسته نشده/);
  assert.throws(() => readCsv('product_key,product_name\np1,"closed"oops'), /پس از نقل‌قول/);
});

test("accepts 500 CSV/XLSX rows and enforces row and 1 MB file limits", () => {
  const values = Array.from({ length: 500 }, (_, i) => ({ product_key: `p${Math.floor(i/50)}`, sku: `000${i}` }));
  for (const format of ["CSV", "XLSX"] as const) {
    const data = writeRetailSpreadsheet(values, format);
    assert.equal(readRetailSpreadsheet({ format, content: data.toString(format==="CSV"?"utf8":"base64"), mode:"CREATE" }).length,500);
    const extra = writeRetailSpreadsheet([...values,{product_key:"p1",sku:"EXTRA"}],format);
    assert.throws(()=>readRetailSpreadsheet({format,content:extra.toString(format==="CSV"?"utf8":"base64"),mode:"CREATE"}));
  }
  assert.throws(() => readCsv(`product_key,product_name\np1,${"x".repeat(1_000_001)}`), /یک مگابایت/);
});

test("export batches preserve every row, product grouping and per-product write limits", () => {
  const input = Array.from({length:13},(_,i)=>({id:String(i),rows:i===0?240:50}));
  const batches=retailExportBatches(input);
  const seen=new Set<string>();
  for(const batch of batches){
    assert.ok(batch.length<=10);
    assert.ok(batch.reduce((n,p)=>n+p.rows,0)<=500);
    assert.equal(new Set(batch.map(p=>p.id)).size,batch.length);
    for(const p of batch){assert.ok(p.rows<=100);for(let offset=p.offset;offset<p.offset+p.rows;offset++){const key=`${p.id}:${offset}`;assert.ok(!seen.has(key));seen.add(key);}}
  }
  assert.equal(seen.size,840);
});
