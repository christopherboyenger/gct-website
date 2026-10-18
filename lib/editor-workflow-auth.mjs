const issuer='https://token.actions.githubusercontent.com';
const repository='christopherboyenger/gct-website';
const workflow='.github/workflows/website-editor-pr.yml';
const refs=['refs/heads/main','refs/heads/codex/website-editor-pr-sync'];
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
let cachedKeys,keysUntil=0;
export async function verifyWorkflowToken(token,{fetcher=fetch,now=Date.now()/1000}={}){
 try{
  if(typeof token!=='string'||token.length>16000)return null;
  const [h,p,s,...extra]=token.split('.');if(extra.length||!s)return null;
  const head=JSON.parse(new TextDecoder().decode(decode(h))),claims=JSON.parse(new TextDecoder().decode(decode(p)));
  if(head.alg!=='RS256'||typeof head.kid!=='string'||claims.iss!==issuer||claims.aud!=='gct-website-editor-pr'||claims.repository!==repository||String(claims.repository_id)!=='1229342397'||String(claims.repository_owner_id)!=='269604875'||!refs.includes(claims.ref)||claims.workflow_ref!==repository+'/'+workflow+'@'+claims.ref||!['schedule','workflow_dispatch','push'].includes(claims.event_name)||!Number.isFinite(claims.exp)||!Number.isFinite(claims.iat)||claims.exp<=now||claims.iat>now+30||claims.iat<now-900||claims.exp-claims.iat>900||claims.nbf&&claims.nbf>now+30)return null;
  // URL is fixed; JWT headers cannot redirect key discovery.
  if(!cachedKeys||keysUntil<Date.now()||fetcher!==fetch){const r=await fetcher(issuer+'/.well-known/jwks',{signal:AbortSignal.timeout(5000)});if(!r.ok)return null;cachedKeys=(await r.json()).keys;keysUntil=Date.now()+300000;}
  const jwk=cachedKeys?.find(k=>k.kid===head.kid&&k.kty==='RSA');if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(s),new TextEncoder().encode(h+'.'+p))?claims:null;
 }catch{return null;}
}
