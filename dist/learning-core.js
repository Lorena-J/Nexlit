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
 const goals=learningGoals({subject,target}),steps=[],papers=[],covered=new Set(),used=new Set(),provided=new Set(),gaps=[];
 const targetIds=targetPaperIds?new Set(targetPaperIds):null;
 const classified=candidates.map((paper,index)=>({paper,index,assessment:assessLearning(paper)}));
 for(const goal of goals){
  const prerequisites=goal.requires.filter(id=>!covered.has(id));
  const limit=steps.length>=count;
  if(prerequisites.length||limit){gaps.push({stage:goal.stage,label:goal.label,reason:limit?'The requested reading limit was reached.':'A preceding learning objective is still missing.'});continue}
  const choices=classified.filter(({paper,assessment})=>{
   if(used.has(paper.id)||!assessment.supported||assessment.level!==goal.stage)return false;
   if(goal.stage<3?!coversSubject(paper,subject):targetIds?!targetIds.has(paper.id):!coversSubject(paper,subject))return false;
   if(!assessment.assumed.every(required=>provided.has(normalize(required))))return false;
   if(goal.stage>=2&&goal.requires.some(id=>!contentBridge(papers.find(p=>p.id===steps.find(step=>step.goalId===id)?.id),paper,subject).length))return false;
   return true;
  });
  const choice=choices[0];
  if(!choice){
   const scoped=classified.some(({paper,assessment})=>assessment.level===goal.stage&&assessment.supported&&coversSubject(paper,subject));
   const unknown=classified.some(({paper,assessment})=>assessment.level===goal.stage&&coversSubject(paper,subject)&&(!assessment.supported||assessment.assumed.length));
   gaps.push({stage:goal.stage,label:goal.label,reason:scoped?'Readings were found, but their prerequisites or content bridges need review.':unknown?'Potential readings need prerequisite or abstract review.':'No suitable reading was found for this objective.'});continue;
  }
  const {paper,assessment}=choice;
  const requiredSteps=goal.requires.map(id=>steps.find(step=>step.goalId===id)?.id).filter(Boolean);
  const previous=steps.at(-1);
  const bridges=goal.stage>=2?requiredSteps.map(id=>({from:id,concepts:contentBridge(papers.find(p=>p.id===id),paper,subject)})):[];
  const bridgeText=bridges.length?' Shared content with prerequisite readings: '+[...new Set(bridges.flatMap(bridge=>bridge.concepts))].join(', ')+'.':'';
  const transition=previous?`Builds on ${previous.stageLabel.toLowerCase()} before moving to ${goal.label.toLowerCase()}.`:'Start here: no domain knowledge is assumed by this planned stage.';
  const prerequisiteText=goal.requires.length?goal.requires.map(id=>LEARNING_STAGES.find(s=>s.id===id).label).join(', '):'None within this area';
  steps.push({id:paper.id,goalId:goal.id,stage:goal.stage,stageLabel:goal.label,objective:goal.objective,requires:requiredSteps,evidence:assessment.evidence,confidence:assessment.confidence,bridges,
   reason:`${goal.objective} Prerequisites: ${prerequisiteText}. ${transition}${bridgeText}`});
  papers.push(paper);used.add(paper.id);covered.add(goal.id);
  // Only the named foundation area is treated as covered, never every word in an abstract.
  if(goal.stage===1)provided.add(normalize(subject));
 }
 return {version:1,subject,target,steps,papers,gaps,complete:gaps.length===0,goals};
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
