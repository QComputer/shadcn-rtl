import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
test("booking opt-in shows and exports a one-time credential without browser storage", { timeout: 60000 }, async () => {
  const net = createServer(); await new Promise(resolve => net.listen(0,"127.0.0.1",resolve)); const port = net.address().port; await new Promise(resolve => net.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath,[join(root,"server.mjs")],{cwd:root,env:{...process.env,PORT:String(port)},stdio:"ignore",windowsHide:true});
  let browser;
  try {
    for(let i=0;i<80;i++){ try {if((await fetch(`${base}/healthz`)).ok) break;} catch {} await new Promise(resolve=>setTimeout(resolve,100)); if(i===79) throw Error("fixture server unavailable"); }
    browser=await chromium.launch({headless:true,...(process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{})});
    const context=await browser.newContext({acceptDownloads:true}); const page=await context.newPage();
    // Override only the activation module in this synthetic browser fixture; checked-in production gate stays off.
    await page.route("**/booking-activation.js",async route=>{const response=await route.fetch();const text=await response.text();await route.fulfill({response,body:text.replace('enabled: false,','enabled: true,').replace('ownerApproval: null,','ownerApproval: { approvedBy: "property_owner", reference: "DAMOON-BOOKING-TEST123", approvedAt: "2026-01-01T00:00:00.000Z" },')});});
    await page.route("**/fixture-recovery*",route=>route.fulfill({status:200,contentType:"text/html",body:'<!doctype html><html><body><div id="slot"></div><script type="module">import { mountBooking } from "/booking.js"; mountBooking(document.querySelector("#slot"), { locale:"en", coordinationOnly:false, requestOnly:false });</script></body></html>'}));
    await page.route("**/api/auth/customer/config",route=>route.fulfill({json:{hotelGuestRecoveryIssuance:true}}));
    await page.route("**/api/hotel/v1/availability/search",route=>route.fulfill({json:{options:[{isAvailable:true,roomType:{slug:"room",name:"Room"},ratePlan:{code:"flex",name:"Flexible",currency:"TOMAN",cancellationPolicy:{key:"flex",version:1}},nights:["a","b"],totalRate:"200"}]}}));
    await page.route("**/api/hotel/v1/holds",route=>route.fulfill({status:201,json:{holdId:"hold",reference:"ref",expiresAt:new Date(Date.now()+60000).toISOString()}}));
    const credential="A".repeat(43); let optIn;
    await page.route("**/api/hotel/v1/reservations",route=>{optIn=route.request().postDataJSON().recoveryOptIn;return route.fulfill({status:201,headers:{"cache-control":"private, no-store"},json:{reference:"ref",status:"PENDING_PAYMENT",paymentStatus:"UNPAID",totalAmount:"200",currency:"TOMAN",recoveryCredential:credential}});});
    const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
    await page.goto(`${base}/fixture-recovery?checkIn=${day(10)}&checkOut=${day(12)}&adults=2&children=0`);
    await page.locator('.booking-form .booking-submit[type="submit"]').click(); await page.locator('[data-select-option]').first().click();
    await page.locator('[data-guest-name]').fill('Synthetic Guest'); await page.locator('[data-guest-phone]').fill('09123456789');
    await page.locator('[data-policy-accept]').check(); await page.locator('[data-recovery-opt-in]').check(); await page.locator('[data-create-hold]').click();
    await page.locator('[data-recovery-credential]').waitFor(); assert.equal(optIn,true); assert.equal(await page.locator('[data-recovery-credential]').innerText(),credential);
    const downloaded=page.waitForEvent('download'); await page.locator('[data-export-recovery]').click(); const download=await downloaded; assert.equal(download.suggestedFilename(),'reservation-recovery.txt');
    let contents=''; for await (const chunk of await download.createReadStream()) contents+=chunk.toString(); assert.equal(contents,credential);
    const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}})); assert.equal(storage.includes(credential),false);
    await page.reload(); assert.equal(await page.locator('[data-recovery-credential]').count(),0);
  } finally { await browser?.close(); child.kill(); }
});
