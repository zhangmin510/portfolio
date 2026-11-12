import { readFileSync } from 'node:fs'
export const sites = JSON.parse(readFileSync(new URL('../../src/data/sites.json', import.meta.url), 'utf8'))
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const css = `
.portfolio-navigation{box-sizing:border-box;padding:0;border:0;overflow:visible;background:transparent;display:flex;align-items:center;gap:12px;flex-shrink:0;font:12px/1.5 system-ui,sans-serif;color:inherit;isolation:isolate}
.portfolio-navigation a,.portfolio-navigation summary{box-sizing:border-box;color:inherit;text-decoration:none;font:inherit;cursor:pointer;letter-spacing:normal}
.portfolio-navigation>a{display:inline-flex;align-items:center;min-height:40px;white-space:nowrap;padding:0 5px}
.portfolio-navigation a:hover{text-decoration:underline;text-underline-offset:4px}
.portfolio-navigation :focus-visible{outline:2px solid #41836a;outline-offset:3px}
.portfolio-navigation details{position:relative;margin:0;padding:0;border:0;background:none}
.portfolio-navigation summary{display:list-item;min-height:40px;align-content:center;white-space:nowrap;padding:0 5px}
.portfolio-navigation details>div{position:absolute;right:0;top:100%;width:min(300px,calc(100vw - 24px));max-height:65dvh;overflow:auto;padding:14px;background:#fff;color:#34483f;border:1px solid #cad7ce;border-radius:12px;box-shadow:0 12px 36px #172d2626;z-index:10000;text-align:left}
.portfolio-navigation details a{display:block;padding:9px 10px;min-height:38px;border-radius:5px;white-space:normal}
.portfolio-navigation details strong{display:block;padding:7px 10px;font-size:11px;color:#65796e}
.portfolio-navigation[data-placement="page"]{position:sticky;top:0;z-index:10000;justify-content:flex-end;min-height:44px;padding:0 18px;background:#f8fbf8;color:#34483f;border-bottom:1px solid #cad7ce}
.portfolio-navigation .portfolio-title{margin-right:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:45%;font-weight:600}
@media(max-width:650px){.portfolio-navigation{gap:5px;font-size:11px}.portfolio-navigation[data-placement="page"]{padding:0 10px}.portfolio-navigation .portfolio-title{display:none}.portfolio-navigation[data-placement="page"]>a:first-of-type{margin-right:auto}}
@media print{.portfolio-navigation{display:none}}
`
export function stripNavigation(html) {
 return html.replace(/<!-- portfolio-nav:start -->[\s\S]*?<!-- portfolio-nav:end -->/g, '')
}
export function navigation({slug, title, panorama=false, placement='header', related=[]}) {
 const link = s => `<a href="${escapeHtml(s.href)}">${escapeHtml(s.name || s.title)}</a>`
 const others = sites.filter(s => s.slug !== slug && (!panorama || s.slug !== 'panoramas'))
 const selected = sites.find(s => s.slug === slug)?.related || ['evalfrontier','evaltube','evalpapers'];
 const recommended = related.length ? related : selected.map(id=>others.find(s=>s.slug===id)).filter(Boolean)
 return `<nav class="portfolio-navigation" data-placement="${placement}" aria-label="个人网站导航">${title ? `<span class="portfolio-title">${escapeHtml(title)}</span>` : ''}<a href="https://zhangmin.name/">← 个人主页</a>${panorama ? '<a href="https://zhangmin.name/panoramas/" data-panorama-return>全部知识地图</a>' : ''}<details><summary>更多作品</summary><div>${recommended.length ? '<strong>继续探索</strong>'+recommended.map(link).join('') : ''}<strong>其他网站</strong>${others.filter(s=>!recommended.some(r=>r.href===s.href)).map(link).join('')}</div></details></nav>`
}
export function decoratePanorama(html, page, pages) {
 html=stripNavigation(html)
 const related=pages.filter(p=>p.slug!==page.slug && p.category===page.category).slice(0,3).map(p=>({...p,href:`https://zhangmin.name/panoramas/${p.slug}/`}))
 const offsets = `
body:has(>.portfolio-navigation[data-placement="page"]) .viz-menu{top:60px}
body:has(>.portfolio-navigation[data-placement="page"])>.sidebar,body:has(>.portfolio-navigation[data-placement="page"])>.rail{top:44px}
body:has(>.portfolio-navigation[data-placement="page"]) .topbar,body:has(>.portfolio-navigation[data-placement="page"]) .site-header,body:has(>.portfolio-navigation[data-placement="page"]) .view-tabs{top:44px}
`
 const block=`<!-- portfolio-nav:start --><style>${css}${offsets}</style><!-- portfolio-nav:end -->`
 html=html.replace(/<\/head>/i,block+'</head>')
 return html.replace(/(<body\b[^>]*>)/i, '$1'+`<!-- portfolio-nav:start -->${navigation({slug:page.slug,title:page.title,panorama:true,placement:'page',related})}<!-- portfolio-nav:end -->`)
}
