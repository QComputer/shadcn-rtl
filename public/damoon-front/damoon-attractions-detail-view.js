/* Render a single curated tourism page. Host app supplies header, footer and localized routing. */
import { damoonAttractionsData as dataset } from './damoon-attractions-data.js';
import { renderDamoonMap, attractionMapUrl } from './damoon-leaflet-maps.js';
const esc=(s)=>String(s??'').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const fmt=(n,lang)=>new Intl.NumberFormat(lang==='fa'?'fa-IR':lang==='ar'?'ar':'en-US',{maximumFractionDigits:1}).format(n);
const loc=(locale)=>['fa','en','ar'].includes(locale)?locale:'fa';
const dirTo=(a)=>`https://www.google.com/maps/dir/?api=1&destination=${a.geo.lat}%2C${a.geo.lng}&travelmode=driving`;
const pathTo=(locale,slug)=>`/${locale}/attractions/${slug}`;
const backTo=(locale)=>`/${locale}/attractions`;
const labels={
 fa:{back:'بازگشت به جاهای دیدنی',distance:'فاصله مستقیم تقریبی از نقطه عمومی نقشه؛ پین هتل تأیید نشده',noRoad:'مسافت جاده‌ای هنوز تأیید نشده است',plan:'نکات بازدید',highlights:'چرا دیدنی است؟',directions:'مسیریابی',sources:'منابع و بررسی بیشتر',local:'موقعیت',related:'دیدنی‌های دیگر',advisory:'وضعیت بازدید',note:'پین هتل و نقاط دیدنی از نقشه‌های عمومی‌اند و به تأیید محلی نیاز دارند. فاصله مستقیم، مسافت جاده نیست. پیش از حرکت مسیر، وضعیت هوا و شرایط بازدید را بررسی کنید.',map:'نمایش مقصد روی نقشه',reported:'زمان گزارش‌شده در سایت‌های گردشگری، غیرزنده', min:'دقیقه',walk:'پیاده',drive:'با خودرو'},
 en:{back:'Back to attractions',distance:'Approx. straight-line from public hotel map point; pin unconfirmed',noRoad:'Road distance has not been verified',plan:'Before your visit',highlights:'Highlights',directions:'Directions',sources:'Sources and further reading',local:'Location',related:'Explore more',advisory:'Visit status',note:'Hotel and attraction points come from public maps and need local confirmation. The straight-line figure is not a road distance. Check directions, weather and current access before travelling.',map:'View destination map',reported:'Third-party reported time; not live',min:'min',walk:'Walk',drive:'Drive'},
 ar:{back:'العودة إلى المعالم',distance:'مسافة مباشرة تقريبية من نقطة الفندق العامة؛ الموقع غير مؤكد',noRoad:'لم تُتحقق مسافة الطريق بعد',plan:'قبل الزيارة',highlights:'أبرز ما يميّز الموقع',directions:'الاتجاهات',sources:'المصادر والمزيد',local:'الموقع',related:'معالم أخرى',advisory:'حالة الزيارة',note:'موقع الفندق والمعالم من خرائط عامة ويحتاج إلى تأكيد محلي. المسافة المباشرة ليست مسافة الطريق. تحقّق من الاتجاهات والطقس وإمكانية الزيارة قبل السفر.',map:'عرض الموقع على الخريطة',reported:'وقت تقريبي منشور لدى جهات أخرى، وليس لحظياً',min:'دقيقة',walk:'مشي',drive:'سيارة'}
};
export function getDamoonAttraction(id){return dataset.attractions.find(p=>p.id===id)||null;}
export function renderDamoonAttractionDetailPage(locale='fa',slug=''){
 locale=loc(locale);const p=getDamoonAttraction(slug);if(!p)return null;
 const t=labels[locale],n=p.content[locale],d=p.distanceFromHotel,detail=p.detail[locale];
 const km=`${fmt(d.straightLineKm,locale)} ${locale==='en'?'km':locale==='fa'?'کیلومتر':'كم'}`;
 const reported=(d.walkMinutesReported==null&&d.driveMinutesReported==null)?'':`<p class="da-detail-time">${esc(t.reported)}: ${d.walkMinutesReported==null?'':`${esc(t.walk)} ${fmt(d.walkMinutesReported,locale)} ${esc(t.min)}`} ${d.driveMinutesReported==null?'':`${esc(t.drive)} ${fmt(d.driveMinutesReported,locale)} ${esc(t.min)}`}</p>`;
 const localMap=attractionMapUrl(p);
 const other=dataset.attractions.filter(x=>x.id!==p.id&&x.zone===p.zone).slice(0,3);
 const rec=other.map(x=>`<a class="da-detail-related-card" href="${pathTo(locale,x.id)}"><span aria-hidden="true">${esc(x.icon)}</span><span>${esc(x.content[locale].name)}</span><small>${fmt(x.distanceFromHotel.straightLineKm,locale)} km · ${esc(dataset.labels[locale].direct)}</small></a>`).join('');
 return `<article class="damoon-attractions da-detail" dir="${locale==='en'?'ltr':'rtl'}" lang="${locale}">
 <div class="da-detail-hero"><div class="da-detail-hero-inner"><a class="da-detail-back" href="${backTo(locale)}">← ${esc(t.back)}</a><div class="da-detail-cover" aria-hidden="true"><span>${esc(p.icon)}</span></div><p class="da-eyebrow">${esc(p.category==='heritage'?dataset.labels[locale].heritage:dataset.labels[locale].nature)}</p><h1>${esc(n.name)}</h1><p class="da-detail-lead">${esc(n.summary)}</p></div></div>
 <div class="da-container da-detail-content"><div class="da-detail-columns"><div class="da-detail-main">
 ${detail.paragraphs.map(x=>`<p>${esc(x)}</p>`).join('')}
 <section><h2>${esc(t.highlights)}</h2><ul>${detail.highlights.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>
 <section><h2>${esc(t.plan)}</h2><p>${esc(n.tip)}</p>${p.visitorAdvisory?`<div class="da-detail-alert" role="note"><strong>${esc(t.advisory)}</strong><p>${esc(p.visitorAdvisory[locale])}</p></div>`:''}</section>
 <section><h2>${esc(t.sources)}</h2><ol class="da-detail-sources">${p.sourceUrls.map((s,i)=>`<li><a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${locale==='en'?'Source':locale==='ar'?'المصدر':'منبع'} ${fmt(i+1,locale)} ↗</a></li>`).join('')}</ol></section></div>
 <aside class="da-detail-aside"><div class="da-detail-info"><h2>${esc(t.local)}</h2><p>${esc(n.address)}</p><div class="da-detail-metric"><strong>${km}</strong><small>${esc(t.distance)}</small></div><p class="da-detail-muted">${esc(t.noRoad)}</p>${reported}<a class="da-button da-button-primary" href="${dirTo(p)}" target="_blank" rel="noopener noreferrer">${esc(t.directions)} ↗</a><a class="da-detail-osm" href="${esc(localMap)}" target="_blank" rel="noopener noreferrer">${esc(t.map)} ↗</a>${renderDamoonMap({ kind: "attraction", locale, slug })}</div></aside></div>
 <p class="da-detail-notice">${esc(t.note)}</p><section class="da-detail-related"><h2>${esc(t.related)}</h2><div class="da-detail-related-grid">${rec}</div></section></div></article>`;
}
