// A conservative curriculum planner. Metadata supplies evidence, not proof of mastery.
export const LEARNING_STAGES=[
 {id:'orientation',label:'Orientation',goal:'Understand the area and its vocabulary',requires:[]},
 {id:'foundations',label:'Foundations',goal:'Learn the basic concepts',requires:['orientation']},
 {id:'methods',label:'Methods',goal:'Understand how the subject is studied',requires:['foundations']},
 {id:'applications',label:'Applications',goal:'Connect the foundations and methods to the target topic',requires:['foundations','methods']},
 {id:'advanced',label:'Advanced',goal:'Examine specialized questions and limitations',requires:['applications']}
];
const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const stem=w=>w.length>4&&w.endsWith('ies')?w.slice(0,-3)+'y':w.length>4&&w.endsWith('s')&&!/(ss|us|is)$/.test(w)?w.slice(0,-1):w;
const terms=s=>normalize(s).split(' ').filter(Boolean).map(stem);
export function coversSubject(paper,subject){
 const required=terms(subject).filter(w=>!['and','of','the','in'].includes(w));
 const present=new Set(terms([paper.title,paper.abstract,paper.keywords].join(' ')));
 return required.length>0&&required.every(w=>present.has(w));
}
const intro=/\b(?:introductory|introduction to|for beginners|for non.?specialists|accessible overview|no (?:prior|previous|background) knowledge)\b/i;
const basics=/\b(?:basic concepts|fundamental concepts|fundamentals|foundations|elementary|first principles|basic principles)\b/i;
const explanatory=/\b(?:explain\w*|teach\w*|introduc\w*|cover\w*|present\w*|describe\w*|overview|tutorial|guide)\b/i;
const methods=/\b(?:methodology|methods|protocol|experimental design|measurement|data analysis|step.by.step|how to)\b/i;
const applications=/\b(?:applications?|applied|apply|case stud(?:y|ies)|practical examples?)\b/i;
const advanced=/\b(?:advanced|frontiers|state.of.the.art|cutting.edge|open problems|unresolved|research challenges)\b/i;
const sentences=s=>String(s||'').match(/[^.!?]+(?:[.!?]+|$)/g)?.map(x=>x.trim()).filter(Boolean)||[];
export function assessLearning(paper){
 const title=paper.title||'',abstract=paper.abstract||'',text=title+' '+abstract;
 const assumed=[];
 for(const sentence of sentences(abstract)){
  const match=sentence.match(/(?:assumes? (?:prior )?knowledge of|requires? (?:prior )?knowledge of|familiarity with|prerequisites?\s*:)\s+(.+?)[.!?]*$/i);
  if(match)assumed.push(...match[1].replace(/[.!?]+$/,'').split(/,|\band\b/i).map(x=>x.trim()).filter(Boolean));
 }
 let level=-1,cue=null;
 // An advanced review remains advanced even if it introduces a new technique.
 if(advanced.test(text)){level=4;cue=advanced}
 else if(methods.test(text)&&!basics.test(title)&&!intro.test(title)){level=2;cue=methods}
 else if(applications.test(text)&&!basics.test(title)&&!intro.test(title)){level=3;cue=applications}
 else if(intro.test(title)){level=0;cue=intro.test(abstract)?intro:basics}
 else if(basics.test(text)){level=1;cue=basics}
 else if(intro.test(text)){level=0;cue=intro}
 const hasAbstract=abstract.trim().length>=60;
 let supported=hasAbstract&&level>=0&&cue.test(abstract);
 if(level<=1&&level>=0)supported=supported&&explanatory.test(abstract)&&!/\b(?:not|isn't|is not) (?:an? )?(?:introduction|introductory|beginner)/i.test(abstract);
 const evidence=cue?sentences(abstract).find(sentence=>cue.test(sentence))||'':'';
 supported=supported&&evidence.length>=40;
 const label=level<0?'Unclassified':LEARNING_STAGES[level].label;
 return {level,label:supported?label:'Unverified · '+label,confidence:supported?'metadata-supported':'unverified',supported,assumed,evidence,
  reason:supported?`Estimated ${label.toLowerCase()} material, supported by its abstract.`:'The available metadata does not establish its teaching role.'};
}
export function learningGoals({subject='',target=''}={}){
 return LEARNING_STAGES.map((stage,index)=>({...stage,stage:index,objective:index<3?`${stage.goal}: ${subject}.`:`${stage.goal}: ${target||subject}.`}));
}
const bridgeStop=new Set('a an the and or of in on to for from with by as at its their this that these those we our it is are was were be been has have into across through within how what can may using use used study studies studying research paper article chapter book review reviews introduction introductory fundamental fundamentals foundations basic concepts elementary overview tutorial methods method methodology applications application applied advanced presents present describes describe explains explain provides provide examines examine compares compare includes including results examples practical current approaches questions knowledge vocabulary purpose theory'.split(' '));
function contentBridge(before,after,subject){
 const excluded=new Set([...bridgeStop,...terms(subject)]);
 const content=paper=>new Set(terms([paper.title,paper.abstract,paper.keywords].join(' ')).filter(word=>word.length>3&&!excluded.has(word)));
 const previous=content(before),next=content(after);
 return [...previous].filter(word=>next.has(word)).slice(0,4);
}
export function buildLearningPath(candidates,{subject='',target='',targetPaperIds=null,count=200}={}){
 const goals=learningGoals({subject,target}),targetIds=targetPaperIds?new Set(targetPaperIds):null;
 const limit=Math.min(200,Math.max(1,Math.floor(Number(count)||200)));
 const seenIds=new Set(),seenTitles=new Set(),seenDois=new Set(),classified=[];
 for(const [index,paper]of candidates.entries()){
  const title=normalize(paper.title),doi=String(paper.doi||'').toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//,'');
  if(seenIds.has(paper.id)||(title&&seenTitles.has(title))||(doi&&seenDois.has(doi)))continue;
  seenIds.add(paper.id);if(title)seenTitles.add(title);if(doi)seenDois.add(doi);
  classified.push({paper,index,assessment:assessLearning(paper),dependencies:[]});
 }
 const scopeMatches=(record,stage)=>stage<3?(coversSubject(record.paper,subject)||targetIds?.has(record.paper.id)):(targetIds?targetIds.has(record.paper.id):coversSubject(record.paper,subject));
 const pools=goals.map(()=>[]);
 // Build a dependency graph over all supported candidates, rather than choosing
 // one foundation and discarding other readings that could provide a useful bridge.
 for(const goal of goals){
  for(const record of classified){
   const {paper,assessment}=record;
   if(!assessment.supported||assessment.level!==goal.stage||!scopeMatches(record,goal.stage))continue;
   if(!assessment.assumed.every(required=>goal.stage>=2&&pools[1].length&&normalize(required)===normalize(subject)))continue;
   const dependencies=[];
   for(const requiredGoal of goal.requires){
    const requiredStage=LEARNING_STAGES.findIndex(stage=>stage.id===requiredGoal);
    const options=pools[requiredStage].map(prior=>({prior,bridge:goal.stage>=2?contentBridge(prior.paper,paper,subject):[]}))
     .filter(option=>goal.stage<2||option.bridge.length)
     .sort((a,b)=>b.bridge.length-a.bridge.length||a.prior.index-b.prior.index);
    if(!options.length)break;
    dependencies.push(options[0].prior);
   }
   if(dependencies.length!==goal.requires.length)continue;
   record.dependencies=dependencies;pools[goal.stage].push(record);
  }
 }
 const selected=new Map(),closureCache=new Map();
 function closure(record){
  if(closureCache.has(record))return closureCache.get(record);
  const result=new Map();
  for(const prerequisite of record.dependencies)for(const [id,item]of closure(prerequisite))result.set(id,item);
  result.set(record.paper.id,record);closureCache.set(record,result);return result;
 }
 function missing(record){return [...closure(record).values()].filter(item=>!selected.has(item.paper.id))}
 function include(records){for(const record of records)selected.set(record.paper.id,record)}
 // Establish the deepest reachable progression that fits the reading budget first.
 for(let stage=goals.length-1;stage>=0;stage--){
  const seed=pools[stage].map(record=>({record,needed:missing(record)})).filter(item=>item.needed.length<=limit)
   .sort((a,b)=>a.needed.length-b.needed.length||a.record.index-b.record.index)[0];
  if(seed){include(seed.needed);break}
 }
 const excluded=new Set([...bridgeStop,...terms(subject)]);
 const vocabularyCache=new Map();
 const vocabulary=record=>{
  if(!vocabularyCache.has(record))vocabularyCache.set(record,new Set(terms([record.paper.title,record.paper.abstract,record.paper.keywords].join(' ')).filter(word=>word.length>3&&!excluded.has(word))));
  return vocabularyCache.get(record);
 };
 const all=pools.flat();
 // Expand by complementary content. Stages are categories, not five fixed slots
 // or percentage quotas. A candidate brings its prerequisites with it.
 while(selected.size<limit){
  const covered=new Set([...selected.values()].flatMap(record=>[...vocabulary(record)].map(word=>record.assessment.level+':'+word)));
  let best=null;
  for(const record of all){
   if(selected.has(record.paper.id))continue;
   const needed=missing(record);if(selected.size+needed.length>limit)continue;
   const newTerms=new Set(needed.flatMap(item=>[...vocabulary(item)].map(word=>item.assessment.level+':'+word)).filter(word=>!covered.has(word)));
   if(newTerms.size<2)continue;
   const utility=newTerms.size/Math.sqrt(needed.reduce((size,item)=>size+vocabulary(item).size,0)||1)
    +(targetIds?.has(record.paper.id)?0.3:0);
   if(!best||utility>best.utility)best={needed,utility};
  }
  if(!best)break;include(best.needed);
 }
 const ordered=[...selected.values()].sort((a,b)=>a.assessment.level-b.assessment.level||a.index-b.index);
 const steps=ordered.map((record,index)=>{
  const {paper,assessment}=record,goal=goals[assessment.level],previous=ordered[index-1];
  const bridges=goal.stage>=2?record.dependencies.map(prior=>({from:prior.paper.id,concepts:contentBridge(prior.paper,paper,subject)})):[];
  const focus=terms(paper.title).filter(word=>word.length>3&&!excluded.has(word)).slice(0,4);
  const bridgeText=bridges.length?' Shared content with prerequisite readings: '+[...new Set(bridges.flatMap(bridge=>bridge.concepts))].join(', ')+'.':'';
  const transition=!previous?'Start here: no domain knowledge is assumed by this planned stage.':previous.assessment.level===goal.stage?'Adds a complementary reading within this stage.':`Builds on earlier prerequisites before moving to ${goal.label.toLowerCase()}.`;
  return {id:paper.id,goalId:goal.id,stage:goal.stage,stageLabel:goal.label,objective:goal.objective,requires:record.dependencies.map(prior=>prior.paper.id),evidence:assessment.evidence,confidence:assessment.confidence,bridges,
   reason:`${goal.objective}${focus.length?' Focus: '+focus.join(', ')+'.':''} Prerequisites: ${goal.requires.length?goal.requires.map(id=>LEARNING_STAGES.find(stage=>stage.id===id).label).join(', '):'None within this area'}. ${transition}${bridgeText}`};
 });
 const selectedGoals=new Set(steps.map(step=>step.goalId));
 const gaps=goals.filter(goal=>!selectedGoals.has(goal.id)).map(goal=>({stage:goal.stage,label:goal.label,reason:
  pools[goal.stage].length?'The requested reading limit was reached.':goal.requires.some(id=>!selectedGoals.has(id))?'A preceding learning objective is still missing.':
   classified.some(record=>record.assessment.level===goal.stage&&scopeMatches(record,goal.stage))?'Readings were found, but their prerequisites, abstract evidence or content bridges need review.':'No suitable reading was found for this objective.'}));
 return {version:1,subject,target,steps,papers:ordered.map(record=>record.paper),gaps,complete:gaps.length===0,goals,
  requestedCount:limit,candidateCount:classified.length,eligibleCount:all.length,selectedCount:steps.length,
  shortfall:steps.length<limit?'Fewer complementary readings with supported prerequisites were found in the loaded candidates.':''};
}
export function learningOrderIssues(steps){
 const seen=new Set(),issues=[];
 for(const step of steps){
  if(!step.goalId||!step.evidence||!Array.isArray(step.requires))issues.push('A manually added or earlier reading needs its teaching role and prerequisites reviewed.');
  if(step.requires?.some(id=>!seen.has(id)))issues.push(`Review prerequisites before “${step.stageLabel||'this reading'}”.`);
  seen.add(step.id);
 }
 return [...new Set(issues)];
}
