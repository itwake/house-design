// Display-only statements invalidated by the bought furniture. No dimensions,
// transforms, door or object records are changed by these exact replacements.
export const replacements=new Map([
  ['沿用1200×700mm四人桌和既有椅位；退椅300mm只是一种校核情景，进出时收椅，不能当作多人或无障碍通行认证。','采用已购1400×780mm固定四人桌及460×510mm餐椅，已重新核对椅位；退椅300mm只是一种校核情景，进出时收椅，不能当作多人或无障碍通行认证。'],
  ['餐桌及椅子不再移位；77.5/80cm为静态两侧边距。北段浅抽屉开启与取物时不可同时把柜前当通道，桌旁及南短臂下柜采用移门。','餐桌保留原中心，已购1400×780mm桌的西侧模型净距67.5cm、东侧70cm；餐椅按完整460×510mm占地重新摆放。北段浅抽屉开启与取物时不可同时把柜前当通道，桌旁及南短臂下柜采用移门。'],
  ['餐桌西侧775、东侧800mm；南椅退300mm后至短臂仍约815mm','固定餐桌西侧675、东侧700mm；南椅拉出300mm后至南短臂约715mm，仍须现场核对'],
  ['阳台操作过道约690mm；沙发西移800mm，书架前约700mm。','阳台操作过道约690mm；已购2410mm沙发东侧书架前模型净距600mm，取物与通行仍须现场核对。'],
  ['A洗衣机与烘干机在靠厨房共墙落地并排，980mm浅盆台面；B东侧300mm浅书架，C阳台推拉门外移约288mm拉齐门框与柜面。沙发和茶几西移800mm、电视柜西移400mm，餐桌及7字柜保留。 厨房大窗不变，前方690mm操作带仍紧凑。','A洗衣机与烘干机在靠厨房共墙落地并排，980mm浅盆台面；B东侧300mm浅书架，C阳台推拉门外移约288mm拉齐门框与柜面。客餐厅采用已购VIMLE沙发与LISABO固定桌椅，7字柜、茶几和电视柜按当前布局保留。 厨房大窗不变，前方690mm操作带仍紧凑。']
]);
export function updatePurchasedCopy(value,changes=[],path=[]){
  if(typeof value==='string'&&replacements.has(value)){
    const next=replacements.get(value);changes.push({path,previous:value,current:next});return next;
  }
  if(Array.isArray(value))return value.map((v,i)=>updatePurchasedCopy(v,changes,[...path,i]));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,updatePurchasedCopy(v,changes,[...path,k])]));
  return value;
}
