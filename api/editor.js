const {createCipheriv,createDecipheriv,createHash,randomBytes}=require('node:crypto');
const {readFile}=require('node:fs/promises');
const {join}=require('node:path');
const store=require('../lib/editor-store.cjs');
const modules=Promise.all([import('../lib/editor-schema.mjs'),import('../lib/editor-render.mjs')]);
const local=()=>process.env.GCT_PREVIEW_LOCAL_HTTP==='true'&&process.env.VERCEL!=='1';
const cookieName=()=>local()?'gct_editor':'__Host-gct_editor';
function key(){if(!process.env.GCT_EDITOR_RENDER_PRIVATE_KEY)throw Object.assign(Error('Editor access is not configured.'),{status:503});return createHash('sha256').update('gct-editor-cookie\0').update(process.env.GCT_EDITOR_RENDER_PRIVATE_KEY).digest();}
function seal(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const body=cipher.update(JSON.stringify(value),'utf8'),last=cipher.final();return[iv,body,last,cipher.getAuthTag()].map(b=>b.toString('base64url')).join('.');}
function unseal(token){try{const[iv,body,last,tag]=token.split('.').map(x=>Buffer.from(x,'base64url'));const decipher=createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(body),decipher.update(last),decipher.final()]).toString('utf8'));}catch{return null;}}
function setCookie(res,value,seconds=28800){res.setHeader('Set-Cookie',`${cookieName()}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${local()?'':'; Secure'}`);}
async function session(req,res){const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName()+'='))?.slice(cookieName().length+1);if(!token)throw Object.assign(Error('Sign in to edit the website.'),{status:401});const data=unseal(token);if(!data||data.until<Date.now())throw Object.assign(Error('Your editing session ended. Sign in again to continue.'),{status:401});if(data.expires_at<Date.now()/1000+30){const next=await store.auth('token?grant_type=refresh_token',{refresh_token:data.refresh_token});Object.assign(data,{access_token:next.access_token,refresh_token:next.refresh_token,expires_at:next.expires_at||Date.now()/1000+next.expires_in});setCookie(res,seal(data));}return data;}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));}
async function body(req){if(Number(req.headers['content-length'])>800000)throw Object.assign(Error('The page is too large.'),{status:413});if(!String(req.headers['content-type']).startsWith('application/json'))throw Object.assign(Error('Use the editor controls.'),{status:415});if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body)){if(JSON.stringify(req.body).length>800000)throw Object.assign(Error('The page is too large.'),{status:413});return req.body;}let raw=typeof req.body==='string'?req.body:'';if(!raw)for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>800000)throw Object.assign(Error('The page is too large.'),{status:413});}try{return JSON.parse(raw);}catch{throw Object.assign(Error('Please try that edit again.'),{status:400});}}
function checkOrigin(req){let origin;try{origin=new URL(req.headers.origin);}catch{}if(!origin||origin.host!==req.headers.host||origin.protocol!==(local()?'http:':'https:')||req.headers['sec-fetch-site']==='cross-site')throw Object.assign(Error('Open the editor on this website and try again.'),{status:403});}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Cookie');
 try{
 const url=new URL(req.url,'https://'+req.headers.host);const action=req.query?.action||url.searchParams.get('action')||'ui';const page=req.query?.page||url.searchParams.get('page')||'network';const[schema,render]=await modules;
 if(!Object.hasOwn(render.PAGES,page))return json(res,404,{error:'Page not found.'});
 if(!['GET','HEAD','POST'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
 if(action==='ui'&&req.method!=='POST'){
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; media-src 'self' https:; connect-src 'self' "+store.config.url+"; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(req.method==='HEAD'?'':await readFile(join(process.cwd(),'editor.html'),'utf8'));
 }
 if(action==='login'){
  if(req.method!=='POST')return json(res,405,{error:'Use the sign-in form.'});checkOrigin(req);const input=await body(req);if(typeof input.email!=='string'||typeof input.password!=='string'||input.email.length>254||input.password.length>256)return json(res,400,{error:'Enter your GCT email and password.'});
  const auth=await store.auth('token?grant_type=password',{email:input.email.trim(),password:input.password});
  let access;try{access=await store.call('load','network',{},auth.access_token);}catch(e){await store.auth('logout?scope=local',{},auth.access_token).catch(()=>{});throw e;}
  setCookie(res,seal({access_token:auth.access_token,refresh_token:auth.refresh_token,expires_at:auth.expires_at||Date.now()/1000+auth.expires_in,until:Date.now()+28800000}));return json(res,200,{member:access.member});
 }
 if(action==='logout'){if(req.method!=='POST')return json(res,405,{error:'Use the sign-out button.'});checkOrigin(req);try{const s=await session(req,res);await store.auth('logout?scope=local',{},s.access_token);}catch{}setCookie(res,'',0);return json(res,200,{ok:true});}
 const s=await session(req,res);
 if(action==='frame'&&req.method==='GET'){
  const loaded=await store.call('load',page,{},s.access_token);if(!loaded.page.version)loaded.page.draft=await render.committedDocument(page);if(!loaded.site.version)loaded.site.draft=await render.committedDocument('site');const output=await render.renderPage({page:page==='site'?'network':page,document:page==='site'?{}:loaded.page.draft,site:loaded.site.draft,edit:url.searchParams.get('mode')!=='preview'});
  res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; media-src 'self' https:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'none'");res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(render.protectedLinks(output.html.replace('<head>','<head><base href="/">'),page==='site'?'network':page));
 }
 if(['session','load','history','media','review-status'].includes(action)&&req.method==='GET'){
  const data=await store.call(action==='session'?'load':action,page,{},s.access_token);if(data.page&&!data.page.version)data.page.draft=await render.committedDocument(page);if(data.site&&!data.site.version)data.site.draft=await render.committedDocument('site');
  if(action==='session')return json(res,200,{member:data.member,pages:render.PAGES});
  if(action==='load')return json(res,200,{...data,document:schema.normalizeDocument(data.page.draft),global:schema.normalizeDocument(data.site.draft),pages:render.PAGES});
  if(action==='media'){const existing=JSON.parse(await readFile(join(process.cwd(),'data/editor-assets.json'),'utf8'));return json(res,200,{media:[...data.media,...existing]});}
  return json(res,200,data);
 }
 if(action==='publish')return json(res,409,{error:'Save to PR, then merge the pull request to update the website.'});
 if(action==='submit'&&req.method==='POST'){
  checkOrigin(req);const input=await body(req);const loaded=await store.call('load',page,{},s.access_token);
  const rendered=await render.renderPage({page:page==='site'?'network':page,document:loaded.page.draft,edit:false});
  if(page!=='site'&&(!loaded.page.draft.templateHash||rendered.stale))return json(res,409,{error:'The website layout changed. Reload the current website before sending these edits for review.'});
  return json(res,200,await store.call('submit',page,{version:input.version},s.access_token));
 }
 if(['save','restore','upload','finish-upload'].includes(action)&&req.method==='POST'){
  checkOrigin(req);const input=await body(req);
  if(action==='restore'&&input.revision==='build')return json(res,200,await store.call('save',page,{version:input.version,document:await render.committedDocument(page)},s.access_token));
  if(action==='save'){try{input.document=schema.normalizeDocument(input.document);}catch(e){return json(res,400,{error:e.message});}}
  const payload=Object.fromEntries(['version','document','revision','name','mime','size','id'].filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]]));
  return json(res,200,await store.call(action,page,payload,s.access_token));
 }
 return json(res,404,{error:'Editor action not found.'});
 }catch(e){return json(res,e.status||503,{error:e.status?e.message:'The editor could not connect. Your unsaved changes are still in this window. Try again.'});}
};
module.exports._test={seal,unseal,session,checkOrigin};
module.exports.sessionForPreview=session;
