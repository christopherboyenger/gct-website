export const PAGE_KEYS = ['v2','creators','courses','network'];
export const FONTS = ['Geist','Inter','Manrope','DM Sans','Georgia','Arial'];
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const plain = o => o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;
export function safeURL(value, media=false) {
  if (typeof value !== 'string' || value.length > 2048 || /[\x00-\x20\\<>"']/.test(value)) return false;
  if (/^(?:\/(?!\/)|#|assets\/|gct-(?:v2|creators|courses|network)\.html(?:#|$)|appfavicon\.jpg$)/.test(value)) return true;
  try { const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password || !media && ['mailto:','tel:'].includes(u.protocol); } catch {return false;}
}
function str(v,max,label){if(typeof v!=='string'||v.length>max)throw Error('Invalid '+label);return v;}
const color = v => typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v);
const id = v => typeof v==='string' && /^[a-z][a-z0-9_-]{0,89}$/i.test(v) && !['__proto__','constructor','prototype'].includes(v);
const numeric = {fontSize:[8,160],fontWeight:[300,900],letterSpacing:[-5,20],lineHeight:[.8,3],paddingTop:[0,240],paddingBottom:[0,240],paddingLeft:[0,160],paddingRight:[0,160],borderRadius:[0,100],width:[16,1600],height:[16,1200],opacity:[.1,1]};
export function normalizeStyle(input={}){
  if(!plain(input))throw Error('Invalid style');const out={};
  for(const[k,v]of Object.entries(input)){
    if(own(numeric,k)){if(!Number.isFinite(v)||v<numeric[k][0]||v>numeric[k][1])throw Error('Invalid '+k);out[k]=v;}
    else if(['color','backgroundColor'].includes(k)){if(!color(v))throw Error('Use a six-digit color');out[k]=v;}
    else if(k==='fontFamily'){if(!FONTS.includes(v))throw Error('Choose a supported font');out[k]=v;}
    else if(k==='textAlign'){if(!['left','center','right'].includes(v))throw Error('Invalid alignment');out[k]=v;}
    else if(k==='objectFit'){if(!['cover','contain'].includes(v))throw Error('Invalid image fit');out[k]=v;}
    else if(k==='objectPosition'){if(!/^\d{1,3}% \d{1,3}%$/.test(v)||v.split(' ').some(n=>parseInt(n)>100))throw Error('Invalid focal point');out[k]=v;}
    else throw Error('Unsupported style '+k);
  }return out;
}
export function normalizeDocument(input={}){
 if(!plain(input)||JSON.stringify(input).length>700000)throw Error('The page is too large');
 const out={schema:1,templateHash:'',elements:{},theme:{},meta:{},sections:{order:[],hidden:[],copies:[]}};
 if(input.templateHash!==undefined)out.templateHash=str(input.templateHash,64,'template version');
 if(input.elements!==undefined){if(!plain(input.elements)||Object.keys(input.elements).length>2500)throw Error('Too many edits');
 for(const[key,value]of Object.entries(input.elements)){if(!id(key)||!plain(value))throw Error('Invalid element');const e={};
 for(const[k,v]of Object.entries(value)){
 if(k==='text')e.text=str(v,15000,'text');
 else if(k==='href'||k==='src'||k==='poster'){if(!safeURL(v,k!=='href'))throw Error('Use a valid link or website asset');e[k]=v;}
 else if(k==='alt')e.alt=str(v,500,'image description');
 else if(k==='placeholder')e.placeholder=str(v,250,'placeholder');
 else if(k==='style'||k==='mobileStyle')e[k]=normalizeStyle(v);
 else if(['autoplay','loop','muted'].includes(k)){if(typeof v!=='boolean')throw Error('Invalid video setting');e[k]=v;}
 else throw Error('Unsupported element setting');
 }out.elements[key]=e;}}
 if(input.theme!==undefined){if(!plain(input.theme))throw Error('Invalid site style');for(const[k,v]of Object.entries(input.theme)){
 if(['font','headingFont'].includes(k)){if(!FONTS.includes(v))throw Error('Choose a supported font');out.theme[k]=v;}
 else if(['background','textColor','accent','buttonColor','buttonTextColor'].includes(k)){if(!color(v))throw Error('Use a six-digit color');out.theme[k]=v;}
 else if(k==='buttonRadius'){if(!Number.isFinite(v)||v<0||v>100)throw Error('Invalid button corners');out.theme[k]=v;}
 else if(k==='logoSrc'){if(!safeURL(v,true))throw Error('Use a valid logo image');out.theme[k]=v;}
 else if(k==='logoText')out.theme[k]=str(v,20,'logo text');
 else if(['logoSize','logoTextSize','logoLetterSpacing'].includes(k)){if(!Number.isFinite(v)||v<0||v>(k==='logoLetterSpacing'?20:120))throw Error('Invalid logo size');out.theme[k]=v;}
 else throw Error('Unsupported site style');}}
 if(input.meta!==undefined){if(!plain(input.meta))throw Error('Invalid page settings');for(const[k,v]of Object.entries(input.meta)){
 if(['title','shareTitle'].includes(k))out.meta[k]=str(v,160,k);
 else if(['description','shareDescription'].includes(k))out.meta[k]=str(v,400,k);
 else if(['shareImage','favicon','canonical'].includes(k)){if(v!==''&&!safeURL(v,true))throw Error('Use a valid image or page URL');out.meta[k]=v;}
 else if(k==='noindex'){if(typeof v!=='boolean')throw Error('Invalid indexing');out.meta[k]=v;}
 else throw Error('Unsupported page setting');}}
 if(input.sections!==undefined){if(!plain(input.sections))throw Error('Invalid sections');for(const k of ['order','hidden']){const list=input.sections[k]||[];if(!Array.isArray(list)||list.length>100||list.some(x=>!id(x))||new Set(list).size!==list.length)throw Error('Invalid section order');out.sections[k]=list;}
 const copies=input.sections.copies||[];if(!Array.isArray(copies)||copies.length>10)throw Error('Too many section copies');out.sections.copies=copies.map(c=>{if(!plain(c)||!id(c.source)||!/^copy-[a-z0-9]{6,16}$/.test(c.id))throw Error('Invalid section copy');return{source:c.source,id:c.id};});if(new Set(out.sections.copies.map(c=>c.id)).size!==copies.length)throw Error('Duplicate section copy');}
 return out;
}
export function blankDocument(){return normalizeDocument({});}
