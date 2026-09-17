import {escapeHTML as e} from './lib.mjs?v=1.3.0';

const link=id=>'#article/'+encodeURIComponent(id);
export function houseFocus(data,cards){
  const g=data.houseGuide;
  return `<section class="house-focus"><div class="section-head"><div><span class="eyebrow">FOR THIS HOME, NOT EVERY HOME</span><h2>按你家的情况，我建议先抓这四件事</h2></div><a href="#house">完整实用攻略 ↗</a></div><div class="house-priorities">${g.priorities.map((p,i)=>`<div><span class="scenario-number">0${i+1}</span><h3>${e(p.title)}</h3><p>${e(p.reason)}</p><p class="house-action">${e(p.action)}</p><a href="${link(p.id)}">具体怎么做 ↗</a></div>`).join('')}</div><div class="section-head"><h2>现在先读这三篇</h2><a href="#house">交房、拆旧、逐房深化也已整理 ↗</a></div>${cards(g.tracks[0].readings.map(r=>data.articles.find(a=>a.id===r.id)).filter(Boolean))}</section>`;
}

export function houseView(data,cards){
  const g=data.houseGuide;
  return `<header class="page-head"><span class="eyebrow">A FIELD GUIDE FOR HUIYAYUAN</span><h1 tabindex="-1">${e(g.title)}</h1><p>${e(g.subtitle)}</p><p class="hint">这些是结合已知需求作出的管理与设计建议。涉及技术做法的依据见各篇来源；没有把荟雅苑的未知现状写成已发生的问题。</p></header><nav class="house-track-nav" aria-label="我家攻略阶段">${g.tracks.map(t=>`<a href="#house/${e(t.id)}">${e(t.title)}</a>`).join('')}</nav><section class="house-outputs"><h2>这一轮，先拿到三个具体成果</h2><ol>${g.outputs.map(o=>`<li><h3>${e(o.title)}</h3><p>${e(o.body)}</p><a href="${link(o.id)}">展开做法 ↗</a></li>`).join('')}</ol></section><p class="house-unknown">尚待你们确定：总预算包含哪些项目、希望何时入住、谁负责采购和看工地。未确定前，攻略不预设家庭能全天跟工，也不承诺固定装修天数。</p>${g.tracks.map(t=>`<section id="house-track-${e(t.id)}" class="house-track"><span class="eyebrow">${e(t.when)}</span><h2>${e(t.title)}</h2><p>${e(t.why)}</p><ul class="house-deliverables">${t.readings.map(r=>`<li><a href="${link(r.id)}">${e(r.result)} ↗</a></li>`).join('')}</ul>${cards(t.readings.map(r=>data.articles.find(a=>a.id===r.id)).filter(Boolean))}</section>`).join('')}<details class="learning-details"><summary>看不懂这些词？先用一句话解释</summary><dl class="room-brief">${g.glossary.map(([term,meaning])=>`<div><dt>${e(term)}</dt><dd>${e(meaning)}</dd></div>`).join('')}</dl></details><section class="house-pause"><h2>有些事，现在不用急着定</h2><ul>${g.notNow.map(x=>`<li>${e(x)}</li>`).join('')}</ul></section><div class="field-links"><a href="#project">核对我家背景 / 复制需求摘要 ↗</a><a href="#all">查询全部知识 ↗</a><a href="#tools/templates">空白记录模板 ↗</a></div>`;
}
