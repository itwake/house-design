import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const data=JSON.parse(await readFile(new URL('../knowledge/data/library.json',import.meta.url),'utf8'));
const practical=data.articles.filter(a=>a.mode==='practical');
const browser=await chromium.launch({headless:true});
const errors=[],checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS '+name);};
await mkdir('tmp/knowledge-qa',{recursive:true});
try{
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  await page.addInitScript(()=>{window.testCopied='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.testCopied=value;}}});});
  page.on('pageerror',e=>errors.push(e.message));
  const visit=async route=>{await page.goto('http://127.0.0.1:4173/knowledge.html'+route);await page.locator('#view[aria-busy="false"]').waitFor();};
  const fit=async route=>check(width+' '+route+' viewport fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for(const route of ['#home','#project','#field','#cases','#study','#sources']){await visit(route);await fit(route);check(width+' '+route+' h1',await page.locator('#view h1').count()===1);}
  await visit('#project');check(width+' project has owner facts',(await page.locator('#view').innerText()).includes('10月17日之前')&&(await page.locator('#view').innerText()).includes('4位自如租客'));check(width+' project phases',await page.locator('.project-phases>section').count()===3);
  await page.locator('[data-copy-project]').click();check(width+' project brief copied',await page.evaluate(()=>window.testCopied.includes('倾向')&&window.testCopied.includes('104.83')&&window.testCopied.includes('7字')));
  await page.locator('#toast').waitFor({state:'hidden'});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:'tmp/knowledge-qa/project-'+width+'.png',fullPage:true});
  await visit('#article/practical-budget-half-package-duties');await fit('half-package responsibilities');
  await visit('#field');check(width+' all practical count',await page.locator('#results .article-card').count()===practical.length);
  await page.locator('#category-filter').selectOption('custom');check(width+' practical category filter',await page.locator('#results .article-card').count()===practical.filter(a=>a.category==='custom').length);
  for(const cat of ['company','budget','materials','water-electric','finish','custom']){await visit('#field/'+cat);check(width+' scenario '+cat,await page.locator('#results .article-card').count()>0);}
  await visit('#article/practical-budget-quote-example');await fit('comparison article');check(width+' comparison table rows',await page.locator('.decision-table tbody tr').count()===6);check(width+' provided sources have no fake links',await page.locator('#article-sources a[href="#"]').count()===0);
  check(width+' sources initially collapsed',await page.locator('.article-evidence').getAttribute('open')===null);
  await page.locator('[data-copy-questions]').click();check(width+' copy questions',await page.evaluate(()=>window.testCopied.includes('具体包含'))||await page.evaluate(()=>window.testCopied.includes('这一项包到')));
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));check(width+' print expands sources',await page.locator('.article-evidence').getAttribute('open')!==null);await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));check(width+' print restores sources',await page.locator('.article-evidence').getAttribute('open')===null);
  await page.screenshot({path:'tmp/knowledge-qa/practical-article-'+width+'.png',fullPage:true});
  await visit('#cases');check(width+' four observed cases',await page.locator('.case-note').count()===4);await page.screenshot({path:'tmp/knowledge-qa/practical-cases-'+width+'.png',fullPage:true});
  await visit('#study');for(const el of await page.locator('.study-groups summary').all())await el.click();check(width+' forty file inventory',await page.locator('.study-groups li').count()===40);await fit('expanded file inventory');
  await visit('#home');check(width+' home context cards',await page.locator('.context-cards>div').count()===3);await page.locator('#toast').waitFor({state:'hidden'});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:'tmp/knowledge-qa/practical-home-'+width+'.png',fullPage:true});
  await context.close();
 }
 check('no browser errors',errors.length===0);console.log(JSON.stringify({checks:checks.length,passed:true,errors}));
}finally{await browser.close();}
