// Turns saved editor documents into a readable change log. Shared by the editor
// backend (session log) and the review workflow (pull request summary).
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
const keys=(...objects)=>[...new Set(objects.flatMap(o=>Object.keys(plain(o)?o:{})))];
function canonical(v){return Array.isArray(v)?'['+v.map(canonical).join(',')+']':plain(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v??null);}
export const same=(a,b)=>canonical(a)===canonical(b);
const STYLE={fontSize:'text size',fontWeight:'weight',letterSpacing:'letter spacing',lineHeight:'line height',paddingTop:'space above',paddingBottom:'space below',paddingLeft:'space left',paddingRight:'space right',borderRadius:'corner rounding',width:'width',height:'height',opacity:'opacity',color:'text color',backgroundColor:'background',fontFamily:'font',textAlign:'alignment',objectFit:'image fit',objectPosition:'image focus'};
const THEME={font:'body font',headingFont:'heading font',background:'page background',textColor:'text color',accent:'accent color',buttonColor:'button background',buttonTextColor:'button text color',buttonRadius:'button rounding',logoSrc:'header crest image',logoText:'header text',logoSize:'crest width',logoTextSize:'header text size',logoLetterSpacing:'header letter spacing'};
const META={title:'page title',description:'page description',shareTitle:'social sharing title',shareDescription:'social sharing description',shareImage:'social sharing image',canonical:'canonical address',noindex:'hide from search',favicon:'website icon'};
const NOUN={text:'text',link:'button',image:'image',video:'video',section:'section'};
const clip=(v,n=140)=>{const s=String(v).replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
const quote=v=>v===undefined||v===null||v===''?'(empty)':'“'+clip(v)+'”';
const value=v=>v===undefined||v===null?'original':typeof v==='boolean'?(v?'on':'off'):clip(v,100);

export function diffDocuments(before,after){
 const a=plain(before)?before:{},b=plain(after)?after:{},out=[];
 // Edits made on an older page layout can't be compared element by element.
 const reset=Boolean(a.templateHash&&b.templateHash&&a.templateHash!==b.templateHash);
 if(reset)out.push({key:'layout',area:'layout',before:Object.keys(a.elements||{}).length+(a.sections?.hidden?.length||0)+(a.sections?.copies?.length||0),after:0});
 const ae=reset?{}:a.elements||{},be=b.elements||{};
 for(const id of keys(ae,be))for(const field of keys(ae[id],be[id]))if(!same(ae[id]?.[field],be[id]?.[field]))out.push({key:'element:'+id+':'+field,area:'element',id,field,before:ae[id]?.[field],after:be[id]?.[field]});
 for(const area of ['theme','meta'])for(const field of keys(a[area],b[area]))if(!same(a[area]?.[field],b[area]?.[field]))out.push({key:area+':'+field,area,field,before:a[area]?.[field],after:b[area]?.[field]});
 const as=reset?{}:a.sections||{},bs=b.sections||{};
 for(const field of ['order','hidden','copies'])if(!same(as[field]||[],bs[field]||[]))out.push({key:'sections:'+field,area:'sections',field,before:as[field]||[],after:bs[field]||[]});
 return out;
}

// Labels arrive with the save request, so only short, known fields are kept.
function label(labels,id){
 const copy=/-copy-[a-z0-9]+$/.test(id),l=labels[id]||copy&&labels[id.replace(/-copy-[a-z0-9]+$/,'')];
 if(!plain(l)||!Object.hasOwn(NOUN,l.type))return null;
 return{type:l.type,text:clip(l.text||'',80),section:clip(l.section||'',60),...(copy?{copy:true}:{})};
}
function where(l){
 if(!l)return'a page element';
 return(l.text?NOUN[l.type]+' '+quote(l.text):'a '+NOUN[l.type])+(l.section&&l.section!==l.text?' in “'+l.section+'”':'')+(l.copy?' (duplicated section)':'');
}
function section(c,id){return c.names?.[id]?'“'+c.names[id]+'”':'a section';}
export function describeChange(c,page){
 const l=c.label,w=where(l),reset=c.after===undefined||c.after===null;
 if(c.area==='layout')return'Started a fresh draft on the updated page layout'+(c.before?' ('+c.before+' earlier edit'+(c.before===1?'':'s')+' set aside and kept in version history)':'');
 if(c.area==='element'){
  if(c.field==='text')return reset?'Reset '+w+' to its original wording':'Changed text'+(l?.section?' in “'+l.section+'”':'')+': '+(c.before!==undefined?quote(c.before):l?.text?quote(l.text):'original text')+' → '+quote(c.after);
  if(c.field==='href')return reset?'Reset the link on '+w:'Changed the link on '+w+(c.before?' from '+clip(c.before,100):'')+' to '+clip(c.after,100);
  if(c.field==='src')return reset?'Restored the original '+(l?.type==='video'?'video':'image')+' for '+w:'Replaced '+w+' with '+clip(c.after,100);
  if(c.field==='poster')return reset?'Restored the original thumbnail for '+w:'Changed the thumbnail for '+w+' to '+clip(c.after,100);
  if(c.field==='alt'||c.field==='placeholder'){const name=c.field==='alt'?'image description':'placeholder';return reset?'Reset the '+name+' on '+w:'Changed the '+name+' on '+w+': '+(c.before===undefined?'original':quote(c.before))+' → '+quote(c.after);}
  if(['autoplay','loop','muted'].includes(c.field))return reset?'Reset '+c.field+' for '+w:'Turned '+c.field+' '+value(c.after)+' for '+w;
  if(c.field==='style'||c.field==='mobileStyle'){const b=plain(c.before)?c.before:{},a=plain(c.after)?c.after:{},parts=keys(b,a).filter(k=>!same(b[k],a[k])).map(k=>(STYLE[k]||k)+' '+value(b[k])+' → '+value(a[k]));return'Changed '+(c.field==='mobileStyle'?'mobile ':'')+'styling of '+w+': '+parts.join(', ');}
 }
 if(c.area==='theme')return'Changed '+(page==='site'?'site-wide ':'page ')+(THEME[c.field]||c.field)+': '+value(c.before)+' → '+value(c.after);
 if(c.area==='meta')return'Changed '+(META[c.field]||c.field)+': '+(['title','description','shareTitle','shareDescription'].includes(c.field)?(c.before===undefined?'original':quote(c.before))+' → '+(c.after===undefined?'original':quote(c.after)):value(c.before)+' → '+value(c.after));
 if(c.area==='sections'){
  if(c.field==='order')return'Reordered the page sections';
  const key=x=>c.field==='copies'?x?.id:x,source=x=>c.field==='copies'?x?.source:x,before=(c.before||[]).map(key),after=(c.after||[]).map(key);
  const verbs=c.field==='hidden'?['Hid section ','Showed section ']:['Duplicated section ','Removed a duplicate of section '];
  return[...(c.after||[]).filter(x=>!before.includes(key(x))).map(x=>verbs[0]+section(c,source(x))),...(c.before||[]).filter(x=>!after.includes(key(x))).map(x=>verbs[1]+section(c,source(x)))].join('; ')||'Updated the page sections';
 }
 return'Changed '+c.key;
}

// Combines one editing session's saves: each field keeps its first "before" and
// latest "after", and edits that end where they started drop out.
export function mergeChanges(previous,next,labels,page){
 const fresh=next.some(c=>c.area==='layout'),map=new Map();labels=plain(labels)?labels:{};
 for(const c of Array.isArray(previous)?previous:[])if(plain(c)&&typeof c.key==='string'&&!(fresh&&['element','sections'].includes(c.area)))map.set(c.key,{...c});
 for(const c of next){const prior=map.get(c.key);map.set(c.key,prior?{...prior,after:c.after}:{...c});}
 const out=[];
 for(const c of map.values()){
  if(same(c.before,c.after))continue;
  if(c.area==='element'){const l=label(labels,c.id);if(l)c.label=l;}
  if(c.area==='sections')for(const x of [...(c.before||[]),...(c.after||[])]){const id=c.field==='copies'?x.source:x,l=label(labels,id);if(l)c.names={...c.names,[id]:l.text||l.section};}
  c.text=describeChange(c,page);out.push(c);
 }
 return out;
}
