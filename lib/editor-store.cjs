const crypto = require('node:crypto');
const config = require('./editor-config.json');
const endpoint = config.url + '/functions/v1/website-editor';
function namespace(){return process.env.GCT_EDITOR_NAMESPACE || (process.env.VERCEL_ENV==='production'?'production':'gct-preview-v2');}
async function call(action,page,body={},token){
 const raw=JSON.stringify({action,page,namespace:namespace(),...body});
 const headers={'Content-Type':'application/json',apikey:config.publishableKey};
 if(token)headers.Authorization='Bearer '+token;
 else{
  if(!process.env.GCT_EDITOR_RENDER_PRIVATE_KEY)throw Object.assign(Error('Editor access is not configured.'),{status:503});
  headers['x-gct-time']=String(Math.floor(Date.now()/1000));
  headers['x-gct-signature']=crypto.sign(null,Buffer.from(headers['x-gct-time']+'\n'+raw),process.env.GCT_EDITOR_RENDER_PRIVATE_KEY).toString('base64url');
 }
 const r=await fetch(endpoint,{method:'POST',headers,body:raw,signal:AbortSignal.timeout(8000)});
 const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'The editor could not load.'),{status:r.status});return data;
}
async function auth(path,body,token){
 const r=await fetch(config.url+'/auth/v1/'+path,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 const result=await r.json().catch(()=>({}));
 if(!r.ok){
  const code=result.error_code||result.code;
  let message='The GCT sign-in service could not complete this request. Try again shortly.',status=503;
  if(path.includes('grant_type=refresh_token')){message='Your editing session ended. Sign in again to continue.';status=401;}
  else if(code==='invalid_credentials'){message='The email or GCT password did not match. Clear any autofilled password and type the password you use in the GCT app.';status=401;}
  else if(code==='email_not_confirmed'){message='Confirm your GCT account email before signing in.';status=403;}
  else if(r.status===429){message='Too many sign-in attempts. Wait a few minutes before trying again.';status=429;}
  throw Object.assign(Error(message),{status});
 }
 return result;
}
module.exports={call,auth,namespace,config};
