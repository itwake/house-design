// Desk-wall bookcase: centimetre concept geometry, never a load-bearing design.
export function applyStudyBookwall(d){
  const fit={id:'study_bookwall',roomId:'room_c',name:'书房南墙 · 通长浅书架',
    x:12,y:592,w:272,d:28,zCm:146,hCm:104,face:'north',grade:'C',
    title:'桌面留空，书往墙上收',
    description:'沿现有2720mm通长书桌上方做280mm深浅书架：两排开放书格＋顶部暖白柜门。书架底1460mm，桌面760mm，留700mm操作空档；书架前沿较桌沿退后270mm。保留北墙沙发、原推拉门和桌下腿位。',
    conditions:['书架总宽2720mm含两侧收口，深280mm、底高1460mm、顶高2500mm均为模型假设，需复尺。','六个分格，每格净跨约428mm、下方两排净高318mm；模型板厚22mm不等于已验算承重。书籍重量、板材、层板支撑和墙体锚固必须由定制方复核。','顶部为低频收纳，不能站上桌面取物；儿童常读书应放桌面或较低可及处，不将高处书格当儿童自助书架。','上方柜门为关闭示意；高位开门与拿书操作、照明眩光、插座、空调管线和检修空间需现场试用深化。','书架不支在桌面上；基层与墙体不满足吊挂条件时须重新设计支撑，不能直接将示意图交木工固定。'],
    references:[
      {title:'书核公寓 / 大海小燕设计工作室',url:'https://www.archdaily.cn/cn/975395/shu-he-gong-yu-da-hai-xiao-yan-she-ji-gong-zuo-shi',platform:'ArchDaily · 建成案例',borrow:'参考长桌与上方书架形成连续阅读墙的思路。',avoid:'不照搬该项目拆墙与4米长隔板，也不据照片推断本房承重。'},
      {title:'White Loft Home Office with Floating Shelves',url:'https://www.houzz.com/photos/white-loft-home-office-with-floating-shelves-contemporary-home-office-san-francisco-phvw-vp~111601574',platform:'Houzz · Jennifer Gustafson Interior Design',borrow:'参考桌面与墙面搁架分离、书与摆件留空陈列。',avoid:'不采用案例的亮黄绿色，延续本方案暖白浅木。'},
      {title:'宜家 · 风格协调的木韵家庭工作区',url:'https://www.ikea.cn/cn/zh/rooms/home-office/gallery/a-coordinated-brown-wood-dream-of-a-home-workspace-pub69a54a17',platform:'IKEA · 官方灵感',borrow:'参考桌面与柜体材质协调、用封闭收纳减少视觉杂乱。',avoid:'不照搬独立大书桌或深棕色整墙。'}
    ],parts:[]};
  const add=(id,role,x,y,z,w,depth,h,material)=>fit.parts.push({id,role,x,y,zCm:z,w,d:depth,hCm:h,material});
  const t=2.2,pitch=(fit.w-t)/6,clear=pitch-t;
  add('back','back',12,618.8,146,272,1.2,104,'Cream');
  for(let i=0;i<=6;i++)add('upright_'+i,'upright',12+i*pitch,592,146,t,26.8,104,'Cream');
  for(let i=0;i<6;i++){
    const x=12+t+i*pitch;
    for(const z of [146,180,214,247.8])add(`shelf_${i}_${z}`,'shelf',x,594.2,z,clear,24.6,t,'OakLight');
    add('door_'+i,'door',x+.15,592,216.35,clear-.3,1.8,31.3,'Cream');
    add('pull_'+i,'pull',x+clear/2-3,591.75,217,6,.25,.7,'WarmGrayMetal');
    // Small, modelled book groups, deliberately not solid filled storage.
    for(const row of [0,1]){
      const start=x+3+(i%2?clear*.34:0),base=148.2+34*row;
      for(let j=0;j<3+(i+row)%3;j++){
        const px=start+j*3.9,height=21+((i+j+row)%4)*2;
        const mat=['WhiteLinen','Sage','OakLight','Cream'][(i+j+row)%4];
        add(`book_${i}_${row}_${j}`,'book',px,595,base,3.1,21,height,mat);
        add(`book_label_${i}_${row}_${j}`,'book-label',px+.45,594.9,base+height-5.5,2.2,.1,.5,'Cream');
      }
    }
  }
  // LED channel is a modelled diffuser, not a promised lighting calculation.
  add('under_light','light-diffuser',18,594,145.2,260,1.6,.8,'Lamp');
  fit.x=12;fit.y=591.75;fit.d=28.25;fit.zCm=145.2;fit.hCm=104.8; // Include pulls and underside diffuser in true envelope.
  d.wallFitouts=[fit];
  d.version='3.2.4 · suite study bookwall';d.geometryRevision='suite-study-bookwall-2026-09-22';
  d.renovationNotes.find(n=>n.roomId==='room_c').text+=' '+fit.description+' 吊挂承重、板材与锚固待专业深化。';
  d.geometryNotes.unshift('V3.2.4仅为书房现有南墙通长桌上方增加浅书架；墙、门窗、家具落地位置与暖白配色均保留。上柜悬挂高度与承重需复尺、试用及验算。');
}

export function updateBookwallCatalog(catalog,d){
  catalog.version='3.2.4';const s=catalog.schemes.find(s=>s.id==='suite'),fit=d.wallFitouts[0];
  s.assetRevision='3.2.4';s.summary+=' 书房桌墙新增浅书架与暖白顶柜。';
  s.roomOverrides.room_c={title:fit.title,description:d.renovationNotes.find(n=>n.roomId==='room_c').text,features:['通长浅书架','开放格＋封闭顶柜','保留桌面腿位']};
}
