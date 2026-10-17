import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {normalizeDocument,PAGE_KEYS} from '../lib/editor-schema.mjs';
import config from '../lib/editor-config.json' with {type:'json'};

const repo='christopherboyenger/gct-website',api='https://api.github.com/repos/'+repo;
export async function syncEditorReviews({github,backend}){
 const {submissions}=await backend('review-pending');
 const groups=Map.groupBy(submissions,s=>s.namespace);
 const results=[];
 for(const [namespace,rows]of groups){
  if(!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(namespace))continue;
  const branch='codex/editor-content-'+namespace,active=[];
  for(const row of rows){
   if(row.status==='in_pr'&&row.pr_number){
    const old=await github('/pulls/'+row.pr_number);
    if(old.merged||old.state==='closed'){
     await backend('review-result',{id:row.id,status:old.merged?'merged':'closed',pr_number:old.number,pr_url:old.html_url,branch,commit_sha:old.head.sha});continue;
    }
   }
   active.push(row);
  }
  if(!active.some(s=>['queued','error'].includes(s.status)))continue;
  try{
   const main=await github('/git/ref/heads/main'),base=await github('/git/commits/'+main.object.sha);
   const tree=[];
   for(const row of active){
    if(![...PAGE_KEYS,'site'].includes(row.page))throw Error('Unsupported website page.');
    const document=normalizeDocument(row.document),file='gct-'+(row.page==='site'?'network':row.page)+'.html';
    const source=await github('/contents/'+file+'?ref='+main.object.sha);
    const hash=createHash('sha256').update('gct-editor-template-v1').update(Buffer.from(source.content,'base64')).digest('hex');
    if(row.page!=='site'&&document.templateHash!==hash)throw Error('The '+row.page+' page layout changed. Reload the current website in the editor and save a fresh draft.');
    if(row.page==='site'&&(Object.keys(document.elements).length||document.sections.copies.length||document.sections.order.length||document.sections.hidden.length))throw Error('Shared styles cannot contain page element overrides.');
    tree.push({path:'data/website-content/'+row.page+'.json',mode:'100644',type:'blob',content:JSON.stringify({schema:1,page:row.page,namespace,version:row.version,submissionId:row.id,document},null,2)+'\n'});
   }
   let head;try{head=await github('/git/ref/heads/'+branch);}catch(e){if(e.status!==404)throw e;}
   if(head&&head.object.sha!==main.object.sha){const previous=await github('/git/commits/'+head.object.sha);if(previous.author.name!=='GCT Website Editor')throw Error('The review branch was edited outside the website editor. Review those changes before syncing again.');}
   const nextTree=await github('/git/trees',{base_tree:base.tree.sha,tree},'POST');
   const parents=[head?.object.sha||main.object.sha];if(!parents.includes(main.object.sha))parents.push(main.object.sha);
   const commit=await github('/git/commits',{message:'Apply saved GCT website content for review',tree:nextTree.sha,parents,author:{name:'GCT Website Editor',email:'41898282+github-actions[bot]@users.noreply.github.com'}},'POST');
   if(head)await github('/git/refs/heads/'+branch,{sha:commit.sha,force:false},'PATCH');
   else await github('/git/refs',{ref:'refs/heads/'+branch,sha:commit.sha},'POST');
   const existing=await github('/pulls?state=open&base=main&head='+encodeURIComponent('christopherboyenger:'+branch));
   const description='Saved website edits from the authenticated GCT editor.\n\nPages: '+active.map(s=>s.page).join(', ')+'. Review the content files and merge this PR to apply them to the website build. Later Save to PR actions update this same open PR.\n\nThe countdown, source layouts and editor access settings are unchanged. Drafts that have not been sent to review are excluded.\n\nThis branch is managed by the website editor. Make further content edits through the editor to keep saved drafts and this PR aligned.';
   const pr=existing[0]?await github('/pulls/'+existing[0].number,{body:description},'PATCH'):await github('/pulls',{head:branch,base:'main',title:'Review GCT website content edits',body:description,draft:true},'POST');
   for(const row of active)await backend('review-result',{id:row.id,status:'in_pr',pr_number:pr.number,pr_url:pr.html_url,branch,commit_sha:commit.sha});
   results.push(pr.html_url);
  }catch(e){
   for(const row of active)await backend('review-result',{id:row.id,status:'error',error:e.status===403?'GitHub did not allow the workflow to create or update a pull request. Check this repository’s Actions workflow permissions.':e.message});
   throw e;
  }
 }
 return results;
}

async function run(){
 if(process.env.GITHUB_REPOSITORY!==repo||!process.env.GITHUB_TOKEN)throw Error('Run from the GCT website review workflow.');
 const github=async(path,body,method='GET')=>{const r=await fetch(api+path,{method,headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Object.assign(Error('GitHub request failed ('+r.status+').'),{status:r.status});return r.json();};
 const backend=async(action,body={})=>{
  const oidcURL=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);oidcURL.searchParams.set('audience','gct-website-editor-pr');
  const tokenResponse=await fetch(oidcURL,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}});if(!tokenResponse.ok)throw Error('GitHub workflow identity was unavailable.');const {value}=await tokenResponse.json();
  const r=await fetch(config.url+'/functions/v1/website-editor',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+value,'Content-Type':'application/json'},body:JSON.stringify({action,...body})});const data=await r.json();if(!r.ok)throw Error(data.error||'Website review storage could not be reached.');return data;
 };
 const reviews=await syncEditorReviews({github,backend});console.log(reviews.length?'Updated website review: '+reviews.join(', '):'No submitted website changes need a pull request.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await run();
