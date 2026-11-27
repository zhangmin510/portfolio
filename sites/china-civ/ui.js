const paths = {
  people:'<circle cx="9" cy="7" r="3"/><path d="M2 20v-2a7 7 0 0 1 14 0v2zM16 4a3 3 0 0 1 0 6m2 3a6 6 0 0 1 4 6"/>',
  coins:'<ellipse cx="9" cy="7" rx="7" ry="3"/><path d="M2 7v4c0 4 14 4 14 0V7M2 11v4c0 3 7 4 11 3m4-8c7 1 7 6 0 7m-4-1v4c3 2 9 1 9-2v-4"/>',
  grain:'<path d="M5 21 18 5M10 15c-4 0-5-3-5-7 4 1 6 3 5 7Zm3-4c-2-2-2-5-1-8 4 3 4 5 1 8Zm1 3c3-4 5-5 9-4-2 4-5 6-9 4Zm-4 4c3-3 6-4 10-3-2 4-6 5-10 3Z"/>',
  mountain:'<path d="m2 20 8-15 5 9 3-5 5 11H2Zm5-9 3 2 2-3"/>',
  layers:'<path d="m2 8 10-5 10 5-10 5-10-5Zm0 5 10 5 10-5M2 18l10 5 10-5"/>',
  book:'<path d="M12 6v15C10 17 5 17 2 18V4c4-1 7 0 10 2Zm0 0c3-2 6-3 10-2v14c-3-1-8-1-10 3"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="5" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8 10 7-4M8 14l7 4"/>',
  search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
  chart:'<path d="M3 3v18h19M7 17v-4m5 4V8m5 9v-7"/>',
  fit:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"/><circle cx="12" cy="12" r="2"/>',
  map:'<path d="m2 5 7-3 6 3 7-3v17l-7 3-6-3-7 3V5Zm7-3v17m6-14v17"/>',
  wonder:'<path d="m2 9 10-6 10 6H2Zm2 12h16M6 11v7m6-7v7m6-7v7"/>',
  pin:'<path d="M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2"/>'
}
export const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(paths[name] || paths.map)+'</svg>'
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const fmt = value => Number.isFinite(value) ? value.toLocaleString('zh-CN',{maximumFractionDigits:2}) : '—'
export const coord = (x,y) => x.toFixed(2)+'°E · '+y.toFixed(2)+'°N'
export const metricValue=(value,unit)=>Number.isFinite(value)?fmt(value)+' '+esc(unit):'未收录'
export const json=async path=>{const r=await fetch(new URL(path,import.meta.url));if(!r.ok)throw Error('资料未能载入（'+path+'）');return r.json()}
export const link=(url,label)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>'
