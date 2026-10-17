import {parseHTML} from 'linkedom';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {normalizeDocument} from './editor-schema.mjs';
export const PAGES={v2:{file:'gct-v2.html',name:'Brands / Homepage',route:'/preview/v2'},creators:{file:'gct-creators.html',name:'Creators',route:'/preview/creators'},courses:{file:'gct-courses.html',name:'Courses & destinations',route:'/preview/courses'},network:{file:'gct-network.html',name:'Current website',route:'/preview'},site:{file:'gct-v2.html',name:'Site-wide styles',route:'/preview/v2'}};
const tags='header,footer,main > section,h1,h2,h3,h4,p,a,button,small,summary,label,li,img,video,span,input,textarea';
const px=new Set(['fontSize','letterSpacing','paddingTop','paddingBottom','paddingLeft','paddingRight','borderRadius','width','height']);
const kebab=s=>s==='backgroundColor'?'background':s.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function pathOf(node){const parts=[];while(node?.parentElement){const peers=[...node.parentElement.children];parts.unshift(node.localName+':'+peers.indexOf(node));node=node.parentElement;}return parts.join('/');}
function nodeId(node){return 'n'+createHash('sha256').update(pathOf(node)).digest('hex').slice(0,12);}
function textOf(e){return [...e.childNodes].map(n=>n.nodeType===3?n.textContent:n.localName==='br'?'\n':n.getAttribute?.('aria-hidden')==='true'||n.localName==='svg'?'':n.textContent).join('').trim();}
function canEditText(e){return !e.classList.contains('wordmark')&&['h1','h2','h3','h4','p','a','button','small','summary','label','li','span'].includes(e.localName)&&Boolean(textOf(e))&&![...e.children].some(c=>!['br','svg','b','strong','em','i','span'].includes(c.localName)||c.localName==='span'&&c.querySelector('img,video,button,a,input'))&&!e.querySelector('a,button,input,textarea,select');}
function setText(e,text,doc){const keep=[...e.childNodes].filter(n=>n.localName==='svg'||n.getAttribute?.('aria-hidden')==='true');e.replaceChildren();text.split('\n').forEach((line,i)=>{if(i)e.appendChild(doc.createElement('br'));e.appendChild(doc.createTextNode(line));});keep.forEach(n=>e.appendChild(n));}
function declarations(style){return Object.entries(style||{}).map(([k,v])=>kebab(k)+':'+(k==='fontFamily'?JSON.stringify(v):v)+(px.has(k)?'px':'')+'!important').join(';');}
export function themeCSS(theme={}){
 let css='';if(theme.font)css+='body,h1,h2,h3,h4,p,a,button,input,select,textarea{font-family:'+JSON.stringify(theme.font)+',sans-serif!important}';
 if(theme.headingFont)css+='h1,h2,h3,h4{font-family:'+JSON.stringify(theme.headingFont)+',serif!important}';
 if(theme.background)css+='body{background:'+theme.background+'!important}';
 if(theme.textColor)css+=':root{--ink:'+theme.textColor+'}body{color:'+theme.textColor+'!important}';
 if(theme.accent)css+=':root{--blue:'+theme.accent+'}';
 if(theme.buttonColor)css+='.button:not(.light):not(.white){background:'+theme.buttonColor+'!important}';
 if(theme.buttonTextColor)css+='.button:not(.light):not(.white){color:'+theme.buttonTextColor+'!important}';
 if(theme.buttonRadius!==undefined)css+='.button{border-radius:'+theme.buttonRadius+'px!important}';
 if(theme.logoSize!==undefined)css+='.site-header .brand-crest{width:'+theme.logoSize+'px!important}';
 if(theme.logoTextSize!==undefined)css+='.site-header .wordmark{font-size:'+theme.logoTextSize+'px!important}';
 if(theme.logoLetterSpacing!==undefined)css+='.site-header .wordmark{letter-spacing:'+theme.logoLetterSpacing+'px!important}';return css;
}
function meta(doc,key,value,property=false){let el=doc.head.querySelector('meta['+(property?'property':'name')+'="'+key+'"]');if(!el){el=doc.createElement('meta');el.setAttribute(property?'property':'name',key);doc.head.appendChild(el);}el.setAttribute('content',value);}
export async function renderPage({page,document:input={},site:globalInput={},edit=false,source}){
 if(!PAGES[page])throw Error('Page not found');const html=source??await readFile(join(process.cwd(),PAGES[page].file),'utf8');
 const templateHash=createHash('sha256').update('gct-editor-template-v1').update(html).digest('hex');let data=normalizeDocument(input),global=normalizeDocument(globalInput);
 const stale=Boolean(data.templateHash&&data.templateHash!==templateHash);if(stale)data=normalizeDocument({});
 const {document:doc}=parseHTML(html);const nodes=[];const editableParents=new Set();
 for(const label of doc.querySelectorAll('label,p,li'))if(label.querySelector('input,textarea,select,a,button'))for(const n of [...label.childNodes])if(n.nodeType===3&&n.textContent.trim()){const s=doc.createElement('span');s.textContent=n.textContent;n.replaceWith(s);}
 for(const e of doc.querySelectorAll(tags)){
  if(e.closest('svg,dialog,[aria-hidden="true"]')||e.localName==='span'&&e.closest('.brand-crest')||e.closest('.skip-link'))continue;
  if([...editableParents].some(parent=>parent!==e&&parent.contains(e)))continue;
  const text=canEditText(e);if(text)editableParents.add(e);
  const id=nodeId(e);e.setAttribute('data-gct-id',id);e.setAttribute('data-gct-text',String(text));
  nodes.push(e);
 }
 let sections=[...doc.querySelectorAll('main > section')];
 for(const copy of data.sections.copies){const original=sections.find(e=>e.getAttribute('data-gct-id')===copy.source);if(!original||original.querySelector('form,[role=tablist]'))continue;const clone=original.cloneNode(true);const map=new Map();for(const el of [clone,...clone.querySelectorAll('*')]){if(el.id){map.set(el.id,el.id+'-'+copy.id);el.id=el.id+'-'+copy.id;}const id=el.getAttribute('data-gct-id');if(id){el.setAttribute('data-gct-id',id+'-'+copy.id);nodes.push(el);}}for(const el of clone.querySelectorAll('[href],[aria-controls],[aria-labelledby]')){for(const a of ['aria-controls','aria-labelledby']){if(map.has(el.getAttribute(a)))el.setAttribute(a,map.get(el.getAttribute(a)));}const href=el.getAttribute('href');if(href?.startsWith('#')&&map.has(href.slice(1)))el.setAttribute('href','#'+map.get(href.slice(1)));}original.after(clone);sections.push(clone);}
 const nodeMap=new Map(nodes.map(e=>[e.getAttribute('data-gct-id'),e]));
 const originals=Object.fromEntries([...nodeMap].map(([id,e])=>[id,{text:e.getAttribute('data-gct-text')==='true'?textOf(e):null,href:e.getAttribute('href'),src:e.getAttribute('data-video')||e.getAttribute('src'),alt:e.getAttribute('alt'),poster:e.getAttribute('poster'),placeholder:e.getAttribute('placeholder'),style:e.getAttribute('style')||''}]));
 const theme={...global.theme,...data.theme};let css=themeCSS(theme);
 if(theme.logoSrc)for(const img of doc.querySelectorAll('.site-header .brand-crest img')){img.setAttribute('src',theme.logoSrc);img.setAttribute('style','position:static;max-width:100%;width:100%;height:100%;object-fit:contain;filter:none');}
 if(theme.logoText!==undefined)for(const t of doc.querySelectorAll('.site-header .wordmark > span:last-child'))setText(t,theme.logoText,doc);
 for(const[id,patch]of Object.entries(data.elements)){
  const el=nodeMap.get(id);if(!el)continue;
  if(patch.text!==undefined&&el.getAttribute('data-gct-text')==='true')setText(el,patch.text,doc);
  if(patch.href!==undefined&&el.localName==='a')el.setAttribute('href',patch.href);
  if(patch.src!==undefined){if(el.hasAttribute('data-video'))el.setAttribute('data-video',patch.src);else if(['img','video'].includes(el.localName)){const previous=el.getAttribute('src');el.setAttribute('src',patch.src);if(el.localName==='img'){for(const mirror of doc.querySelectorAll('img[aria-hidden=true], [aria-hidden=true] img'))if(mirror.getAttribute('src')===previous)mirror.setAttribute('src',patch.src);if(el.closest('.brand-crest'))el.setAttribute('style','position:static;max-width:100%;width:100%;height:100%;object-fit:contain;filter:none');}}}
  if(patch.alt!==undefined&&el.localName==='img')el.setAttribute('alt',patch.alt);
  if(patch.placeholder!==undefined&&['input','textarea'].includes(el.localName))el.setAttribute('placeholder',patch.placeholder);
  if(patch.poster!==undefined){if(el.localName==='video')el.setAttribute('poster',patch.poster);else if(el.hasAttribute('data-video'))el.closest('article')?.querySelector('img')?.setAttribute('src',patch.poster);}
  for(const key of ['autoplay','loop','muted'])if(patch[key]!==undefined&&el.localName==='video'){if(patch[key])el.setAttribute(key,'');else el.removeAttribute(key);}
  css+='html [data-gct-id="'+id+'"][data-gct-id]{'+declarations(patch.style)+'}';
  if(patch.mobileStyle)css+='@media(max-width:767px){[data-gct-id="'+id+'"][data-gct-id]{'+declarations(patch.mobileStyle)+'}}';
 }
 const hidden=new Set(data.sections.hidden);for(const e of sections)if(hidden.has(e.getAttribute('data-gct-id'))){e.hidden=true;e.setAttribute('data-gct-hidden','true');}
 const ordered=data.sections.order.map(id=>sections.find(e=>e.getAttribute('data-gct-id')===id)).filter(Boolean);if(ordered.length){const first=doc.querySelector('main > section');const marker=doc.createComment('section order');first.before(marker);for(const e of [...ordered,...sections.filter(e=>!ordered.includes(e))])marker.before(e);marker.remove();}
 const defaults={title:doc.title,description:doc.head.querySelector('meta[name=description]')?.getAttribute('content')||'',shareTitle:doc.head.querySelector('meta[property="og:title"]')?.getAttribute('content')||'',shareDescription:doc.head.querySelector('meta[property="og:description"]')?.getAttribute('content')||'',shareImage:'',canonical:'',noindex:true,favicon:doc.head.querySelector('link[rel=icon]')?.getAttribute('href')||''};
 const settings={...defaults,...data.meta};doc.title=settings.title;meta(doc,'description',settings.description);meta(doc,'og:title',settings.shareTitle||settings.title,true);meta(doc,'og:description',settings.shareDescription||settings.description,true);meta(doc,'twitter:card','summary_large_image');if(settings.shareImage){meta(doc,'og:image',settings.shareImage,true);meta(doc,'twitter:image',settings.shareImage);}if(settings.canonical){let l=doc.head.querySelector('link[rel=canonical]');if(!l){l=doc.createElement('link');l.setAttribute('rel','canonical');doc.head.appendChild(l);}l.setAttribute('href',settings.canonical);meta(doc,'og:url',settings.canonical,true);}if(settings.noindex)meta(doc,'robots','noindex,nofollow');
 const favicon=data.meta.favicon||global.meta.favicon;if(favicon)doc.head.querySelector('link[rel=icon]')?.setAttribute('href',favicon);
 const style=doc.createElement('style');style.id='gct-editor-overrides';style.textContent=css;doc.head.appendChild(style);
 const fonts=new Set([global.theme.font,global.theme.headingFont,data.theme.font,data.theme.headingFont,...Object.values(data.elements).map(e=>e.style?.fontFamily)].filter(f=>f&&!['Georgia','Arial','Geist'].includes(f)));if(fonts.size){const link=doc.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?'+[...fonts].map(f=>'family='+encodeURIComponent(f)+':wght@400;500;600;700').join('&')+'&display=swap';doc.head.appendChild(link);}
 if(edit){
  doc.querySelectorAll('script').forEach(e=>e.remove());
  const manifest={page,templateHash,stale,defaults,document:{...data,templateHash},site:global,items:[...nodeMap].map(([id,e])=>({id,tag:e.localName,text:e.getAttribute('data-gct-text')==='true'?textOf(e):null,label:(textOf(e)||e.getAttribute('alt')||e.localName).slice(0,90),href:e.localName==='a'?e.getAttribute('href'):null,src:e.getAttribute('data-video')||(['img','video'].includes(e.localName)?e.getAttribute('src'):null),poster:e.localName==='video'?e.getAttribute('poster'):e.hasAttribute('data-video')?e.closest('article')?.querySelector('img')?.getAttribute('src'):null,alt:e.localName==='img'?e.getAttribute('alt'):null,placeholder:e.getAttribute('placeholder'),type:e.hasAttribute('data-video')||e.localName==='video'?'video':e.localName==='img'?'image':e.localName==='a'?'link':'text'})),sections:[...doc.querySelectorAll('main > section')].map(e=>({id:e.getAttribute('data-gct-id'),title:e.querySelector('h1,h2,h3')?.textContent||'Content section',hidden:e.hidden,canDuplicate:!e.querySelector('form,[role=tablist]')}))};
  manifest.originals=originals;
  const json=doc.createElement('script');json.id='gct-editor-manifest';json.type='application/json';json.textContent=JSON.stringify(manifest).replace(/</g,'\\u003c');doc.body.appendChild(json);
  const s=doc.createElement('script');s.src='/assets/editor-frame.js';s.defer=true;doc.body.appendChild(s);
  const c=doc.createElement('link');c.rel='stylesheet';c.href='/assets/editor-frame.css';doc.head.appendChild(c);
 }
 return{html:doc.toString(),templateHash,stale};
}
export function protectedLinks(html,page){return html.replaceAll('href="gct-network.html','href="/preview').replaceAll('href="gct-courses.html','href="/preview/courses').replaceAll('href="gct-creators.html','href="/preview/creators').replaceAll('href="gct-v2.html','href="/preview/v2').replaceAll('href="#','href="'+PAGES[page].route+'#');}
