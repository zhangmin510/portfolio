// Start the app servers listed in docs/navigation.md before running.
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
console.log('Launching navigation browser');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 console.log('Browser ready');
 const context=await browser.newContext();
 await context.route('https://zhangmin.name/**',async route=>{const u=new URL(route.request().url());const response=await context.request.get('http://127.0.0.1:8090'+u.pathname+(u.pathname.endsWith('/')?'index.html':'')+u.search);await route.fulfill({response});});
 await context.route(/https:\/\/(?!zhangmin\.name\/)/,route=>route.abort());
 const page=await context.newPage();
 page.setDefaultTimeout(12000);
 console.log('Loading directory');
 await page.goto('https://zhangmin.name/panoramas/',{waitUntil:'domcontentloaded'});
 console.log('Directory loaded');
 await page.locator('.filter[data-category="评测与可靠性"]').click();console.log('Category selected');
 await page.locator('#search').fill('评测');
 await page.waitForURL(u=>u.searchParams.get('q')==='评测');
 const directory=page.url();assert(directory.includes('category='));assert(directory.includes('q='));
 await page.locator('.card:visible').first().click();console.log('Detail opened');
 await page.locator('[data-panorama-return]').click();
 await page.waitForURL(u=>u.pathname==='/panoramas/');
 assert.equal(new URL(page.url()).searchParams.get('q'),new URL(directory).searchParams.get('q'));
 await page.waitForFunction(()=>Math.abs(scrollY-JSON.parse(sessionStorage.getItem('portfolio:panorama-directory:v1')).y)<3);
 assert.equal(await page.locator('#search').inputValue(),'评测');
 assert.equal(await page.locator('.filter[aria-pressed=true]').getAttribute('data-category'),'评测与可靠性');
 console.log('PASS directory → detail → directory restores URL, search, category and scroll');
 for(const path of ['/panoramas/','/keyword-film/']){await page.goto('https://zhangmin.name'+path);await page.locator('.portfolio-navigation summary').click();await page.locator('.portfolio-navigation details a').first().waitFor();}
 for(const file of ['search-technology','search-evaluation','eval-quest']){
  await page.goto('https://zhangmin.name/panoramas/'+file+'/');
  for(const width of [390,1366]){
   await page.setViewportSize({width,height:850});
   const nav=page.locator('.portfolio-navigation').first();
   await nav.getByRole('link',{name:'← 个人主页',exact:true}).waitFor();
   await nav.locator('summary').click();
   const b=await nav.locator('details>div').boundingBox();assert(b.x>=0&&b.x+b.width<=width+1,file+' menu clipped');
   await nav.locator('summary').click();
  }
 }
 console.log('PASS iframe wrappers and quest: visible navigation, responsive menus');
 for(const [name,port] of [['evaltube',4317],['evalpapers',4322],['timecapsule',4323],['autoeval',4324],['policy-radar',8091],['weight-space',8092]]){
  for(const width of [390,1366]){
   await page.setViewportSize({width,height:850});
   await page.goto('http://127.0.0.1:'+port+'/');
   const nav=page.locator('.portfolio-navigation').first();
   const home=nav.getByRole('link',{name:'← 个人主页',exact:true});await home.waitFor();
   assert.equal(await home.getAttribute('href'),'https://zhangmin.name/');
   const b=await home.boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.y>=0,name+' home offscreen');
   assert(await home.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),name+' home covered');
   await nav.locator('summary').click();
   const box=await nav.locator('details>div').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,name+' menu clipped');
   assert(await nav.locator('details a').first().evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),name+' menu is clipped or covered');
   await page.screenshot({path:'/tmp/nav-'+name+'-'+width+'.png'});
  }
  console.log('PASS '+name+' desktop/mobile home and works menu');
 }
 await page.setViewportSize({width:390,height:850});
 await page.goto('http://127.0.0.1:5178/');
 await page.locator('.creation-portfolio-nav a[href="https://zhangmin.name/"]').waitFor();
 await page.locator('.creation-portfolio-nav summary').click();
 const menu=await page.locator('.creation-portfolio-nav details>div').boundingBox();assert(menu.x>=0&&menu.x+menu.width<=390);
 await page.locator('.creation-portfolio-nav summary').click();
 await page.getByRole('button',{name:'搬进栈城，开始第一天'}).click();
 await page.locator('.game-home-link').waitFor();
 assert(await page.locator('.game-home-link').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
 console.log('PASS game entry, works menu and gameplay home navigation');
 await page.screenshot({path:'/tmp/nav-game-390.png'});
 for(const width of [390,1366]){await page.setViewportSize({width,height:850});for(const route of ['/','/papers','/more']){await page.goto('http://localhost:3000'+route);const nav=page.locator('.portfolio-navigation');await nav.getByRole('link',{name:'← 个人主页',exact:true}).waitFor();await nav.locator('summary').click();const b=await nav.locator('details>div').boundingBox();assert(b.x>=0&&b.x+b.width<=width+1);}}
 console.log('PASS Eval Frontier main, papers and more navigation at mobile/desktop widths');
 await browser.close();
}catch(e){await browser.close();throw e;}
