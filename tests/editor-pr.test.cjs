const {test}=require('node:test');const assert=require('node:assert/strict');const{createHash,generateKeyPairSync,sign}=require('node:crypto');
test('a merged content snapshot is read by the same renderer used for the current website',async()=>{const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');const{renderPage}=await import('../lib/editor-render.mjs');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gct-editor-build-')),original=process.cwd();try{const source='<html><head><title>Current website</title></head><body><header class="hero"><h1>Current heading</h1></header></body></html>';await fs.writeFile(path.join(dir,'gct-creators.html'),source);process.chdir(dir);const originalRender=await renderPage({page:'creators',edit:true});const{parseHTML}=require('linkedom'),dom=parseHTML(originalRender.html).document;const heading=JSON.parse(dom.getElementById('gct-editor-manifest').textContent).items.find(x=>x.tag==='h1');await fs.mkdir(path.join(dir,'data/website-content'),{recursive:true});await fs.writeFile(path.join(dir,'data/website-content/creators.json'),JSON.stringify({page:'creators',document:{templateHash:originalRender.templateHash,elements:{[heading.id]:{text:'Merged creator edit'}}}}));assert.match((await renderPage({page:'creators'})).html,/Merged creator edit/);}finally{process.chdir(original);await fs.rm(dir,{recursive:true,force:true});}});
test('workflow identity rejects forks, wrong workflows, expired tokens and invalid signatures',async()=>{
 const{verifyWorkflowToken}=await import('../lib/editor-workflow-auth.mjs');const keys=generateKeyPairSync('rsa',{modulusLength:2048});const jwk=keys.publicKey.export({format:'jwk'});jwk.kid='fixture-key';
 const now=Math.floor(Date.now()/1000),claims={iss:'https://token.actions.githubusercontent.com',aud:'gct-website-editor-pr',repository:'christopherboyenger/gct-website',repository_id:'1229342397',repository_owner_id:'269604875',ref:'refs/heads/main',workflow_ref:'christopherboyenger/gct-website/.github/workflows/website-editor-pr.yml@refs/heads/main',event_name:'schedule',iat:now-10,exp:now+300};
 const token=(patch={},key=keys.privateKey)=>{const h=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url'),p=Buffer.from(JSON.stringify({...claims,...patch})).toString('base64url');return h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),key).toString('base64url');};
 const fetcher=async url=>{assert.equal(url,'https://token.actions.githubusercontent.com/.well-known/jwks');return Response.json({keys:[jwk]});};
 assert(await verifyWorkflowToken(token(),{fetcher,now}));
 for(const patch of [{repository_id:'999'},{repository:'other/fork'},{event_name:'pull_request'},{workflow_ref:'christopherboyenger/gct-website/.github/workflows/other.yml@refs/heads/main'},{aud:'other'},{exp:now-1},{iat:now+300},{ref:'refs/heads/untrusted'}])assert.equal(await verifyWorkflowToken(token(patch),{fetcher,now}),null);
 const wrong=generateKeyPairSync('rsa',{modulusLength:2048});assert.equal(await verifyWorkflowToken(token({},wrong.privateKey),{fetcher,now}),null);
});
test('submitted edits create one content PR and later submissions update it without exporting private drafts',async()=>{
 const{syncEditorReviews}=await import('../scripts/sync-editor-pr.mjs');const{canonicalTemplate}=await import('../lib/editor-schema.mjs');const source='<h1>Current website source</h1>',hash=createHash('sha256').update(canonicalTemplate(source)).digest('hex');
 let rows=[{id:'11111111-1111-4111-8111-111111111111',namespace:'gct-preview-v2',page:'creators',version:1,document:{schema:1,templateHash:hash,elements:{n1:{text:'Saved for review'}}},status:'queued'}],head=null,pr=null,created=0,trees=[];const acks=[];
 const backend=async(action,body)=>{if(action==='review-pending')return{submissions:structuredClone(rows)};acks.push(body);return{updated:true};};
 const github=async(route,body,method='GET')=>{
  if(route==='/git/ref/heads/main')return{object:{sha:'a'.repeat(40)}};
  if(route.startsWith('/git/commits/')&&method==='GET')return{tree:{sha:'b'.repeat(40)},author:{name:'GCT Website Editor'}};
  if(route.startsWith('/contents/'))return{content:Buffer.from(source).toString('base64')};
  if(route.startsWith('/git/ref/heads/codex/')){if(!head)throw Object.assign(Error('Missing'),{status:404});return{object:{sha:head}};}
  if(route==='/git/trees'){trees.push(body);return{sha:'c'.repeat(40)};}
  if(route==='/git/commits')return{sha:'d'.repeat(40)};
  if(route==='/git/refs'||route.startsWith('/git/refs/heads/')){head=body.sha;return{};}
  if(route.startsWith('/pulls?'))return pr?[pr]:[];
  if(route==='/pulls'){created++;pr={number:98765,html_url:'https://github.com/christopherboyenger/gct-website/pull/98765'};return pr;}
  if(route==='/pulls/98765')return pr;
  throw Error('Unexpected route '+route);
 };
 await syncEditorReviews({github,backend});assert.equal(created,1);assert.equal(acks[0].status,'in_pr');assert.deepEqual(trees[0].tree.map(x=>x.path),['data/website-content/creators.json']);assert(!trees[0].tree[0].content.includes('submitted_by'));
 rows[0].id='22222222-2222-4222-8222-222222222222';rows[0].version=2;rows[0].document.elements.n1.text='Updated saved edit';await syncEditorReviews({github,backend});assert.equal(created,1);assert.equal(JSON.parse(trees[1].tree[0].content).document.elements.n1.text,'Updated saved edit');
 rows[0].document.templateHash='changed';await syncEditorReviews({github,backend});assert.equal(trees.length,2);assert.equal(acks.at(-1).status,'stale');assert.match(acks.at(-1).error,/layout changed.*Start from updated page/);
});

test('Windows and hosted copies of the same source have identical template hashes',async()=>{const {renderPage}=await import('../lib/editor-render.mjs');const html='<html>\n<head><title>Current build</title></head>\n<body><h1>Heading</h1></body></html>';assert.equal((await renderPage({page:'creators',source:html})).templateHash,(await renderPage({page:'creators',source:html.replace(/\n/g,'\r\n')})).templateHash);});
