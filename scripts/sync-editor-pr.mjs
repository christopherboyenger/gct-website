import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {normalizeDocument,PAGE_KEYS,canonicalTemplate} from '../lib/editor-schema.mjs';
import {PAGES,committedDocument,templateLabels} from '../lib/editor-render.mjs';
import {diffDocuments,mergeChanges} from '../lib/editor-changes.mjs';
import config from '../lib/editor-config.json' with {type:'json'};

const repo='christopherboyenger/gct-website',api='https://api.github.com/repos/'+repo;
// The repository is public: name editors without their email domain, escape Markdown and
// keep website copy such as "@handle" or "#1" from mentioning people or linking issues.
const editor=email=>String(email||'').split('@')[0]||'an editor';
const md=s=>String(s).replace(/[\\`*_[\]<>|~]/g,'\\$&').replace(/([@#])(?=\w)/g,'$1\u200b');
async function summary(row,document,source){
 const live=await committedDocument(row.page).catch(()=>({}));
 const before=row.page==='site'||live.templateHash===document.templateHash?live:{templateHash:document.templateHash};
 const lines=mergeChanges([],diffDocuments(before,document),row.page==='site'?{}:await templateLabels(row.page,source),row.page).map(c=>'- '+md(c.text));
 return'### '+PAGES[row.page].name+'\n_Last saved by '+md(editor(row.submitted_email))+'._\n\n'+(lines.length?(lines.length>25?[...lines.slice(0,25),'- …and '+(lines.length-25)+' more (see the content file)']:lines).join('\n'):'- No differences from the live website.');
}
export async function syncEditorReviews({github,backend}){
 const {submissions}=await backend('review-pending');
 const groups=Map.groupBy(submissions,s=>s.namespace);
 const results=[];
 for(const [namespace,rows]of groups){
  if(!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(namespace))continue;
  const branch='codex/editor-content-'+namespace,active=[],stale=[];
  for(const row of rows){
   if(row.pr_number){
    const old=await github('/pulls/'+row.pr_number);
    if(old.merged||old.state==='closed'){
     const status=old.merged?'merged':'closed';
     if(row.status==='in_pr'){await backend('review-result',{id:row.id,status,pr_number:old.number,pr_url:old.html_url,branch,commit_sha:old.head.sha});continue;}
     // Newer saves arrived after that PR finished; record its outcome and open a new PR for them.
     await backend('review-pr',{pr_number:old.number,status});
    }
   }
   active.push(row);
  }
  if(!active.some(s=>['queued','error'].includes(s.status)))continue;
  try{
   const main=await github('/git/ref/heads/main'),base=await github('/git/commits/'+main.object.sha);
   const tree=[],ready=[],sections=[];
   for(const row of active){
    if(![...PAGE_KEYS,'site'].includes(row.page))throw Error('Unsupported website page.');
    const document=normalizeDocument(row.document),file='gct-'+(row.page==='site'?'network':row.page)+'.html';
    const source=Buffer.from((await github('/contents/'+file+'?ref='+main.object.sha)).content,'base64').toString('utf8');
    const hash=createHash('sha256').update(canonicalTemplate(source)).digest('hex');
    // A page whose layout changed can't be applied; it waits for a fresh draft without blocking other pages.
    if(row.page!=='site'&&document.templateHash!==hash){stale.push(row);continue;}
    if(row.page==='site'&&(Object.keys(document.elements).length||document.sections.copies.length||document.sections.order.length||document.sections.hidden.length))throw Error('Shared styles cannot contain page element overrides.');
    tree.push({path:'data/website-content/'+row.page+'.json',mode:'100644',type:'blob',content:JSON.stringify({schema:1,page:row.page,namespace,version:row.version,submissionId:row.id,document},null,2)+'\n'});
    ready.push(row);sections.push(await summary(row,document,source));
   }
   for(const row of stale)await backend('review-result',{id:row.id,status:'stale',error:'The '+PAGES[row.page].name+' page layout changed after these edits were saved. Open it in the website editor and choose Start from updated page.'});
   if(!ready.length)continue;
   let head;try{head=await github('/git/ref/heads/'+branch);}catch(e){if(e.status!==404)throw e;}
   if(head&&head.object.sha!==main.object.sha){const previous=await github('/git/commits/'+head.object.sha);if(previous.author.name!=='GCT Website Editor')throw Error('The review branch was edited outside the website editor. Review those changes before syncing again.');}
   const nextTree=await github('/git/trees',{base_tree:base.tree.sha,tree},'POST');
   const parents=[head?.object.sha||main.object.sha];if(!parents.includes(main.object.sha))parents.push(main.object.sha);
   const editors=[...new Set(ready.map(s=>editor(s.submitted_email)))].join(', ');
   const commit=await github('/git/commits',{message:'Apply saved GCT website content for review\n\nSaved in the website editor by '+editors+'.',tree:nextTree.sha,parents,author:{name:'GCT Website Editor',email:'41898282+github-actions[bot]@users.noreply.github.com'}},'POST');
   if(head)await github('/git/refs/heads/'+branch,{sha:commit.sha,force:false},'PATCH');
   else await github('/git/refs',{ref:'refs/heads/'+branch,sha:commit.sha},'POST');
   const existing=await github('/pulls?state=open&base=main&head='+encodeURIComponent('christopherboyenger:'+branch));
   const description=('Website changes saved in the GCT website editor, ready for review. Merge this PR to put them on the live website.\n\n## What changes on the website\n\n'+sections.join('\n\n')).slice(0,60000)+'\n\nEvery saved change in the editor is added to this PR automatically; GitHub runs the sync every few hours. The editor’s **Changes** tab lists who changed what and when.\n\nThe countdown, page layouts and editor access settings are unchanged. This branch is managed by the website editor, so make further content edits in the editor.';
   const pr=existing[0]?await github('/pulls/'+existing[0].number,{body:description},'PATCH'):await github('/pulls',{head:branch,base:'main',title:'Review GCT website content edits',body:description,draft:true},'POST');
   for(const row of ready)await backend('review-result',{id:row.id,status:'in_pr',pr_number:pr.number,pr_url:pr.html_url,branch,commit_sha:commit.sha});
   results.push(pr.html_url);
  }catch(e){
   for(const row of active.filter(r=>!stale.includes(r)))await backend('review-result',{id:row.id,status:'error',error:e.status===403?'GitHub did not allow the workflow to create or update a pull request. Check this repository’s Actions workflow permissions.':e.message});
   throw e;
  }
 }
 return results;
}

async function run(){
 if(process.env.GITHUB_REPOSITORY!==repo||!process.env.GITHUB_TOKEN)throw Error('Run from the GCT website review workflow.');
 const github=async(path,body,method='GET')=>{const r=await fetch(api+path,{method,headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Object.assign(Error('GitHub request failed ('+r.status+').'),{status:r.status});return r.json();};
 const backend=async(action,body={})=>{
  const oidcURL=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);oidcURL.searchParams.set('audience','gct-website-editor-pr');
  const tokenResponse=await fetch(oidcURL,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}});if(!tokenResponse.ok)throw Error('GitHub workflow identity was unavailable.');const {value}=await tokenResponse.json();
  const r=await fetch(config.url+'/functions/v1/website-editor',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+value,'Content-Type':'application/json'},body:JSON.stringify({action,...body})});const data=await r.json();if(!r.ok)throw Error(data.error||'Website review storage could not be reached.');return data;
 };
 const reviews=await syncEditorReviews({github,backend});console.log(reviews.length?'Updated website review: '+reviews.join(', '):'No submitted website changes need a pull request.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await run();
