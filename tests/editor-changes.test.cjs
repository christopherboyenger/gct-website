const {test,before}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const{createHash}=require('node:crypto');const{parseHTML}=require('linkedom');
let changes,renderer;before(async()=>{process.chdir(path.resolve(__dirname,'..'));changes=await import('../lib/editor-changes.mjs');renderer=await import('../lib/editor-render.mjs');});
const labels={n1:{type:'text',text:'Apply in minutes',section:'How it works'},n2:{type:'image',text:'Leaderboard screenshot',section:'One app'},s1:{type:'section',text:'One app',section:'One app'}};
const log=(steps,page='creators')=>steps.slice(1).reduce((session,doc,i)=>changes.mergeChanges(session,changes.diffDocuments(steps[i],doc),labels,page),[]);

test('a session keeps each field’s first value and latest value, and drops edits that end where they started',()=>{
 const base={templateHash:'h'};
 let session=log([base,{...base,elements:{n1:{text:'Apply today'}}},{...base,elements:{n1:{text:'Apply today!'}}}]);
 assert.deepEqual(session.map(c=>c.text),['Changed text in “How it works”: “Apply in minutes” → “Apply today!”']);
 session=log([base,{...base,elements:{n1:{text:'Apply today'}}},base]);assert.deepEqual(session,[]);
 session=changes.mergeChanges([],changes.diffDocuments({...base,elements:{n1:{text:'Old'}}},base),labels,'creators');
 assert.deepEqual(session.map(c=>c.text),['Reset text “Apply in minutes” in “How it works” to its original wording']);
});

test('style, image, page setting, site style and section changes are described in plain words',()=>{
 const base={templateHash:'h'},section={order:[],hidden:['s1'],copies:[{source:'s1',id:'copy-abcdef12'}]};
 const text=changes.mergeChanges([],changes.diffDocuments(base,{...base,elements:{n1:{mobileStyle:{fontSize:20,color:'#112233'}},n2:{src:'https://cdn.example/new.jpg'},'n1-copy-abcdef12':{text:'Copied'}},meta:{title:'New title',noindex:false},theme:{accent:'#ff0000'},sections:section}),labels,'creators').map(c=>c.text);
 assert(text.includes('Changed mobile styling of text “Apply in minutes” in “How it works”: text size original → 20, text color original → #112233'));
 assert(text.includes('Replaced image “Leaderboard screenshot” in “One app” with https://cdn.example/new.jpg'));
 assert(text.includes('Changed text in “How it works”: “Apply in minutes” → “Copied”'));
 assert(text.includes('Changed page title: original → “New title”'));
 assert(text.includes('Changed hide from search: original → off'));
 assert(text.includes('Changed page accent color: original → #ff0000'));
 assert(text.includes('Hid section “One app”'));
 assert(text.includes('Duplicated section “One app”'));
 assert.deepEqual(changes.mergeChanges([],changes.diffDocuments({},{theme:{font:'Inter'}}),{},'site').map(c=>c.text),['Changed site-wide body font: original → Inter']);
 assert.deepEqual(changes.mergeChanges([],changes.diffDocuments({sections:{order:['a','b']}},{sections:{order:['b','a']}}),{},'creators').map(c=>c.text),['Reordered the page sections']);
});

test('a fresh draft on a changed layout replaces earlier element entries with one line',()=>{
 const old={templateHash:'old',elements:{n1:{text:'A'},n2:{alt:'B'}},sections:{hidden:['s1']}};
 const session=log([{templateHash:'old'},old,{templateHash:'new',meta:{title:'Kept'}}]);
 assert.deepEqual(session.map(c=>c.text),['Started a fresh draft on the updated page layout (3 earlier edits set aside and kept in version history)','Changed page title: original → “Kept”']);
});

test('labels sent with a save are limited to known kinds and short text',()=>{
 const long='x'.repeat(500),out=changes.mergeChanges([],changes.diffDocuments({},{elements:{n9:{text:'New'},n8:{text:'Other'}}}),{n9:{type:'text',text:long,section:'S'},n8:{type:'script',text:'<b>'}},'creators');
 assert(out[0].label.text.length<=80);assert.equal(out[1].label,undefined);assert.equal(out[1].text,'Changed text: original text → “Other”');
});

test('template labels describe the same element IDs the editor saves',async()=>{
 const labels=await renderer.templateLabels('creators'),out=await renderer.renderPage({page:'creators',edit:true});
 const manifest=JSON.parse(parseHTML(out.html).document.getElementById('gct-editor-manifest').textContent);
 assert.deepEqual(Object.keys(labels).sort(),manifest.items.map(i=>i.id).sort());
 const heading=manifest.items.find(i=>i.tag==='h1');assert.equal(labels[heading.id].type,'text');assert.equal(labels[heading.id].text,heading.label.replace(/\s+/g,' ').trim().slice(0,80));
 for(const s of manifest.sections)assert.equal(labels[s.id].type,'section');
});

test('review PRs describe what changes, name the editor without an email domain and skip pages whose layout changed',async()=>{
 const{syncEditorReviews}=await import('../scripts/sync-editor-pr.mjs');const{canonicalTemplate}=await import('../lib/editor-schema.mjs');
 const source='<html><body><main><section><h2>Join the tour</h2><p>Apply in minutes</p></section></main></body></html>',hash=createHash('sha256').update(canonicalTemplate(source)).digest('hex');
 const id=Object.entries(await renderer.templateLabels('courses',source)).find(([,l])=>l.text==='Apply in minutes')[0];
 const rows=[{id:'33333333-3333-4333-8333-333333333333',namespace:'production',page:'courses',version:4,status:'queued',submitted_email:'piff@golfcreatoropen.com',document:{schema:1,templateHash:hash,elements:{[id]:{text:'Follow @gct_tour and #1 golf creators'}}}},{id:'44444444-4444-4444-8444-444444444444',namespace:'production',page:'network',version:9,status:'in_pr',pr_number:126,submitted_email:'chris@golfcreatoropen.com',document:{schema:1,templateHash:'old-layout'}}];
 const acks=[],requests=[];
 const backend=async(action,body)=>{if(action==='review-pending')return{submissions:structuredClone(rows)};acks.push({action,...body});return{updated:true};};
 const github=async(route,body,method='GET')=>{requests.push({route,body,method});
  if(route==='/git/ref/heads/main')return{object:{sha:'a'.repeat(40)}};
  if(route.startsWith('/git/commits/'))return{tree:{sha:'b'.repeat(40)}};
  if(route.startsWith('/contents/'))return{content:Buffer.from(source).toString('base64')};
  if(route.startsWith('/git/ref/heads/codex/'))throw Object.assign(Error('Missing'),{status:404});
  if(route==='/git/trees')return{sha:'c'.repeat(40)};if(route==='/git/commits')return{sha:'d'.repeat(40)};if(route==='/git/refs')return{};
  if(route==='/pulls/126')return{number:126,state:'open',merged:false};if(route.startsWith('/pulls?'))return[];
  if(route==='/pulls')return{number:130,html_url:'https://github.com/christopherboyenger/gct-website/pull/130'};
  throw Error('Unexpected route '+route);};
 await syncEditorReviews({github,backend});
 const tree=requests.find(r=>r.route==='/git/trees').body.tree,pr=requests.find(r=>r.route==='/pulls').body,commit=requests.find(r=>r.route==='/git/commits'&&r.method==='POST').body;
 assert.deepEqual(tree.map(t=>t.path),['data/website-content/courses.json']);
 assert.deepEqual(acks.map(a=>a.status),['stale','in_pr']);
 assert.match(pr.body,/### Courses & destinations\n_Last saved by piff\._/);
 assert.match(pr.body,/Changed text in “Join the tour”: “Apply in minutes” → “Follow @​gct\\_tour and #​1 golf creators”/);
 assert(!pr.body.includes('golfcreatoropen.com')&&!commit.message.includes('golfcreatoropen.com'));assert.match(commit.message,/by piff\./);assert.equal(pr.draft,true);
});

test('newer saves after a merged PR record that merge and open a new PR',async()=>{
 const{syncEditorReviews}=await import('../scripts/sync-editor-pr.mjs');const{canonicalTemplate}=await import('../lib/editor-schema.mjs');
 const source='<h1>Page</h1>',hash=createHash('sha256').update(canonicalTemplate(source)).digest('hex'),acks=[];let created=0;
 const backend=async(action,body)=>action==='review-pending'?{submissions:[{id:'55555555-5555-4555-8555-555555555555',namespace:'production',page:'events',version:12,status:'queued',pr_number:126,document:{templateHash:hash}}]}:(acks.push({action,...body}),{updated:true});
 const github=async(route,body,method='GET')=>{
  if(route==='/pulls/126')return{number:126,state:'closed',merged:true,html_url:'https://github.com/christopherboyenger/gct-website/pull/126',head:{sha:'e'.repeat(40)}};
  if(route==='/git/ref/heads/main')return{object:{sha:'a'.repeat(40)}};if(route.startsWith('/git/commits/'))return{tree:{sha:'b'.repeat(40)},author:{name:'GCT Website Editor'}};
  if(route.startsWith('/contents/'))return{content:Buffer.from(source).toString('base64')};if(route.startsWith('/git/ref/heads/codex/'))return{object:{sha:'f'.repeat(40)}};
  if(route==='/git/trees')return{sha:'c'.repeat(40)};if(route==='/git/commits')return{sha:'d'.repeat(40)};if(route.startsWith('/git/refs/heads/'))return{};
  if(route.startsWith('/pulls?'))return[];if(route==='/pulls'){created++;return{number:131,html_url:'https://github.com/christopherboyenger/gct-website/pull/131'};}
  throw Error('Unexpected route '+route);};
 await syncEditorReviews({github,backend});
 assert.deepEqual(acks.map(a=>[a.action,a.status,a.pr_number]),[['review-pr','merged',126],['review-result','in_pr',131]]);assert.equal(created,1);
});
