import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const data=JSON.parse(await readFile(new URL('../knowledge/data/library.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS '+name);};
await mkdir('tmp/knowledge-qa',{recursive:true});
try{
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const visit=async path=>{await page.goto('http://127.0.0.1:4173/knowledge.html'+path);await page.locator('#view[aria-busy="false"]').waitFor();};
  const fits=async()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
  await visit('#home');check(width+' personal hero and CTA',await page.locator('.hero a[href="#house"]').count()===1);check(width+' four specific priorities',await page.locator('.house-priorities>div').count()===4);check(width+' home fits',await fits());
  await page.screenshot({path:'tmp/knowledge-qa/house-home-'+width+'.png',fullPage:true});
  await page.locator('.hero a[href="#house"]').click();await page.locator('.house-track').first().waitFor();check(width+' one heading',await page.locator('#view h1').count()===1);check(width+' nine reading cards',await page.locator('.house-track .article-card').count()===9);check(width+' house fits',await fits());
  for(const card of await page.locator('.house-track .card-meta').all())check(width+' own badge', (await card.innerText()).includes('荟雅苑专用'));
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:'tmp/knowledge-qa/house-guide-'+width+'.png',fullPage:true});
  await page.locator('.house-track-nav a[href="#house/design"]').click();await page.waitForFunction(()=>document.activeElement?.id==='house-track-design');check(width+' stage navigation focuses requested section',await page.locator('#house-track-design').evaluate(el=>el.getBoundingClientRect().top<200));
  await visit('#house/handover');await page.waitForFunction(()=>document.activeElement?.id==='house-track-handover');check(width+' deep link stage',await page.locator('#house-track-handover').evaluate(el=>el.getBoundingClientRect().top<200));
  await visit('#article/house-demolition-scope');check(width+' personal breadcrumb',await page.locator('.breadcrumb a[href="#house"]').count()===1);check(width+' two demolition tables',await page.locator('.reader-body .decision-table').count()===2);check(width+' related stays in house guide',(await page.locator('.related a[href^="#article/"]').evaluateAll(els=>els.map(el=>el.getAttribute('href')))).every(url=>url.startsWith('#article/house-')));
  await page.locator('[data-check]').first().check();await page.reload();await page.locator('[data-check]').first().waitFor();check(width+' personal checklist persists',await page.locator('[data-check]').first().isChecked());check(width+' article fits',await fits());
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:'tmp/knowledge-qa/house-demolition-'+width+'.png'});
  await context.close();
 }
 check('no browser errors',errors.length===0);console.log(JSON.stringify({passed:true,checks:checks.length,errors}));
}finally{await browser.close();}
