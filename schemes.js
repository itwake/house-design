export const SCHEME_REVISION='3.1.0';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const assetURL=(path,revision=SCHEME_REVISION)=>{const url=new URL(path,document.baseURI);url.searchParams.set('v',revision);return url.href};
export const viewerURL=(id,hash='')=>{const url=new URL('studio.html',document.baseURI);url.searchParams.set('scheme',id);url.searchParams.set('v',SCHEME_REVISION);url.hash=hash;return url.href};
export const schemeRender=(scheme,view)=>assetURL(`${scheme.id==='wood'?'assets/blender-renders':`assets/schemes/${scheme.id}`}/${view}.jpg`,scheme.assetRevision||SCHEME_REVISION);
export async function loadSchemeCatalog(){
  const response=await fetch(assetURL('models/design-schemes.json'));if(!response.ok)throw new Error('方案目录暂未载入');
  const catalog=await response.json();if(!Array.isArray(catalog.schemes)||!catalog.schemes.length)throw new Error('方案目录为空');
  return catalog;
}
export function schemeSwatches(scheme){return(scheme.colors||[]).map(color=>`<span class="scheme-swatch"><i style="--swatch:${/^#[\da-f]{3,8}$/i.test(color.hex)?color.hex:'#ddd'}"></i><span>${escapeHTML(color.name)}</span></span>`).join('')}
function schemeReferences(catalog,scheme){
  const references=(scheme.references||[]).map(id=>(catalog.references||[]).find(reference=>reference.id===id)).filter(reference=>reference&&/^https?:\/\//i.test(reference.url));
  if(!references.length)return'';
  return`<details class="scheme-references"><summary>参考案例 <span>＋</span></summary><ul>${references.map(reference=>`<li><a href="${escapeHTML(reference.url)}" target="_blank" rel="noopener noreferrer" data-scheme-reference-id="${escapeHTML(reference.id)}">${escapeHTML(reference.title)} <span aria-hidden="true">↗</span></a>${reference.author?`<small>${escapeHTML(reference.author)}</small>`:''}</li>`).join('')}</ul><p>只借鉴材料与色彩，不移植案例尺寸；图片留在原作者页面。</p></details>`;
}
export function schemeCards(catalog,{current=null,hash='',compact=false}={}){
  return catalog.schemes.map((scheme,index)=>`<article class="scheme-card${scheme.id===current?' is-selected':''}" data-scheme-card="${escapeHTML(scheme.id)}"><a class="scheme-card-image" href="${viewerURL(scheme.id,hash)}" aria-label="进入${escapeHTML(scheme.name)}三维方案"><img src="${scheme.hero?assetURL(scheme.hero,scheme.assetRevision):schemeRender(scheme,'living')}" alt="${escapeHTML(scheme.name)} · 本户型同源 Blender 渲染" loading="${index<2?'eager':'lazy'}"/><span class="scheme-image-status" hidden>本方案效果图暂未载入</span><span class="scheme-number">0${index+1} / ${scheme.id==='wood'?'保留原案':'新的表达'}</span><span class="scheme-image-arrow" aria-hidden="true">↗</span></a><div class="scheme-card-copy"><p class="scheme-eyebrow">${escapeHTML(scheme.en)}</p><h2>${escapeHTML(scheme.name)}${scheme.id===current?'<small>当前方案</small>':''}</h2><p class="scheme-tagline">${escapeHTML(scheme.tagline||scheme.style)}</p><p class="scheme-summary">${escapeHTML(scheme.summary)}</p><div class="scheme-swatches">${schemeSwatches(scheme)}</div><ul class="scheme-differences">${(scheme.differences||[]).map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul>${!compact&&scheme.tradeoffs?.length?`<details class="scheme-tradeoffs"><summary>选择这套，需要接受什么 <span>＋</span></summary><ul>${scheme.tradeoffs.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul></details>`:''}${!compact?schemeReferences(catalog,scheme):''}<a class="scheme-enter" href="${viewerURL(scheme.id,hash)}"><span>${scheme.id===current?'继续查看':'进入方案'} <small>3D / 平面 / 15 个渲染视角</small></span><b>↗</b></a></div></article>`).join('');
}
export function bindSchemeImages(root){root.querySelectorAll('.scheme-card-image img').forEach(img=>{const label=img.nextElementSibling;const loaded=()=>{img.style.opacity='1';label.hidden=true},failed=()=>{img.style.opacity='0';label.hidden=false};img.addEventListener('load',loaded);img.addEventListener('error',failed);if(img.complete){if(img.naturalWidth)loaded();else failed()}})}
async function gallery(){
  const grid=document.querySelector('#scheme-grid');if(!grid)return;
  try{
    const catalog=await loadSchemeCatalog(),params=new URLSearchParams(location.search),requested=params.get('scheme');
    const validRequest=catalog.schemes.some(s=>s.id===requested);
    if(validRequest||(!requested&&/^#(overall|living|dining|room_[abc]|kitchen|bath_[12]|balcony)$/.test(location.hash))){location.replace(viewerURL(validRequest?requested:'wood',location.hash));return}
    grid.innerHTML=schemeCards(catalog);bindSchemeImages(grid);
    document.querySelector('#gallery-status').hidden=!requested;
    if(requested)document.querySelector('#gallery-status').textContent='未找到请求的方案，请从下方选集中重新选择。';
    document.querySelector('#scheme-invariants').innerHTML=(catalog.invariants||[]).map(note=>`<li>${escapeHTML(note)}</li>`).join('');
    document.documentElement.dataset.uiRevision=SCHEME_REVISION;
  }catch(error){document.querySelector('#gallery-status').textContent='方案目录暂未载入，请刷新重试。原有模型仍可从下方直达入口查看。';console.error(error)}
}
gallery();
