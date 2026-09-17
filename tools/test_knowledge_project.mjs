import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {projectSummary,projectView,projectBriefText} from '../knowledge/project.mjs';
import {fieldHome} from '../knowledge/field.mjs';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const data=JSON.parse(await read('knowledge/data/library.json'));
const old=JSON.parse(execFileSync('git',['show','d05a243:knowledge/data/library.json'],{cwd:root,encoding:'utf8',maxBuffer:4e6}));
assert.equal(data.version,'1.3.0');
assert.equal(data.articles.length,old.articles.length+9);
for(const a of old.articles){const current=data.articles.find(c=>c.id===a.id);assert.ok(current,a.id);assert.deepEqual(current.checklist.slice(0,a.checklist.length),a.checklist,a.id+' existing checklist indices preserved');}
const p=data.project,html=projectView(p),brief=projectBriefText(p),home=fieldHome(data,()=>'',projectSummary(p));
assert.equal(p.contextCards.length,3);assert.equal(p.steps.length,3);assert.equal(p.roomNeeds.length,6);
for(const text of ['天河区','荟雅苑','104.83','4位自如租客','10月17日之前','倾向']){assert.ok(html.includes(text),text);assert.ok(brief.includes(text),text+' brief');}
assert.ok(p.basis.includes('未据此重新审核'));
assert.ok(!/2026.{0,2}10.{0,2}17/.test(JSON.stringify(p)),'do not invent handover year');
assert.ok(home.includes('home-context'));assert.ok(home.includes('#project'));
for(const row of p.packageScope)assert.equal(row.length,3);
for(const m of html.matchAll(/#article\/([a-z0-9-]+)/g))assert.ok(data.articles.some(a=>a.id===m[1]),m[1]);
const hostile=structuredClone(p);hostile.title='<script>bad</script>';assert.ok(!projectView(hostile).includes('<script>'));assert.ok(projectView(hostile).includes('&lt;script&gt;'));
const guide=await read('knowledge/guide.html');assert.ok(guide.includes('id="our-project"'));assert.ok(guide.includes('10月17日之前'));assert.ok(!guide.includes('data-copy-project'),'no inert copy button in static edition');
const js=await read('knowledge/knowledge.js');assert.ok(js.includes("type==='project'?projectView(data.project)"));assert.ok(js.includes('projectBriefText(data.project)'));
console.log('PASS project context: owner facts, conditional handover/half-package scope, room needs, links, escaping, static edition, and all previous article/checklist identities preserved.');
