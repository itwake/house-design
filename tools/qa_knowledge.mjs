// Isolated headless browser against this project's local server only.
// PLAYWRIGHT_PACKAGE may point to a separately installed Playwright index.mjs.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const base='http://127.0.0.1:4173/knowledge.html';
const d=JSON.parse(await readFile(new URL('../knowledge/data/library.json',import.meta.url),'utf8'));
await mkdir(new URL('../tmp/knowledge-qa/',import.meta.url),{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS '+name);};
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740}]){
  const context=await browser.newContext({viewport,locale:'zh-CN',acceptDownloads:true}),page=await context.newPage();
  page.on('pageerror',err=>errors.push(err.message));page.on('dialog',dialog=>dialog.accept());
  const visit=async hash=>{await page.goto(base+hash);await page.locator('#view[aria-busy="false"]').waitFor();};
  const fit=async name=>check(viewport.width+' '+name+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await visit('#home');check('homepage data '+viewport.width,await page.locator('.stat-row').innerText().then(t=>t.includes(String(d.articles.length))));await fit('home');
  await page.screenshot({path:'tmp/knowledge-qa/home-'+viewport.width+'.png',fullPage:viewport.width===1440});
  if(viewport.width<740){await page.locator('#menu-toggle').click();check('mobile navigation expands '+viewport.width,await page.locator('#sidebar-nav').isVisible());await page.locator('#menu-toggle').click();}
  await page.locator('#kb-search').fill('甲醛');await page.locator('#search-form button').click();await page.locator('#results').waitFor();check('search matches '+viewport.width,await page.locator('#results .article-card').count()>1);await fit('search');
  await visit('#article/start-first-week');await page.locator('[data-read]').click();await page.locator('.reader-actions [data-save]').click();await page.locator('[data-check]').first().check();await page.locator('[data-note]').fill('<私人测试> 不上传');await page.waitForTimeout(500);await page.reload();await page.locator('[data-note]').waitFor();check('private notes persist '+viewport.width,await page.locator('[data-note]').inputValue()==='<私人测试> 不上传');check('read and checked persist '+viewport.width,await page.locator('[data-read]').getAttribute('aria-pressed')==='true'&&await page.locator('[data-check]').first().isChecked());await fit('article');await page.screenshot({path:'tmp/knowledge-qa/article-'+viewport.width+'.png'});
  await visit('#tools/budget');await page.locator('[data-budget="total"]').fill('100000');await page.locator('[data-cost="base"]').fill('90000');check('budget deficit '+viewport.width,(await page.locator('#budget-status').innerText()).includes('超出'));await fit('budget');const csvDownload=page.waitForEvent('download');await page.locator('[data-action="export-budget"]').click();const csvFile=await csvDownload;check('budget CSV download '+viewport.width,(await readFile(await csvFile.path(),'utf8')).includes('空白按0暂计'));
  await visit('#tools/compare');for(const gate of ['entity','scope','safety'])await page.locator(`[data-gate="0:${gate}"]`).check();check('unrated score withheld '+viewport.width,(await page.locator('#company-score-0').innerText()).includes('尚未齐全'));for(const id of ['identity','site','drawings','scope','team','service']){await page.locator(`[data-rating="0:${id}"]`).selectOption('5');await page.locator(`[data-evidence="0:${id}"]`).fill('仅本次自动化测试证据');}check('evidence-gated score '+viewport.width,(await page.locator('#company-score-0').innerText()).includes('100 / 100'));await fit('comparison');await page.screenshot({path:'tmp/knowledge-qa/compare-'+viewport.width+'.png'});
  await visit('#directory');await page.locator('#directory-filter').selectOption('market');check('market filtering '+viewport.width,await page.locator('[data-directory-type]:visible').count()===6);await fit('directory');
  await visit('#tools/backup');const jsonDownload=page.waitForEvent('download');await page.locator('[data-action="export-state"]').click();const backup=await jsonDownload;const buffer=await readFile(await backup.path());check('JSON backup valid '+viewport.width,JSON.parse(buffer).version===1);await page.locator('[data-action="reset-state"]').click();await page.locator('#import-state').setInputFiles({name:'backup.json',mimeType:'application/json',buffer});await page.waitForTimeout(200);await visit('#saved');check('restored favorite '+viewport.width,await page.locator('.stat-row strong').first().innerText()==='1');
  await visit('#tools/templates');check('all templates '+viewport.width,await page.locator('[data-template]').count()===10);await fit('templates');
  await context.close();
 }
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',err=>errors.push(err.message));await page.goto(base+'#home');await page.locator('#view[aria-busy="false"]').waitFor();
 for(const a of d.articles){await page.evaluate(id=>location.hash='#article/'+id,a.id);await page.locator('.reader-head h1').filter({hasText:a.title}).waitFor();check('article renders '+a.id,await page.locator('.checklist input').count()===a.checklist.length);}
 await page.goto('http://127.0.0.1:4173/knowledge/guide.html');check('static full guide',await page.locator('article').count()===d.articles.length+d.directory.length);
 await context.close();check('no uncaught browser errors',errors.length===0);
 console.log(JSON.stringify({passed:true,checks:checks.length,viewports:[1440,390,320],articles:d.articles.length,errors},null,2));
}finally{await browser.close();}
