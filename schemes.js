// Real layouts have independent sources. Colour-only variants stay archived.
export const SCHEME_REVISION='3.2.1';
export const RETIRED_PALETTE_IDS=Object.freeze(['terracotta','moss','cobalt']);
export const assetURL=(path,revision=SCHEME_REVISION)=>{
  const url=new URL(path,document.baseURI);url.searchParams.set('v',revision);return url.href;
};
export const schemeRender=(scheme,view)=>assetURL(
  `${scheme.id==='wood'?'assets/blender-renders':`assets/schemes/${scheme.id}`}/${view}.jpg`,
  scheme.assetRevision||SCHEME_REVISION
);
export function resolveScheme(catalog,requested){
  const retired=RETIRED_PALETTE_IDS.includes(requested);
  const id=retired?'wood':requested||catalog.defaultScheme;
  return {scheme:catalog.schemes.find(item=>item.id===id),retired};
}
export function entryURL(href){
  const current=new URL(href),url=new URL('studio.html',current);
  // Keep room bookmarks and query context. The viewer explicitly resolves old
  // palette IDs; unknown IDs must not silently masquerade as the wood design.
  url.search=current.search;url.hash=current.hash;
  if(!url.searchParams.get('scheme'))url.searchParams.set('scheme','wood');
  url.searchParams.set('v',SCHEME_REVISION);
  return url.href;
}
export async function loadSchemeCatalog(){
  const response=await fetch(assetURL('models/design-schemes.json'));
  if(!response.ok)throw new Error('设计资料暂未载入');
  const catalog=await response.json();
  if(catalog.defaultScheme!=='wood'||catalog.schemes?.length!==2||catalog.schemes.map(s=>s.id).join(',')!=='wood,suite'||catalog.schemes.some(s=>!s.geometrySource)){
    throw new Error('设计目录与当前双布局版本不一致，请刷新重试');
  }
  return catalog;
}
if(document.querySelector('[data-layout-gallery]')){
  document.documentElement.dataset.uiRevision=SCHEME_REVISION;
  // Plain home visits stay on the chooser. Explicit bookmarks keep context.
  const current=new URL(location.href);
  if(current.searchParams.has('scheme')||current.hash)location.replace(entryURL(location.href));
}
