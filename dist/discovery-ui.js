import {createOpenAlexClient} from './openalex-client.js?v=29';
import {buildLearningPath,learningGoals} from './learning-core.js?v=29';
import {learningLevel} from './core.js?v=29';
import {planSearch,compileQuery,rankResults,candidateTarget,fromOpenAlex,samePaper,searchUrl,isEnglishRecord,translateQuery,learningSearchJobs} from './discovery-core.js?v=29';

export function setupDiscovery({getPapers,addPaper,pickPaper,createGraph}){
 const $=s=>document.querySelector(s),dialog=$('#discoverDialog');
 let mode='area',controller=null,operation=0,results=[],nextPage=null,total=0,activePlan=null,building=false,learning=false,queryEdited=false,queryEnglish=true,loadedQuery='',loadedScope='',loadedLanguage='',foundationAuto='',learningReport=null;
 const api=createOpenAlexClient({fetcher:(url,options)=>fetch(url,options)});
 try{api.setKey(sessionStorage.getItem('nexlit-openalex-key')||'')}catch{}
 const scope=()=>$('#discoverBreadth').value||'balanced';
 const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n};
 const strip=s=>new DOMParser().parseFromString(String(s||''),'text/html').body.textContent||'';
 const status=text=>{$('#discoverStatus').textContent=text};
 const inputControls=['#discoverInput','#discoverQuery','#discoverBreadth','#discoverInputLanguage','#modeArea','#modeExperiment','#discoverLearning','#discoverGraphCount','#discoverCandidateCount','#discoverFoundation','#openalexKey','#openalexUseKey','#openalexRemoveKey'];
 function lock(on){
  for(const selector of inputControls)$(selector).disabled=on;
  $('#discoverSearch').disabled=on;
  $('#discoverMore').disabled=on;
  $('#discoverCreateGraph').disabled=on||!activePlan;
  $('#discoverCancel').hidden=!on;
  $('#openalexRemoveKey').disabled=on||!api.hasKey();
 }
 function invalidate(){
  results=[];activePlan=null;nextPage=null;loadedQuery='';learningReport=null;render();
 }
 function proposal(){
  if($('#discoverFoundation').value===foundationAuto)$('#discoverFoundation').value='';
  queryEdited=false;queryEnglish=$('#discoverInputLanguage').value==='en';invalidate();
  try{
   const plan=planSearch($('#discoverInput').value,mode,scope());
   $('#discoverQuery').value=$('#discoverInputLanguage').value==='en'?plan.query:$('#discoverInput').value.trim();
   $('#discoverConcepts').replaceChildren(...plan.concepts.map(c=>el('span',{},c.label)));status('');
  }catch(error){$('#discoverConcepts').replaceChildren();$('#discoverQuery').value='';status(error.message)}
 }
 function setMode(value){
  mode=value;$('#modeArea').setAttribute('aria-pressed',String(mode==='area'));$('#modeExperiment').setAttribute('aria-pressed',String(mode==='experiment'));
  $('#discoverPrompt').textContent=mode==='area'?'What would you like to explore?':'Describe your project or research';
  $('#discoverInput').placeholder=mode==='area'?'For example: "social memory" hippocampus sleep':'For example: compare "teaching methods" and "programming education"';
  proposal();
 }
 function cancel(notify=true){
  const active=!!controller;operation++;controller?.abort();controller=null;building=false;lock(false);
  // A canceled first request has no usable query; a canceled expansion keeps loaded results.
  render();if(active&&notify)status('Search canceled.');
 }
 function close(){cancel(false);dialog.close()}
 $('#discoverOpen').onclick=()=>{dialog.showModal();$('#discoverInput').focus();render()};$('#discoverClose').onclick=close;
 dialog.addEventListener('cancel',cancel);
 dialog.addEventListener('pointerdown',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){e.preventDefault();close()}});
 $('#discoverCancel').onclick=cancel;
 $('#modeArea').onclick=()=>setMode('area');$('#modeExperiment').onclick=()=>setMode('experiment');
 $('#discoverInput').oninput=proposal;$('#discoverBreadth').onchange=proposal;$('#discoverInputLanguage').onchange=proposal;
 $('#discoverQuery').oninput=()=>{queryEdited=true;invalidate();status('Run the updated query to refresh results.')};
 $('#discoverLearning').onclick=()=>{learning=!learning;$('#discoverLearning').setAttribute('aria-pressed',String(learning));$('#discoverLearning').textContent=learning?'Learn from scratch ✓':'Learn from scratch ○';render()};
 $('#discoverGraphCount').onchange=()=>{learningReport=null;renderLearning()};
 $('#discoverFoundation').oninput=()=>{learningReport=null;render()};
 function existing(p){return getPapers().find(known=>samePaper(known,p))}
 function rankedResults(){return activePlan?rankResults(results,activePlan):[]}
 function learningContext(){
  const subject=$('#discoverFoundation').value.trim()||activePlan?.concepts[0]?.label||'';
  return {subject,target:activePlan?.query||'',targetPaperIds:rankedResults().filter(item=>item.eligible).map(item=>item.p.id)};
 }
 function currentLearningPath(count=Number($('#discoverGraphCount').value)||200){
  const context=learningContext();
  if(!activePlan||!context.subject)return buildLearningPath([],{...context,count});
  const broad=compileQuery(learningSearchJobs(activePlan,context.subject,0).query);
  const allowed=new Set([...rankResults(results,broad),...rankedResults()].filter(item=>item.eligible).map(item=>item.p.id));
  return buildLearningPath(results.filter(p=>allowed.has(p.id)),{...context,count});
 }
 function renderLearning(){
  $('#discoverLearningPlan').hidden=!learning;
  if(!learning)return;
  const context=learningContext(),report=learningReport||currentLearningPath();
  const list=$('#discoverLearningStages');list.replaceChildren();
  for(const goal of learningGoals(context)){
   const stageReadings=report.steps.filter(item=>item.goalId===goal.id),gap=report.gaps.find(item=>item.stage===goal.stage);
   list.append(el('li',{},`${goal.label}: ${goal.objective} ${stageReadings.length?stageReadings.length+' reading(s) found.':gap?.reason||'Search pending.'}`));
  }
  const requested=Number($('#discoverGraphCount').value)||20;
  $('#discoverLearningStatus').textContent=`${report.steps.length} / ${requested} readings from ${report.candidateCount||0} loaded candidates. `+(report.complete?'All five stages are covered; more complementary readings can be added.':report.steps.length?`Partial path: the next missing stage is ${report.gaps[0]?.label}.`:'The search starts with introductory material and stops advancement at missing prerequisites.');
 }
 function render(){
  renderLearning();
  $('#discoverCountLabel').textContent=learning?'Target readings':'Papers in the graph';
  $('#discoverCreateGraph').textContent=learning?'Create learning path ↗':'Create graph ↗';
  const list=$('#discoverResults');list.replaceChildren();const ranked=rankedResults();
  $('#discoverGraphTools').hidden=!results.length;$('#discoverCreateGraph').disabled=!!controller||building||!activePlan;
  for(const {p,matches,eligible}of ranked){
   const article=el('article',{class:'discovery-result'});
   if(learning)article.append(el('span',{class:'learning-label'},learningLevel(p).label));
   article.append(el('h3',{},p.title));const meta=el('div',{class:'result-meta'});
   if(p.preprint)meta.append(el('span',{class:'preprint'},'PREPRINT'));
   const authors=p.authors.split(' and ');meta.append(el('span',{},[authors.slice(0,3).join('; ')+(authors.length>3?' et al.':''),p.journal,p.year].filter(Boolean).join(' · ')));article.append(meta);
   article.append(el('p',{class:'result-relevance'},eligible?'Matches in title, abstract or keywords: '+matches.map(c=>c.label).join(' · '):'The available metadata does not confirm this query. Excluded from automatic graph selection.'));
   if(p.abstract){const details=el('details');details.append(el('summary',{},'View abstract'),el('p',{},p.abstract));article.append(details)}else article.append(el('p',{class:'result-meta'},'No abstract available.'));
   const actions=el('div',{class:'result-actions'}),known=existing(p),add=el('button',{},known?'Already in your library ✓':'Add to library ＋');
   add.disabled=!!known;add.onclick=()=>{addPaper(p);render()};actions.append(add);
   if(known){const view=el('button',{},'View in graph');view.onclick=()=>{close();pickPaper(known.id)};actions.append(view)}
   actions.append(el('a',{href:p.url,target:'_blank',rel:'noopener noreferrer'},'OpenAlex ↗'));article.append(actions);list.append(article);
  }
  $('#discoverMore').hidden=!nextPage;$('#discoverMore').disabled=!!controller||building;
 }
 function merge(records){
  for(const record of records){
   if(!isEnglishRecord(record))continue;
   const paper=fromOpenAlex(record,strip);if(!paper)continue;
   if(!results.some(p=>samePaper(p,paper)))results.push(paper);
  }
 }
 function showError(error){
  status(error.message);
  if(error.code==='daily_budget'||error.code==='authentication'){
   $('#openalexAccess').open=true;
   $('#openalexAccessStatus').textContent=error.message;
  }
 }
 function renderAccess(){
  $('#openalexAccessStatus').textContent=api.hasKey()?'Personal OpenAlex key enabled for this tab.':'Using the shared anonymous OpenAlex budget.';
  $('#openalexRemoveKey').disabled=!api.hasKey();
 }
 $('#openalexUseKey').onclick=()=>{
  const value=$('#openalexKey').value.trim();
  if(!value){$('#openalexAccessStatus').textContent='Paste your OpenAlex key first.';return}
  try{
   api.setKey(value);let saved=false;
   try{sessionStorage.setItem('nexlit-openalex-key',value);saved=true}catch{}
   $('#openalexKey').value='';renderAccess();
   $('#openalexAccessStatus').textContent=saved?'Key saved for this tab. Run your search again.':'Key enabled until this page reloads. Run your search again.';
   status('OpenAlex key enabled. Run your search again.');
  }catch(error){$('#openalexAccessStatus').textContent=error.message}
 };
 $('#openalexRemoveKey').onclick=()=>{
  api.setKey('');try{sessionStorage.removeItem('nexlit-openalex-key')}catch{}
  $('#openalexKey').value='';renderAccess();status('Personal key removed. Requests use the shared anonymous budget.');
 };
 renderAccess();
 const request=(url,signal)=>api.request(url,signal);
 async function page(number,signal,id){
  const data=await request(searchUrl(activePlan.query,number),signal);
  if(id!==operation)return false;
  const records=data.results||[];merge(records);total=Number(data.meta?.count)||0;
  nextPage=records.length&&number*20<total?number+1:null;
  render();return true;
 }
 function summary(){
  const eligible=rankedResults().filter(item=>item.eligible).length;
  status(results.length?`${results.length} candidates loaded of ${total.toLocaleString('en-US')}. ${eligible} match the query in available metadata. English only.`:'No results. Try Exploratory mode, fewer required concepts or different phrases.');
 }
 async function search(more=false){
  if(controller)return;
  const id=++operation,abort=new AbortController();controller=abort;lock(true);const timer=setTimeout(()=>abort.abort(),60000);
  try{
   if(!more){
    const input=$('#discoverInput').value,query=$('#discoverQuery').value.trim();
    const edited=queryEdited;invalidate();
    let plan;
    if($('#discoverInputLanguage').value==='es'&&!(edited&&queryEnglish)){
     status('Preparing the English query…');
     const translated=await translateQuery(edited?query:input,{signal:abort.signal,area:!edited&&mode==='area'});
     if(id!==operation)return;
     // A hand-edited Boolean query is compiled directly after translation.
     plan=edited?compileQuery(strip(translated)):planSearch(strip(translated),mode,scope());
    }else plan=edited?compileQuery(query):planSearch(input,mode,scope());
    if(!plan.query)throw Error('Enter a subject or describe your project.');
    activePlan=plan;$('#discoverQuery').value=plan.query;
    if(!$('#discoverFoundation').value.trim()){foundationAuto=results[0]?.topic?.foundation||plan.concepts[0]?.label||'';$('#discoverFoundation').value=foundationAuto}
    loadedQuery=plan.query;loadedScope=scope();loadedLanguage=$('#discoverInputLanguage').value;
    // The query box now contains English, even if the original input was Spanish.
    queryEdited=true;queryEnglish=true;
    $('#discoverConcepts').replaceChildren(...plan.concepts.map(c=>el('span',{},c.label)));
   }else if(!activePlan||!nextPage)return;
   status(more?'Searching for more results…':'Searching OpenAlex…');
   if(await page(more?nextPage:1,abort.signal,id)){
    if(!more&&$('#discoverFoundation').value===foundationAuto){foundationAuto=results[0]?.topic?.foundation||activePlan.concepts[0]?.label||'';$('#discoverFoundation').value=foundationAuto}
    summary();renderLearning();
   }
  }catch(error){if(id===operation)showError(error.name==='AbortError'?new Error('The query timed out. Please try again.'):error)}
  finally{clearTimeout(timer);if(id===operation){controller=null;lock(false);render()}}
 }
 async function learningCandidates(count,signal,id){
  const target=candidateTarget(count,$('#discoverCandidateCount').value),maxRequests=Math.ceil(target/20),attempts=new Map(),exhausted=new Set();
  learningReport=currentLearningPath(count);renderLearning();
  for(let fetched=0;fetched<maxRequests;fetched++){
   if(learningReport.steps.length>=count)break;
   const gap=learningReport.gaps[0],stageCounts=new Map(learningReport.goals.map(goal=>[goal.stage,learningReport.steps.filter(step=>step.stage===goal.stage).length]));
   const available=learningReport.goals.map(goal=>goal.stage).filter(stage=>!exhausted.has(stage)&&(attempts.get(stage)||0)<2&&(!gap||stage<=gap.stage));
   const stage=gap&&available.includes(gap.stage)?gap.stage:available.sort((a,b)=>stageCounts.get(a)-stageCounts.get(b)||(attempts.get(a)||0)-(attempts.get(b)||0)||a-b)[0];
   // A complete five-stage outline is not the requested reading count. Continue
   // the target search and stage searches while there is budget and useful material.
   if(nextPage&&((learningReport.complete&&fetched%2===0)||stage===undefined)){
    status(`Expanding the reading path (${learningReport.steps.length} / ${count})…`);
    if(!await page(nextPage,signal,id))return false;
    learningReport=currentLearningPath(count);render();continue;
   }
   if(stage===undefined)break;
   const number=(attempts.get(stage)||0)+1;attempts.set(stage,number);
   const job=learningSearchJobs(activePlan,learningContext().subject,stage),url=new URL(job.url);url.searchParams.set('page',String(number));
   status(`Expanding ${job.label.toLowerCase()} (${learningReport.steps.length} / ${count} readings)…`);
   const data=await request(url.href,signal);if(id!==operation)return false;
   const candidates=(data.results||[]).map(record=>fromOpenAlex(record,strip)).filter(Boolean);
   const allowed=new Set(rankResults(candidates,compileQuery(job.query)).filter(item=>item.eligible).map(item=>item.p.id));
   merge((data.results||[]).filter(record=>allowed.has('openalex-'+record.id?.split('/').pop())));
   if(!(data.results||[]).length||number*20>=Number(data.meta?.count||0)||number>=2)exhausted.add(stage);
   learningReport=currentLearningPath(count);render();
  }
  return true;
 }
 $('#discoverCreateGraph').onclick=async()=>{
  if(controller)return;
  const count=Number($('#discoverGraphCount').value);
  if(!Number.isInteger(count)||count<1||count>200){status('Choose a whole number of papers between 1 and 200.');$('#discoverGraphCount').focus();return}
  if(!activePlan||!results.length){status('Search for papers before creating a graph.');return}
  if($('#discoverQuery').value.trim()!==loadedQuery||scope()!==loadedScope||$('#discoverInputLanguage').value!==loadedLanguage){status('Run the updated query to refresh results.');return}
  const id=++operation,abort=new AbortController();controller=abort;building=true;lock(true);const timer=setTimeout(()=>abort.abort(),60000);
  try{
   const target=candidateTarget(count,$('#discoverCandidateCount').value);
   // Limit expansion by provider pages as well as unique records, including duplicate-heavy responses.
   while(!learning&&nextPage&&nextPage<=Math.ceil(target/20)&&results.length<target){
    status(`Comparing more candidates (${results.length} loaded, up to ${target})…`);
    if(!await page(nextPage,abort.signal,id))return;
   }
   if(learning&&!await learningCandidates(count,abort.signal,id))return;
   if(id!==operation)return;
   const eligible=rankedResults().filter(item=>item.eligible).map(item=>item.p);
   if(!learning&&!eligible.length){status('No candidates match the query in available metadata. Review the query or try Exploratory mode.');return}
   const choice=learning?{...learningReport,missingBasics:!learningReport?.steps.length}:{papers:eligible.slice(0,count)};
   if(choice.missingBasics){status('No supported beginner entry was found. Review the foundation area or the reading abstracts; no advanced-only path was created.');return}
   createGraph(choice.papers,{learning,learningPath:learning?choice:null});close();
  }catch(error){if(id===operation)showError(error.name==='AbortError'?new Error('The comparison timed out. Loaded results are kept; try again or compare fewer candidates.'):error)}
  finally{clearTimeout(timer);if(id===operation){controller=null;building=false;lock(false);render()}}
 };
 $('#discoverSearch').onclick=()=>search(false);$('#discoverMore').onclick=()=>search(true);
 return {cancel};
}
