import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {searchArticles,emptyState,sanitizeState,budgetSummary,scoreCompany,SCORE_FIELDS,GATES,csv,escapeHTML,safeURL} from '../knowledge/lib.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const d=JSON.parse(await read('knowledge/data/library.json')),guide=await read('knowledge/guide.html'),js=await read('knowledge/knowledge.js'),shell=await read('knowledge.html');
assert.ok(d.articles.length>=70);assert.equal(d.categories.length,14);assert.equal(d.templates.length,10);assert.equal(d.directory.length,15);
const ids=new Set(d.articles.map(a=>a.id)),sourceIds=new Set(d.sources.map(s=>s.id));assert.equal(ids.size,d.articles.length);assert.equal(sourceIds.size,d.sources.length);
for(const c of d.categories)assert.ok(d.articles.some(a=>a.category===c.id),c.id);
for(const a of d.articles){assert.ok(guide.includes('id="'+a.id+'"'));assert.ok(a.sections.length>=3);assert.ok(a.checklist.length&&a.questions.length&&a.pitfalls.length);for(const id of [...a.sourceIds,...a.sections.flatMap(s=>s.sourceIds||[])])assert.ok(sourceIds.has(id));assert.ok((JSON.stringify(a).match(/[\u4e00-\u9fff]/g)||[]).length>380,a.id+' substantive');}
for(const s of d.sources){assert.equal(s.checked,d.updated);assert.notEqual(safeURL(s.url),'#');if(s.url.startsWith('docs/'))assert.ok((await read(s.url)).length>0);}
for(const t of d.templates){assert.equal(await read('knowledge/templates/'+t.id+'.csv'),csv([t.headers,...t.rows]));for(const row of t.rows)assert.equal(row.length,t.headers.length,t.id+' CSV column count');}
assert.ok(searchArticles(d.articles,'甲醛').length>=2);assert.ok(searchArticles(d.articles,'GB 18580').some(a=>a.id==='material-board-environment'));assert.equal(searchArticles(d.articles,'完全不存在xyz123').length,0);assert.equal(searchArticles(d.articles,'','waterproof').length,d.articles.filter(a=>a.category==='waterproof').length);
assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');for(const url of ['javascript:alert(1)','data:text/html,x','//evil.example','docs/../../secret'])assert.equal(safeURL(url),'#');
let s=emptyState();s.budget={total:100000,reserve:15,costs:{base:90000}};assert.deepEqual(budgetSummary(s.budget),{total:100000,reserve:15000,costs:90000,available:85000,remaining:-5000});
const c=s.compare[0];assert.equal(scoreCompany(c).passed,false);for(const[id]of GATES)c.gates[id]=true;assert.equal(scoreCompany(c).passed,false);for(const[id]of SCORE_FIELDS)c.ratings[id]=5;assert.equal(scoreCompany(c).passed,false);for(const[id]of SCORE_FIELDS)c.evidence[id]='样例证据';assert.equal(scoreCompany(c).passed,true);assert.equal(scoreCompany(c).score,100);delete c.evidence.identity;assert.equal(scoreCompany(c).passed,false);
s.read=[d.articles[0].id,d.articles[0].id,'not-valid'];s.checks=[d.articles[0].id+':0','not-valid'];s.notes[d.articles[0].id]='安全笔记';s.notes.evil='ignored';s.budget.reserve=999;s.budget.costs.base=-20;const clean=sanitizeState(s,d.articles);assert.equal(clean.read.length,1);assert.equal(clean.checks.length,1);assert.equal(clean.notes.evil,undefined);assert.equal(clean.budget.reserve,50);assert.equal(clean.budget.costs.base,0);assert.throws(()=>sanitizeState({version:2},d.articles));assert.ok(csv([['=HYPERLINK("x")','  =1+1','+2','正常']]).includes("'  =1+1"));
assert.ok(shell.includes('knowledge/guide.html'));assert.ok((await read('studio.html')).includes('href="knowledge.html"'));
for(const m of js.matchAll(/#article\/([a-z0-9-]+)/g))assert.ok(ids.has(m[1]),'Inline article '+m[1]);
for(const p of ['models','assets','studio.js','walkthrough.js','schemes.js'])assert.equal(execFileSync('git',['diff','--name-only','HEAD','--',p],{cwd:root,encoding:'utf8'}).trim(),'','3D source and assets unchanged: '+p);
console.log(`PASS: ${d.articles.length} articles, ${d.sources.length} sources, 14 populated categories, 15 sourced directory entries, 10 CSV templates; search, state import, budget, evidence-gated scoring, escaping and unchanged 3D sources.`);
