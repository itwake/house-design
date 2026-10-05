// Apply the owner's exact purchased SKUs, leaving the R2 survey and architecture intact.
// Layout proposal is reviewed separately; values below are centimetres, products millimetres.
import {readFile,writeFile} from 'node:fs/promises';
import {updatePurchasedCopy} from './purchased_copy.mjs';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const save=(p,v)=>writeFile(new URL(p,root),JSON.stringify(v,null,2)+'\n');
const products=[
  {id:'ikea-vimle-39635114',name:'VIMLE 维姆勒 三人沙发 · 科耐贝克浅米色',articleNumber:'396.351.14',url:'https://www.ikea.cn/cn/zh/p/vimle-wei-mu-le-san-ren-sha-fa-ke-nai-bei-ke-qian-mi-se-s39635114/',verificationUrl:'https://www.ikea.com/sg/en/p/vimle-3-seat-sofa-knaebaeck-light-beige-s39635114/',dimensionsMm:{width:2410,depth:980,height:830},seatMm:{width:2110,depth:550,height:480},armWidthMm:150,modelType:'parametric-approximation'},
  {id:'ikea-lisabo-80365717',name:'LISABO 利萨伯 固定四人餐桌 · 白蜡木贴面',articleNumber:'803.657.17',url:'https://www.ikea.cn/cn/zh/p/lisabo-li-sa-bo-zhuo-zi-bai-zha-mu-tie-mian-80365717/',dimensionsMm:{width:1400,depth:780,height:740},extendable:false,modelType:'parametric-approximation'},
  {id:'ikea-lisabo-80457236',name:'LISABO 利萨伯 餐椅 · 白蜡木',articleNumber:'804.572.36',url:'https://www.ikea.cn/cn/zh/p/lisabo-li-sa-bo-yi-zi-bai-zha-mu-80457236/',dimensionsMm:{width:460,depth:510,height:800},seatMm:{width:440,depth:390,height:450},modelType:'parametric-approximation'}
];
const proposal=await read('tools/purchased-layout-20261005.json');
const diningCopy='已购LISABO固定餐桌1400×780×740mm，四把LISABO木餐椅外包460×510×800mm，南北两侧各两席。取消旧抽拉桌及收桌演示，不假设桌椅可折叠或藏进柜里。';
const sofaCopy='已购VIMLE浅米色三人沙发2410×980×830mm，三座垫、三靠垫，坐高480mm。以官方外包尺寸替换旧通用沙发，不为适配走道缩小家具。';
const approximation='家具为按官方外包尺寸及产品照片重建的参数模型，缝线、弧度和腿型为近似，并非宜家官方CAD；不替代现场搬运、门洞和净距核验。';
// Final reviewed catalog copy is explicit so rebuilding from a pre-purchase
// catalog cannot revive unmatched legacy sofa/table headlines or feature chips.
const catalogDisplay={
  "wood": {
    "scheme": {
      "summary": "保留浅橡木、奶白与原三房两卫、右手鞋柜和左手7字餐柜；客餐厅换入已购VIMLE浅米色沙发与LISABO固定桌椅。厨房大窗及柜体摆设同步现行设计。客厅复尺400mm低台配设计50mm软垫，窗前留白；框内净空与防护待核。",
      "differences": [
        "保留原三房、北侧过道、主卧直通主卫与两卫阶梯共墙。",
        "厨房已拓宽为1700mm三轨推拉门；右鞋柜、左7字餐柜保留。",
        "原版模型与15张效果图留档；厨房同步更新另存独立模型与新效果图。",
        "已购2410×980mm沙发与1400×780mm固定餐桌，餐桌南北各两把LISABO木椅。"
      ]
    },
    "rooms": {}
  },
  "family": {
    "scheme": {
      "tagline": "已购家具，亲子日常",
      "differences": [
        "已购VIMLE沙发2410×980×830mm，东侧书架前模型净距600mm。",
        "背柜2000×250×650mm，随沙发增深向南移100mm，朝餐区用移门取物。",
        "LISABO固定餐桌1400×780×740mm；四把木餐椅南北各两席。",
        "桌椅按实际外廓占地，固定餐桌持续保留，不提供收起状态。",
        "入户库、两车分层、家政阳台与卧卫建筑保留；局部复尺信息同步。"
      ],
      "tradeoffs": [
        "沙发西侧至普通餐柜模型净距915mm，东侧书架前600mm；仍需现场核对取物与通行。",
        "固定餐桌西侧至普通柜段675mm、局部440mm深柜段最窄635mm；东侧至厨房墙最窄700mm，属于紧凑通行。",
        "北侧餐椅拉出300mm后与背柜仅125mm，不作椅后通道；从桌两端侧向入座。南椅同幅拉出后至北返柜685mm。",
        "沙发、桌椅采用商品公布外廓；软包、木腿与板厚为图像近似，并非厂家CAD。家具安装净距与搬运路线需实物核对。",
        "沙发背柜2000×250×650mm，距沙发20mm，朝餐区用移门取物；内部进深约210mm，只放小件，不代替儿童车库。防倾倒固定、通风和儿童防夹须厂家深化。",
        "入户双折门停车、两车分层、卧卫/书房/飘窗/厨房/家政阳台实体全部保留；库门完整运动、抬车、防水和设备复尺仍沿用前版待核条件。",
        "1500×650mm入户库、两车分层及1230mm抬放平台保留；55cm宽推车穿57cm架腿净距仍很紧，需实车核验，承重/防坠须专业深化。",
        "东面双折门各305mm宽，完全外翻180°后在北侧门洞外叠停；叠门约55mm厚、向北投影305mm，不占名义610mm洞口。180°偏置铰链、板厚、轨道与完整折叠过程必须由厂家确认。",
        "完全停车示意至右鞋柜约1275mm，不代表开启全程已通过。取车先关闭入户门，收好餐椅；车移出门扫范围、关好储物门后再开入户门，一次一辆，人体抬放和转向需实物排演。",
        "两车不再同时落地：折叠婴儿车750×550×1050mm落地，儿童车1100×500×750mm抬放至1230mm平台完成面。必须复核实车含把手、脚踏与折叠状态。",
        "儿童车1200mm高独立支架、30mm平台仅为构造占位；载荷、锚固、防倾倒、防坠与托轮定位须厂家验算，不让孩子自行攀爬取车。成人需抬放约1.23m，不等于方便推入或自动升降。",
        "上方是真台盆，但必须是专用浅盆/后置排水定制，不能直接用普通深台下盆；980mm盆沿偏高，不是儿童独立洗手位。",
        "机器顶面与盆底仅30mm，需厂家确认震动、检修和散热；台盆与台面由独立支架承重，不能压在机器上。",
        "厨房内窗保持1200×1300mm、台高1000mm；980mm台面仅低20mm，收口、窗框和龙头必须复尺。龙头偏左布置，避开窗洞。",
        "阳台前后仅1490mm，两机开门时过道紧张，一次操作一台，从侧面取衣；未选定机门铰链和实际开门包络。",
        "外移的是室内隔断，不是外立面扩建；原窗下墙、梁柱、门垛可拆性和湿区防水须专业核查。"
      ],
      "references": [
        "ikea-besta-shallow"
      ]
    },
    "rooms": {
      "overall": {
        "title": "已购家具，围坐日常",
        "description": "保留亲子储物和家政整墙，客厅换已购2410mm沙发，背柜南移100mm；餐桌换已购LISABO固定桌，南北各两席。",
        "features": [
          "2410mm VIMLE沙发",
          "LISABO固定桌椅",
          "亲子储物＋家政整墙"
        ]
      }
    }
  },
  "laundry": {
    "scheme": {
      "summary": "A洗衣机与烘干机在靠厨房共墙落地并排，980mm浅盆台面；B东侧300mm浅书架，C阳台推拉门外移约288mm拉齐门框与柜面。客餐厅采用已购VIMLE沙发与LISABO固定桌椅，7字柜、茶几和电视柜按当前布局保留。 客厅窗前无桌椅；复尺400mm低台＋设计50mm软垫，框内净空及防护待核。",
      "differences": [
        "两机各按600×650×850mm外包占位，含前门；型号及安装间隙待选型。",
        "A台面1680×800mm，完成面980mm；专用浅盆外深100mm，盆底880mm。",
        "B书架3180mm长、300mm深、2400mm高；C门框外沿向客厅移287.5mm，与书架正面齐平。",
        "阳台操作过道约690mm；已购2410mm沙发东侧书架前模型净距600mm。",
        "C洞口1500mm、向南三轨叠停，名义净开约900mm；台面限制使实际北侧入内段约690mm。"
      ],
      "tradeoffs": [
        "家政设备、柜体和安装净空仍为条件推演；已采用的局部窗尺寸与待核墙线另见复尺明细。",
        "上方是真台盆，但必须是专用浅盆/后置排水定制，不能直接用普通深台下盆；980mm盆沿偏高，不是儿童独立洗手位。",
        "机器顶面与盆底仅30mm，需厂家确认震动、检修和散热；台盆与台面由独立支架承重，不能压在机器上。",
        "厨房内窗保持1200×1300mm、台高1000mm；980mm台面仅低20mm，收口、窗框和龙头必须复尺。龙头偏左布置，避开窗洞。",
        "阳台前后仅1490mm，两机开门时过道紧张，一次操作一台，从侧面取衣；未选定机门铰链和实际开门包络。",
        "外移的是室内隔断，不是外立面扩建；原窗下墙、梁柱、门垛可拆性和湿区防水须专业核查。",
        "主卧套内玄关、书房书架和7字餐边柜保留；客餐厅采用已购VIMLE沙发与LISABO固定桌椅，不加入亲子储物库。"
      ]
    },
    "rooms": {
      "overall": {
        "description": "A洗衣机与烘干机在靠厨房共墙落地并排，980mm浅盆台面；B东侧300mm浅书架，C阳台推拉门外移约288mm拉齐门框与柜面。客餐厅采用已购VIMLE沙发与LISABO固定桌椅，7字柜、茶几和电视柜按当前布局保留。"
      },
      "balcony": {
        "description": "A洗衣机与烘干机在靠厨房共墙落地并排，980mm浅盆台面；B东侧300mm浅书架，C阳台推拉门外移约288mm拉齐门框与柜面。客餐厅采用已购VIMLE沙发与LISABO固定桌椅，7字柜、茶几和电视柜按当前布局保留。"
      }
    }
  }
};
const legacy=/暂改2000mm|暂按2000mm|1155×705|1155mm|参考原厂Lunch|桌面暂高750mm|四席为东侧两席|展开餐椅各拉出300mm|收桌先移开|餐桌椅北移600mm/;
function clean(v){
  if(typeof v==='string')return legacy.test(v)?diningCopy+' '+sofaCopy:v;
  if(Array.isArray(v))return v.map(clean);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clean(x)]));
  return v;
}
const catalog=await read('models/design-schemes.json');
catalog.version='3.7.0';catalog.updatedAt='2026-10-05';
catalog.purchasedFurnitureSource='models/purchased-furniture-20261005.json';
await save(catalog.purchasedFurnitureSource,{version:'3.7.0',verifiedAt:'2026-10-05',quantityAssumption:'沙发1、餐桌1；餐椅数量按原四席暂设4把，购买数量未单独提供。',products,modelNotice:approximation});
for(const sid of ['wood','family','laundry']){
  const path=`models/schemes/${sid}/design-data.json`;
  let d=await read(path);const p=proposal.schemes[sid];
  const layout=p&&{...p,sofa:p.furniture.find(f=>f.productKey==='sofa'),table:p.furniture.find(f=>f.productKey==='table'),chairs:p.furniture.filter(f=>f.productKey==='chair'),backStorage:p.relatedFurniture?.[0]};
  if(!layout)throw new Error('Missing reviewed layout '+sid);
  if(sid==='family'){
    delete d.pulloutDining;delete d.familyDiningRevision;
    d=clean(d);
    for(const fit of d.storageFitouts){
      fit.references=fit.references?.filter(r=>!(/Lunch|抽拉桌/.test(r.title||'')));
      for(const p of fit.parts){
        if(p.role==='pullout_table_cabinet'){
          p.role='sideboard_base';
          for(const k of ['diningFitoutId','tableTopHeightCm','cavityHeightCm'])delete p[k];
        }
        if(fit.id==='sofa_back_storage')p.y=layout.backStorage.y;
      }
      if(fit.id==='dining_sideboard_wall'){
        fit.title='餐边 · L形长柜与已购四人桌';
        fit.summary='保留西墙及入户库北面的L形餐边柜，原1200mm抽桌模块恢复普通移门下柜；柜外深440mm不变。'+diningCopy;
        fit.dimensions=['LISABO固定桌1400×780×740mm','下柜台面850mm，上柜深280mm','四把餐椅460×510×800mm'];
      }
    }
    const back=d.furniture.find(f=>f.id==='family_sofa_back_storage');back.y=layout.backStorage.y;
    d.storageDesign.title='折叠分层库 × LISABO四席桌 × 沙发背柜';
    d.storageDesign.assumptions=[...new Set(d.storageDesign.assumptions)];
    // Keep provenance of the earlier structural revision without presenting its old sofa choice as current.
    Object.assign(d.familyFlowRevision,{sofaWidthCm:241,sofaChoice:'已购VIMLE 241cm；按3.7.0家具配置定位',sofaShiftCm:null});
    Object.assign(d.garage.metrics,{southChairPulledGapCm:68.5,tableSideboardGapCm:67.5,local44cmCabinetToTableMinimum:63.5,sideboardChairGapCm:79.5});
  }
  const sofa=d.furniture.find(f=>f.name==='三人沙发');
  if(!sofa.rugCm)sofa.rugCm={x:sofa.x-12,y:sofa.y-185,w:sofa.w+24,d:192};
  Object.assign(sofa,layout.sofa,{purchasedProductId:products[0].id,heightCm:83,displayName:products[0].name});
  const table=d.furniture.find(f=>f.name==='四人餐桌');
  Object.assign(table,layout.table,{purchasedProductId:products[1].id,heightCm:74,displayName:products[1].name,tone:'wood'});delete table.diningFitoutId;
  const chairIndices=d.furniture.flatMap((f,i)=>f.name.startsWith('餐椅')?[i]:[]);
  if(chairIndices.length!==4||layout.chairs.length!==4)throw new Error('Expected four chairs');
  chairIndices.forEach((idx,i)=>{d.furniture[idx]={...layout.chairs[i],a:0,tone:'wood',purchasedProductId:products[2].id,heightCm:80,displayName:products[2].name};});
  d.version=`3.7.0 · ${sid} · 已购家具＋补充复尺`;
  d.purchasedFurnitureRevision={version:'3.7.0',date:'2026-10-05',products,quantityAssumption:'餐椅暂按原四席设4把。',modelNotice:approximation,layoutNotes:layout.notes,clearancesCm:layout.clearancesCm,roomDescriptions:{living:sofaCopy+' '+layout.notes.join(' ')+' '+d.measurementRevision.roomDescriptions.living,dining:diningCopy+' '+layout.notes.join(' ')+' '+approximation}};
  if(d.laundry?.metrics)d.laundry.metrics.sofaBookcaseGapCm=60;
  d.renovationNotes=d.renovationNotes.filter(n=>n.roomId!=='dining');
  for(const n of d.renovationNotes)if(n.roomId==='living')n.text=d.purchasedFurnitureRevision.roomDescriptions.living;
  d.renovationNotes.push({roomId:'dining',text:d.purchasedFurnitureRevision.roomDescriptions.dining});
  if(sid==='family'){
    d.layout.intent='保留亲子储物和家政整墙，客厅换已购2410mm沙发，背柜南移100mm；餐桌换已购LISABO固定桌，南北各两席。';
    d.storageDesign.assumptions.push(...layout.notes,approximation);
    d.storageDesign.assumptions=[...new Set(d.storageDesign.assumptions)];
  }
  await save(path,updatePurchasedCopy(d));
  const s=catalog.schemes.find(s=>s.id===sid);
  s.assetRevision='3.7.0';s.purchasedFurnitureRevision='3.7.0';
  if(s.renderViews)s.renderViews=s.renderViews.filter(v=>v!=='dining-closed');
  if(sid==='family'){
    Object.assign(s,clean(s));s.summary=d.layout.intent;
    s.layoutChanges=[sofaCopy,diningCopy,...layout.notes];
    s.constraints=[...new Set((s.constraints||[]).filter(n=>!legacy.test(n)))];
  }
  Object.assign(s,catalogDisplay[sid].scheme);
  s.roomOverrides||={};
  for(const [id,copy] of Object.entries(catalogDisplay[sid].rooms))s.roomOverrides[id]={...s.roomOverrides[id],...copy};
  const roomDisplay={
    living:{title:'浅米色沙发，日常围坐',description:d.purchasedFurnitureRevision.roomDescriptions.living,features:['VIMLE 2410×980mm','科耐贝克浅米色','三座垫 · 三靠垫']},
    dining:{title:'白蜡木桌边，一日三餐',description:sid==='family'?d.purchasedFurnitureRevision.roomDescriptions.dining:'已购 LISABO 固定餐桌1400×780×740mm，四把白蜡木餐椅460×510×800mm，座高450mm；南北两侧各两席。固定桌椅保留完整占地，入座和绕行净空须现场试摆。',features:['LISABO 1400×780mm固定桌','四把LISABO木椅','座高450mm']}
  };
  for(const key of ['rooms','roomOverrides']){
    const collection=s[key];if(!collection)continue;
    for(const [rid,r] of Object.entries(collection)){
      const id=r.id||rid;if(roomDisplay[id])Object.assign(r,roomDisplay[id]);
    }
  }
  // Older wood/laundry catalogs have no dining override at all.
  for(const [id,copy] of Object.entries(roomDisplay))s.roomOverrides[id]={...s.roomOverrides[id],...copy};
}
catalog.references=catalog.references.filter(r=>!(/Lunch|抽拉桌/.test(r.title||'')));
await save('models/design-schemes.json',catalog);
console.log('Applied purchased furniture to all three current schemes; R2 measurement revision remains 3.6.1.');
