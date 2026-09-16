export const STORAGE_KEY='house-design:renovation-kb:v1';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeURL=value=>{try{const raw=String(value);if(raw.startsWith('docs/')&&!raw.includes('..'))return raw;const url=new URL(raw);return ['https:','http:'].includes(url.protocol)?url.href:'#';}catch{return '#';}};
export function searchArticles(articles,query='',category='all',priority='all'){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return articles.filter(a=>(category==='all'||a.category===category)&&(priority==='all'||a.priority===priority)&&terms.every(t=>JSON.stringify([a.title,a.summary,a.tags,a.sections,a.checklist,a.questions,a.pitfalls]).toLocaleLowerCase().includes(t)));
}
export const COST_FIELDS=[['design','设计/量房/专业咨询'],['demolition','拆旧/清运/保护'],['base','基础施工/水电/防水'],['materials','瓷砖/地板/涂装等主材'],['windows','门窗/隔声/安全防护'],['custom','橱柜/全屋定制/台面'],['equipment','空调/热水/新风除湿'],['appliances','厨电/洗烘/其他家电'],['sanitary','洁具/五金/灯具开关'],['furniture','家具/窗帘/软装'],['testing','监理/验收/检测/保洁'],['other','物流上楼/仓储/临租/其他']];
export const SCORE_FIELDS=[['identity','签约与收款主体清楚',15],['site','相似旧房工地证据',20],['drawings','设计成果与深化能力',15],['scope','报价范围与增项规则',20],['team','项目经理/班组/沟通',15],['service','验收/付款/售后机制',15]];
export const GATES=[['entity','主体与收款账户已核对'],['scope','合同范围及附件已读明白'],['safety','不承诺违规拆改或包过审批']];
export function emptyState(){return {version:1,read:[],saved:[],checks:[],notes:{},budget:{total:0,reserve:15,costs:{}},compare:Array.from({length:3},()=>({name:'',ratings:{},evidence:{},gates:{}}))};}
const number=(v,min,max,def=0)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):def;
export function sanitizeState(input,articles){
  if(!input||typeof input!=='object'||input.version!==1)throw new Error('备份格式不受支持');
  const out=emptyState(),ids=new Set(articles.map(a=>a.id)),checkIds=new Set(articles.flatMap(a=>(a.checklist||[]).map((_,i)=>a.id+':'+i)));
  for(const key of ['read','saved','checks'])out[key]=Array.isArray(input[key])?[...new Set(input[key].filter(x=>typeof x==='string'&&(key==='checks'?checkIds:ids).has(x)))]:[];
  for(const id of ids)if(typeof input.notes?.[id]==='string')out.notes[id]=input.notes[id].slice(0,5000);
  out.budget.total=number(input.budget?.total,0,100000000);out.budget.reserve=number(input.budget?.reserve,0,50,15);
  for(const [id] of COST_FIELDS)out.budget.costs[id]=number(input.budget?.costs?.[id],0,100000000);
  for(let i=0;i<3;i++){const src=input.compare?.[i],dest=out.compare[i];if(!src)continue;dest.name=typeof src.name==='string'?src.name.slice(0,100):'';for(const[id]of SCORE_FIELDS){dest.ratings[id]=Math.round(number(src.ratings?.[id],0,5));dest.evidence[id]=typeof src.evidence?.[id]==='string'?src.evidence[id].slice(0,500):'';}for(const[id]of GATES)dest.gates[id]=src.gates?.[id]===true;}
  return out;
}
export function budgetSummary(budget){const total=Number(budget.total)||0,reserve=total*(Number(budget.reserve)||0)/100,costs=COST_FIELDS.reduce((sum,[id])=>sum+(Number(budget.costs?.[id])||0),0);return{total,reserve,costs,available:total-reserve,remaining:total-reserve-costs};}
export function scoreCompany(company){const score=SCORE_FIELDS.reduce((s,[id,_,weight])=>s+(Number(company.ratings[id])||0)/5*weight,0),gatesPassed=GATES.every(([id])=>company.gates[id]===true),rated=SCORE_FIELDS.filter(([id])=>Number(company.ratings[id])>0).length,evidence=SCORE_FIELDS.filter(([id])=>(company.evidence[id]||'').trim()).length;return {score:Math.round(score*10)/10,gatesPassed,rated,passed:gatesPassed&&rated===SCORE_FIELDS.length&&evidence===SCORE_FIELDS.length,evidence};}
export function csv(rows){return '\uFEFF'+rows.map(row=>row.map(cell=>{let v=String(cell??'');if(/^\s*[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
