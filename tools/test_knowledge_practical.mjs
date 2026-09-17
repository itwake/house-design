import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decisionTable,fieldHome,casesView,studyView} from '../knowledge/field.mjs';
import {searchArticles} from '../knowledge/lib.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const data=JSON.parse(await read('knowledge/data/library.json'));
const practical=data.articles.filter(a=>a.mode==='practical');
assert.ok(practical.length>=30);
assert.equal(data.version,'1.3.0');
assert.equal(new Set(data.study.groups.flatMap(g=>g.files)).size,40);
assert.equal(data.study.cases.length,4);
const ids=new Set(data.articles.map(a=>a.id));
for(const a of practical){
 assert.ok(a.tags.includes('实战手册'),a.id);
 assert.ok(a.sourceIds.some(id=>data.sources.find(s=>s.id===id)?.kind==='provided'||data.sources.find(s=>s.id===id)?.kind==='experience'),a.id+' direct studied source');
 for(const s of a.sections)if(s.table){assert.ok(s.table.headers.length>1);assert.ok(s.table.rows.every(row=>row.length===s.table.headers.length));}
}
for(const s of data.sources.filter(s=>s.kind==='provided')){assert.ok(!s.url);assert.ok(s.locator);assert.ok(!/Users[\\/]|Downloads[\\/]|@|1[3-9]\d{9}/.test(JSON.stringify(s)));}
const sourceFiles=['practical-budget','practical-materials','practical-process','practical-reading','study','house-contract','house-handover','house-living','house-plan'];
for(const f of sourceFiles){const raw=await read('knowledge/data/'+f+'.json');assert.ok(!/C:[\\/]|xsec_token|REDACTED|赖家|dvnuo|(?<![a-z0-9])1[3-9]\d{9}(?![a-z0-9])/i.test(raw),f+' no private identifiers or session tokens');}
const table=decisionTable({headers:['<script>','选项'],rows:[['<img>','&风险']]});
assert.ok(!table.includes('<script>'));assert.ok(table.includes('&lt;img&gt;'));assert.ok(table.includes('scope="row"'));
assert.equal(decisionTable(), '');
const home=fieldHome(data,()=>''),cases=casesView(data.study),study=studyView(data.study);
for(const category of ['company','budget','materials','water-electric','finish','custom']){assert.ok(home.includes('#field/'+category));assert.ok(practical.some(a=>a.category===category));}
for(const s of [home,cases,study])for(const match of s.matchAll(/#article\/([a-z0-9-]+)/g))assert.ok(ids.has(match[1]),match[1]);
assert.ok(cases.includes('xsec_token')===false);
assert.ok(searchArticles(practical,'73,600').length>0,'worked example searchable');
assert.ok(searchArticles(practical,'复尺').length>=3);
const guide=await read('knowledge/guide.html');
assert.ok(guide.includes('decision-table'));assert.ok(guide.includes('这 40 份资料'));
for(const a of practical)assert.ok(guide.includes(a.title));
console.log('PASS practical content: '+practical.length+' articles, 40-file index, 4 observed XHS notes, source locators, safe rendering, comparison tables, search, privacy and static edition.');
