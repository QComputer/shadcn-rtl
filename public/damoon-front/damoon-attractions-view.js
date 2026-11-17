/* Hotel Damoon attractions public page — isolated, dependency-free, HTML-only rendering.
   Existing Damoon app must provide the shared header/footer and route integration. */
import { damoonAttractionsData as dataset } from './damoon-attractions-data.js';

const e = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (locale) => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale === 'ar' ? 'ar' : 'en-US', { maximumFractionDigits: 1 });
const urlGoogle = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.geo.lat}%2C${p.geo.lng}&travelmode=driving`;
const urlWaze = (p) => `https://www.waze.com/ul?ll=${p.geo.lat}%2C${p.geo.lng}&navigate=yes`;

export function renderDamoonAttractionsPage(locale='fa') {
  if (!dataset.labels[locale]) locale='fa';
  const t=dataset.labels[locale], n=nf(locale), lang=locale;
  const categoryName=(category)=>category==='heritage'?t.heritage:t.nature;
  const card=(p)=>{
    const c=p.content[locale]; const d=p.distanceFromHotel;
    let reported='';
    if (d.walkMinutesReported != null) reported=`<span class="da-stat">${e(t.walk)}: ${n.format(d.walkMinutesReported)} ${lang==='fa'?'دقیقه':lang==='ar'?'دقيقة':'min'}</span>`;
    if (d.driveMinutesReported != null) reported+=`<span class="da-stat">${e(t.drive)}: ${n.format(d.driveMinutesReported)} ${lang==='fa'?'دقیقه':lang==='ar'?'دقيقة':'min'}</span>`;
    return `<article class="da-card" data-da-category="${e(p.category)}" data-da-zone="${e(p.zone)}">
      <div class="da-card-cover" aria-hidden="true"><span>${e(p.icon)}</span><span class="da-card-cover-badge">${e(categoryName(p.category))}</span></div>
      <div class="da-card-body"><span class="da-zone">${e(p.zone==='city'?t.city:t.nearby)}</span>
      <h3>${e(c.name)}</h3><p class="da-summary">${e(c.summary)}</p>
      <div class="da-metrics"><strong>${n.format(d.straightLineKm)} ${lang==='fa'?'کیلومتر':lang==='ar'?'كم':'km'}</strong><small>${e(t.direct)}</small>${reported}</div>
      <p class="da-tip"><strong>ⓘ</strong> ${e(c.tip)}</p>
      <div class="da-card-actions"><a class="da-mini-link" href="/${locale}/attractions/${e(p.id)}">${e(t.readMore)} →</a><a class="da-button da-button-primary" href="${urlGoogle(p)}" target="_blank" rel="noopener noreferrer">${e(t.directions)} ↗</a><a class="da-mini-link" href="${urlWaze(p)}" target="_blank" rel="noopener noreferrer">Waze ↗</a></div>
      <details class="da-details"><summary>${e(t.details)}</summary><p>${e(c.address)}</p><div class="da-source-list">${p.sourceUrls.map((s,i)=>`<a target="_blank" rel="noopener noreferrer" href="${e(s)}">${lang==='fa'?'منبع':lang==='ar'?'المصدر':'Source'} ${n.format(i+1)}</a>`).join('')}</div></details>
      </div></article>`;
  };
  const itin=(p)=>`<div class="da-itinerary"><div class="da-itinerary-number" aria-hidden="true">✦</div><h3>${e(p.titles[locale])}</h3><p>${e(p.description[locale])}</p><div class="da-itinerary-tags">${p.items.map(id=>{const found=dataset.attractions.find(x=>x.id===id);return found?`<span>${e(found.content[locale].name)}</span>`:''}).join('')}</div></div>`;
  return `<section class="damoon-attractions" dir="${locale==='en'?'ltr':'rtl'}" lang="${e(lang)}">
    <div class="da-hero"><div class="da-hero-content"><p class="da-eyebrow">${e(t.eyebrow)}</p><h1>${e(t.headline)}</h1><p>${e(t.lead)}</p><div class="da-hero-actions"><a href="#da-list" class="da-button da-button-primary">${e(t.all)} ↓</a><a href="#da-map" class="da-button da-button-secondary">${e(t.map)} ↗</a></div></div><div class="da-hero-art" aria-hidden="true"><span>⌁</span><strong>SH<span>AHRE</span>KORD</strong><em>Shahrekord · Damoon</em></div></div>
    <div class="da-container"><section class="da-opening"><div><span class="da-kicker">${e(t.inTown)}</span><p>${e(t.introCity)}</p></div><div><span class="da-kicker">${e(t.halfDay)}</span><p>${e(t.introNature)}</p></div></section>
    <section id="da-list" aria-labelledby="da-list-title" class="da-list-section"><div class="da-section-heading"><div><p class="da-eyebrow">${e(t.navAttractions)}</p><h2 id="da-list-title">${e(t.all)} · ${n.format(dataset.attractions.length)}</h2></div><div class="da-filters" role="group" aria-label="${e(t.navAttractions)}"><button type="button" data-da-filter="all" aria-pressed="true">${e(t.all)}</button><button type="button" data-da-filter="heritage" aria-pressed="false">${e(t.heritage)}</button><button type="button" data-da-filter="nature" aria-pressed="false">${e(t.nature)}</button></div></div>
      <div class="da-grid" data-da-cards>${dataset.attractions.map(card).join('')}</div><p class="da-empty" data-da-empty hidden>${e(t.empty)}</p></section>
    <section class="da-itineraries" aria-labelledby="da-plan-title"><div class="da-section-heading"><h2 id="da-plan-title">${e(t.halfDay)} / ${e(t.inTown)}</h2></div><div class="da-itinerary-grid">${dataset.itineraries.map(itin).join('')}</div></section>
    <section class="da-map-section" id="da-map" aria-labelledby="da-map-title"><div class="da-map-info"><p class="da-eyebrow">${e(t.map)}</p><h2 id="da-map-title">${e(dataset.hotel.name)}</h2><p>${e(dataset.hotel.address[locale])}</p><p class="da-pin-pending" role="note">${e(t.pinPending)}</p><div class="da-card-actions"><a class="da-button da-button-primary" href="${e(dataset.hotel.existingDirectionsUrl)}" target="_blank" rel="noopener noreferrer">Waze ↗</a><a class="da-button da-button-secondary" href="https://www.openstreetmap.org/?mlat=${dataset.hotel.geo.lat}&mlon=${dataset.hotel.geo.lng}#map=15/${dataset.hotel.geo.lat}/${dataset.hotel.geo.lng}" target="_blank" rel="noopener noreferrer">OpenStreetMap ↗</a></div><p class="da-disclaimer">${e(t.mapnote)}</p></div><div class="da-map-panel" aria-label="${e(t.pinPending)}"><span aria-hidden="true">⌖</span><p>${e(t.map)}</p><small>${e(t.pinPending)}</small></div></section>
    <p class="da-publishing-note">${e(t.disclaimer)}</p></div>
    </section>`;
}

export function mountDamoonAttractionsPage(root) {
 if (!root) return;
 root.querySelectorAll('[data-da-filter]').forEach(btn=>btn.addEventListener('click',()=>{
   const which=btn.getAttribute('data-da-filter');
   root.querySelectorAll('[data-da-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
   let count=0;
   root.querySelectorAll('[data-da-category]').forEach(el=>{const show=which==='all'||el.getAttribute('data-da-category')===which;el.hidden=!show;if(show)count++;});
   const empty=root.querySelector('[data-da-empty]');if(empty)empty.hidden=count>0;
 }));
}
