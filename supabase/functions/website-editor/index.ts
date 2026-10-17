import { normalizeDocument } from '../../../lib/editor-schema.mjs';
import config from '../../../lib/editor-config.json' with { type: 'json' };

const url = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers = { apikey:service, Authorization:`Bearer ${service}`, 'Content-Type':'application/json' };
const bucket = 'website-editor-media';
const pageKeys = ['v2','creators','courses','network','site'];
const uuid = (v:unknown) => typeof v==='string' && /^[0-9a-f-]{36}$/i.test(v);
function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
async function db(path:string,method='GET',body?:unknown){const r=await fetch(url+'/rest/v1/'+path,{method,headers:{...headers,Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.message||'Storage request failed'),{status:data.code==='40001'?409:500});return data;}
async function serviceRequest(req:Request,raw:string){
 const time=req.headers.get('x-gct-time')||'';if(!/^\d{10}$/.test(time)||Math.abs(Date.now()/1000-Number(time))>30)return false;
 try{const key=await crypto.subtle.importKey('spki',Uint8Array.from(atob(config.renderPublicKey),c=>c.charCodeAt(0)),{name:'Ed25519'},false,['verify']);const s=(req.headers.get('x-gct-signature')||'').replace(/-/g,'+').replace(/_/g,'/');return await crypto.subtle.verify('Ed25519',key,Uint8Array.from(atob(s),c=>c.charCodeAt(0)),new TextEncoder().encode(time+'\n'+raw));}catch{return false;}
}
async function user(req:Request){
 const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return null;
 const r=await fetch(url+'/auth/v1/user',{headers:{apikey:config.publishableKey,Authorization:auth}});if(!r.ok)return null;const u=await r.json();if(!u.email_confirmed_at)return null;
 let session;try{session=JSON.parse(atob(auth.slice(7).split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;}catch{return null;}
 if(!uuid(session))return null;
 const members=await db('rpc/website_editor_member','POST',{p_user:u.id,p_session:session});return members[0]?{...members[0],session_id:session}:null;
}
async function readBody(req:Request){const reader=req.body?.getReader();if(!reader)throw Object.assign(Error('Request body missing'),{status:400});let text='',size=0;const decoder=new TextDecoder();while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>800000){await reader.cancel();throw Object.assign(Error('Page is too large'),{status:413});}text+=decoder.decode(r.value,{stream:true});}return text+decoder.decode();}
Deno.serve(async(req:Request)=>{
 try{
  if(req.method!=='POST')return reply({error:'Use the website editor.'},405);
  const raw=await readBody(req);let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
  const {action,namespace,page}=body;
  if(typeof namespace!=='string'||!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(namespace)||!pageKeys.includes(page))return reply({error:'Page not found.'},400);
  if(action==='render'){
   if(!await serviceRequest(req,raw))return reply({error:'Private rendering access required.'},403);
   const rows=await db('website_editor_pages?namespace=eq.'+namespace+'&page=in.('+page+',site)&select=page,published');
   return reply({document:rows.find((x:any)=>x.page===page)?.published||{},site:rows.find((x:any)=>x.page==='site')?.published||{}});
  }
  const member=await user(req);if(!member)return reply({error:'This GCT account does not have website editing access.'},403);
  if(action==='load'){
   const rows=await db('website_editor_pages?namespace=eq.'+namespace+'&page=in.('+page+',site)');
   return reply({member:{user_id:member.user_id,role:member.role,email:member.email},page:rows.find((x:any)=>x.page===page)||{draft:{},published:{},version:0,published_version:0},site:rows.find((x:any)=>x.page==='site')||{draft:{},published:{},version:0,published_version:0}});
  }
  if(['save','publish','restore'].includes(action)){
   if(action==='publish'&&!['publisher','owner'].includes(member.role))return reply({error:'Publishing access is required.'},403);
   if(!Number.isSafeInteger(body.version)||body.version<0)return reply({error:'Reload the draft and try again.'},400);
   let document={};try{if(action==='save')document=normalizeDocument(body.document);}catch(e){return reply({error:(e as Error).message},400);}
   if(action==='restore'&&body.revision==='published'){
    const rows=await db('website_editor_pages?namespace=eq.'+namespace+'&page=eq.'+page+'&select=published,published_version');
    if(!rows[0]?.published_version)return reply({error:'This page has not been published yet.'},404);
    const saved=await db('rpc/website_editor_commit','POST',{p_namespace:namespace,p_page:page,p_expected:body.version,p_document:normalizeDocument(rows[0].published),p_action:'save',p_actor:member.user_id,p_session:member.session_id,p_revision:null});return reply({page:saved});
   }
   if(action==='restore'&&!uuid(body.revision))return reply({error:'Version not found.'},400);
   const saved=await db('rpc/website_editor_commit','POST',{p_namespace:namespace,p_page:page,p_expected:body.version,p_document:document,p_action:action,p_actor:member.user_id,p_session:member.session_id,p_revision:action==='restore'?body.revision:null});return reply({page:saved});
  }
  if(action==='history'){
   const [revisions,rows]=await Promise.all([db('website_editor_revisions?namespace=eq.'+namespace+'&page=eq.'+page+'&select=id,version,action,actor_email,created_at&order=created_at.desc&limit=100'),db('website_editor_pages?namespace=eq.'+namespace+'&page=eq.'+page+'&select=published_version,published_at')]);
   const published=rows[0]?.published_version?{id:'published',current:true,version:rows[0].published_version,action:'publish',actor_email:'Published website',created_at:rows[0].published_at}:null;
   return reply({revisions,published});
  }
  if(action==='media')return reply({media:(await db('website_editor_media?status=eq.ready&select=id,name,path,mime,size_bytes,created_at&order=created_at.desc&limit=200')).map((m:any)=>({...m,src:url+'/storage/v1/object/public/'+bucket+'/'+m.path}))});
  if(action==='upload'){
   const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','video/mp4':'mp4','video/webm':'webm'};
   if(typeof body.name!=='string'||body.name.length>180||!types[body.mime]||!Number.isSafeInteger(body.size)||body.size<1||body.size>26214400)return reply({error:'Choose a JPG, PNG, WebP, GIF, AVIF, MP4 or WebM under 25 MB.'},400);
   const id=crypto.randomUUID(),path=id+'.'+types[body.mime];
   const upload=await fetch(url+'/storage/v1/object/upload/sign/'+bucket+'/'+path,{method:'POST',headers,body:JSON.stringify({upsert:false})});const signed=await upload.json();if(!upload.ok)throw Error('Upload could not start. Try again.');
   await db('website_editor_media','POST',{id,name:body.name,path,mime:body.mime,size_bytes:body.size,uploaded_by:member.user_id});
   const signedPath=signed.url||signed.signedURL||signed.signedUrl;return reply({id,url:signedPath.startsWith('http')?signedPath:url+'/storage/v1'+signedPath,src:url+'/storage/v1/object/public/'+bucket+'/'+path});
  }
  if(action==='finish-upload'){
   if(!uuid(body.id))return reply({error:'Upload not found.'},400);const list=await db('website_editor_media?id=eq.'+body.id+'&uploaded_by=eq.'+member.user_id+'&status=eq.pending');const m=list[0];if(!m)return reply({error:'Upload not found.'},404);
   const r=await fetch(url+'/storage/v1/object/public/'+bucket+'/'+m.path,{headers:{Range:'bytes=0-63'}});if(!r.ok)return reply({error:'The upload did not finish. Try uploading again.'},400);const a=new Uint8Array(await r.arrayBuffer());const ascii=new TextDecoder().decode(a.slice(0,32));
   const valid=m.mime==='image/jpeg'?a[0]===255&&a[1]===216:m.mime==='image/png'?a[0]===137&&ascii.slice(1,4)==='PNG':m.mime==='image/webp'?ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP':m.mime==='image/gif'?ascii.startsWith('GIF8'):m.mime==='video/webm'?a[0]===26&&a[1]===69:ascii.includes('ftyp');
   if(!valid){await fetch(url+'/storage/v1/object/'+bucket,{method:'DELETE',headers,body:JSON.stringify({prefixes:[m.path]})});return reply({error:'That file is not a supported image or video.'},400);}
   await db('website_editor_media?id=eq.'+body.id,'PATCH',{status:'ready'});return reply({src:url+'/storage/v1/object/public/'+bucket+'/'+m.path});
  }
  return reply({error:'Action not found.'},404);
 }catch(e){const status=(e as any).status||500;return reply({error:status===409?'Someone saved a newer version. Reload the draft to avoid overwriting their work.':status===500?'The editor could not complete that request. Your unsaved work is still in this window.':(e as Error).message},status);}
});
