import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { sites, decoratePanorama, stripNavigation } from './navigation/render.mjs'
const manifest=JSON.parse(await readFile(new URL('./panoramas.json',import.meta.url)))
describe('portfolio navigation',()=>{
 it('uses unique destinations in the shared inventory',()=>{
  expect(new Set(sites.map(s=>s.slug)).size).toBe(sites.length)
  expect(new Set(sites.map(s=>s.href)).size).toBe(sites.length)
  for(const s of sites){expect(new URL(s.href).protocol).toBe('https:');for(const id of s.related){expect(id).not.toBe(s.slug);expect(sites.some(other=>other.slug===id)).toBe(true)}}
 })
 it('wraps iframe and ordinary documents reversibly and without accumulating navigation',()=>{
  for(const html of ['<!doctype html><html><head></head><body>original</body></html>','<html><head>\n</head><body>\n<iframe sandbox="allow-scripts"></iframe></body></html>']){
   const page=manifest.pages[0],wrapped=decoratePanorama(html,page,manifest.pages)
   expect(stripNavigation(wrapped)).toBe(html)
   expect(decoratePanorama(wrapped,page,manifest.pages)).toBe(wrapped)
   expect(wrapped.indexOf('个人主页')).toBeLessThan(wrapped.indexOf('<iframe')<0?Infinity:wrapped.indexOf('<iframe'))
  }
 })
 it('keeps every published panorama navigable and recommendations distinct from the current page',async()=>{
  for(const p of manifest.pages){
   const html=await readFile(new URL(`../public/panoramas/${p.slug}/index.html`,import.meta.url),'utf8')
   const block=html.match(/<nav class="portfolio-navigation"[\s\S]*?<\/nav>/)?.[0]
   expect(block,p.slug).toContain('href="https://zhangmin.name/"')
   expect(block,p.slug).toContain('data-panorama-return')
   expect(block,p.slug).not.toContain(`href="https://zhangmin.name/panoramas/${p.slug}/"`)
  }
 })
})
