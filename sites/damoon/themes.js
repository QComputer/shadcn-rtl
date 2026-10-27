// Add a palette here, then run build.mjs. Layout and content stay independent.
export const palettes = [
  { id: 'hermes', label: 'کرم و نارنجی', swatch: '#c4501c',
    light: { paper:'#faf6ef', surface:'#fffdf8', 'surface-soft':'#eee7dc', ink:'#302419', muted:'#756b60', line:'#ded4c4', wood:'#5b3d2b', 'wood-deep':'#302117', accent:'#b94715', 'accent-hover':'#97370d', live:'#718461', focus:'#17628b' },
    dark: { paper:'#241b16', surface:'#30241d', 'surface-soft':'#3b2d24', ink:'#f8f0e5', muted:'#cfbfae', line:'#594638', wood:'#493326', 'wood-deep':'#1c140f', accent:'#ed9b64', 'accent-hover':'#ffb37e', live:'#a6ba8e', focus:'#9bd8ff' } },
  { id: 'forest', label: 'سبز روشن و طبیعی', swatch: '#6c8655',
    light: { paper:'#f5f6ee', surface:'#fdfdf7', 'surface-soft':'#e7ebdc', ink:'#283126', muted:'#65705d', line:'#d5dccb', wood:'#48513b', 'wood-deep':'#273123', accent:'#507039', 'accent-hover':'#3e582a', live:'#749b55', focus:'#17628b' },
    dark: { paper:'#1c231b', surface:'#283125', 'surface-soft':'#333d2e', ink:'#f0f3e7', muted:'#bdc9af', line:'#46553d', wood:'#36442e', 'wood-deep':'#151c13', accent:'#b0cf91', 'accent-hover':'#c5e2aa', live:'#9ebd7d', focus:'#9bd8ff' } },
  { id: 'wood', label: 'قهوه‌ای چوبی', swatch: '#865a36',
    light: { paper:'#f6f0e7', surface:'#fffaf2', 'surface-soft':'#eae0d1', ink:'#3a291c', muted:'#7a6857', line:'#dacbb7', wood:'#69472e', 'wood-deep':'#392719', accent:'#8c4926', 'accent-hover':'#71371b', live:'#7e8d62', focus:'#17628b' },
    dark: { paper:'#241810', surface:'#332218', 'surface-soft':'#423022', ink:'#fff0dc', muted:'#d2b99e', line:'#60452f', wood:'#553a25', 'wood-deep':'#1b1009', accent:'#edac79', 'accent-hover':'#ffc394', live:'#b4bd8b', focus:'#9bd8ff' } },
];

export function readPalette(storage) {
  try { const saved=storage?.getItem('damoon-palette'); return palettes.some(p=>p.id===saved) ? saved : palettes[0].id; }
  catch { return palettes[0].id; }
}
export function applyPalette(id, document, storage) {
  const selected = palettes.find(p=>p.id===id) || palettes[0];
  document.documentElement.dataset.palette = selected.id;
  document.querySelectorAll('[data-palette]').forEach(button=>{
    if (button.tagName === 'BUTTON') {
      button.setAttribute('aria-pressed',String(button.dataset.palette===selected.id));
      button.classList.toggle('is-selected',button.dataset.palette===selected.id);
    }
  });
  try { storage?.setItem('damoon-palette',selected.id); } catch { /* Palette still works without storage. */ }
  return selected.id;
}
export function paletteStyles() {
  return palettes.flatMap(p=>['light','dark'].map(mode=>{
    const selector=`:root[data-palette="${p.id}"][data-theme="${mode}"]`;
    return `${selector}{${Object.entries(p[mode]).map(([key,value])=>`--${key}:${value}`).join(';')}}`;
  })).join('\n');
}
