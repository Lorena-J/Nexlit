import {separateNodes,visibleLabels} from './graph-layout.js?v=29';
import {mergeDiscoveryBatch,compileQuery,rankResults} from './discovery-core.js?v=29';
import {setupDiscovery} from './discovery-ui.js?v=29';
import {parseBib,connections,validateWorkspace,normalizeDoi,groupByContent,suggestReadingPlan,buildLearningPath,learningOrderIssues} from './core.js?v=29';
// Keep the existing storage key so the rename preserves saved libraries.
const $=s=>document.querySelector(s),NS='http://www.w3.org/2000/svg',KEY='atlas-library-v1';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let home=true;
let state={version:1,papers:[],manual:[]},edges=[],selected=null,hovered=null,positions=new Map(),nodeEls=new Map(),edgeEls=[],projected=new Map();
let routeFocus=false,routeLink=null,routeLinks=[],cardDrag=null;const cardPlacements=new Map();
let topicData={groups:[],assignment:new Map()},chosenTopics=new Set(),topicCenters=new Map(),layoutKey='';
const palette=['#00d4bd','#0787ff','#8338ff'];
function graphPapers(){return state.graphPaperIds?state.papers.filter(p=>state.graphPaperIds.includes(p.id)):state.papers}
function shownPapers(){return graphPapers().filter(p=>!chosenTopics.size||chosenTopics.has(topicData.assignment.get(p.id)))}
function orbFor(id){return 'url(#topic-orb-'+topicData.groups.findIndex(g=>g.id===topicData.assignment.get(id))+')'}
let pointerInGraph=false,projectionCache=null;
let camera={yaw:0,pitch:-.12,zoom:1},focus={x:0,y:0},drag=null,lastFrame=0,noticeTimer,busy=false,revision=0,summaryGeneration=0;
function html(tag,attrs={},text){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n}
function svg(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n}
function firstAuthor(p){const author=(p.authors||'').split(/\s+and\s+/i)[0].trim();return author.includes(',')?author.split(',')[0].trim():author.split(/\s+/).pop()||p.id}
function notice(text){clearTimeout(noticeTimer);$('#notice').textContent=text;$('#notice').hidden=!text;if(text)noticeTimer=setTimeout(()=>$('#notice').hidden=true,6500)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{notice('Could not save. Export a backup to keep your library.')}}
function layout(){projectionCache=null;positions.clear();topicCenters.clear();const groups=topicData.groups.filter(g=>!chosenTopics.size||chosenTopics.has(g.id));
 groups.forEach((group,gi)=>{const angle=-Math.PI/2+gi*2*Math.PI/groups.length,multi=groups.length>1;
 const center={x:multi?Math.cos(angle)*375:0,y:multi?Math.sin(angle)*205:0,z:multi?Math.sin(angle*2)*65:0};topicCenters.set(group.id,center);
 const spread=multi?Math.min(125,70+Math.sqrt(group.paperIds.length)*15):Math.min(300,120+Math.sqrt(group.paperIds.length)*35);
 group.paperIds.forEach((id,i)=>{const y=1-2*(i+.5)/group.paperIds.length,a=i*2.399963,r=Math.sqrt(1-y*y);positions.set(id,{x:center.x+Math.cos(a)*r*spread,y:center.y+y*spread*.7,z:center.z+Math.sin(a)*r*spread*.7})});
 });
}
function renderTopics(){const list=$('#topicsList');list.replaceChildren();$('#topicCount').textContent=chosenTopics.size?String(chosenTopics.size):'All';$('#allTopics').setAttribute('aria-pressed',String(!chosenTopics.size));
 topicData.groups.forEach((group,i)=>{const button=html('button',{'aria-pressed':String(chosenTopics.has(group.id))});const dot=html('span',{class:'topic-swatch'});dot.style.setProperty('--topic-color',palette[i%palette.length]);button.append(dot,html('span',{},group.label),html('span',{class:'topic-number'},String(group.paperIds.length)),html('span',{class:'topic-check','aria-hidden':'true'},chosenTopics.has(group.id)?'✓':''));button.onclick=()=>{if(chosenTopics.has(group.id))chosenTopics.delete(group.id);else chosenTopics.add(group.id);rebuild(true)};list.append(button)})
}
function toggleTopics(open){if(open)toggleReading(false);$('#topicsPanel').hidden=!open;$('#topicsToggle').setAttribute('aria-expanded',String(open))}
$('#topicsToggle').onclick=()=>toggleTopics($('#topicsPanel').hidden);
$('#allTopics').onclick=()=>{chosenTopics.clear();rebuild(true)};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.topic-filter'))toggleTopics(false);if(!e.target.closest('#readingPanel,#readingToggle'))toggleReading(false);if(selected&&!e.target.closest('#card,.node,.edge,#readingPanel,#readingToggle'))closeCard()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const wasOpen=!$('#topicsPanel').hidden;toggleTopics(false);if(wasOpen)$('#topicsToggle').focus()}});
function toggleReading(open){$('#readingPanel').hidden=!open;$('#readingToggle').setAttribute('aria-expanded',String(open));if(open)toggleTopics(false)}
$('#readingToggle').onclick=()=>toggleReading($('#readingPanel').hidden);
$('#closeReading').onclick=()=>toggleReading(false);
function openReadingArticle(id,{route=false}={}){if(home){home=false;rebuild(true)}const plan=state.readingPlan||[],index=plan.findIndex(p=>p.id===id),next=route&&state.readingEnabled&&index>=0?plan[index+1]?.id:null,needed=[id,next].filter(Boolean);if(needed.some(pid=>!shownPapers().some(p=>p.id===pid))){if(needed.some(pid=>!graphPapers().some(p=>p.id===pid))){state.graphPaperIds=null;save()}chosenTopics.clear();rebuild(true)}toggleReading(false);select(id,{route})}
function refreshRouteLink(){
 const layer=$('#routeLayer');layer.replaceChildren();routeLink=null;routeLinks=[];
 if(!state.readingEnabled)return;
 const plan=state.readingPlan||[];
 function connect(source,target,index){
  if(!positions.has(source)||!positions.has(target))return null;
  const line=svg('line',{class:'route-edge','marker-end':'url(#routeArrow)','aria-label':'Reading step '+(index+1)+' to '+(index+2)});
  line.append(svg('title',{},'Next reading step; this is not a citation.'));layer.append(line);
  const link={source,target,line};routeLinks.push(link);return link;
 }
 if(routeFocus&&selected){
  const index=plan.findIndex(item=>item.id===selected),next=index>=0?plan[index+1]?.id:null;
  if(next)routeLink=connect(selected,next,index);
 }
}


function updateReading(){const plan=state.readingPlan||[],byId=new Map(state.papers.map(p=>[p.id,p])),next=state.readingEnabled?plan.find(item=>byId.get(item.id)?.status!=='Read'):null;
 const learningIssues=state.learningMode?learningOrderIssues(plan):[];
 const coveredGoals=new Set(plan.filter(item=>['orientation','foundations','methods','applications','advanced'].includes(item.goalId)).map(item=>item.goalId));
 const incomplete=state.learningMode&&(coveredGoals.size<5||learningIssues.length>0);
 $('#readingLearningStatus').hidden=!state.learningMode;
 if(state.learningMode){
  const gaps=state.learningReport?.gaps||[];
  const counts=state.learningReport?.requestedCount?`${plan.length} / ${state.learningReport.requestedCount} readings selected from ${state.learningReport.candidateCount} loaded candidates. `:'';
  $('#readingLearningStatus').textContent=counts+(!state.learningReport?'This earlier learning path has not been assessed for prerequisites. Suggest a new path to review it.':learningIssues.length?learningIssues.join(' '):incomplete?'Partial learning path. '+(gaps[0]?gaps[0].label+': '+gaps[0].reason:'A stage has been removed or is still missing.'):'All five stages have readings. '+(state.learningReport?.shortfall||'')+' Teaching roles and prerequisites are estimates from abstracts.');
 }
 $('#readingSwitch').checked=!!state.readingEnabled;$('#readingCount').textContent=plan.length?(state.readingEnabled?String(plan.length):'Paused'):'';$('#readingEmpty').hidden=!!plan.length;$('#continueReading').disabled=!next;$('#continueReading').textContent=!state.readingEnabled?'Path paused':plan.length&&!next?'Completed ✓':'Continue ↗';const done=plan.filter(item=>byId.get(item.id)?.status==='Read').length;$('#readingProgress').textContent=plan.length?`${done} of ${plan.length} read`:'';
 if(incomplete&&plan.length&&!next&&state.readingEnabled)$('#continueReading').textContent='Read · gaps remain';
 const list=$('#readingList');list.replaceChildren();plan.forEach((item,index)=>{const p=byId.get(item.id);if(!p)return;const li=html('li',{class:'reading-item'+(p.status==='Read'?' done':'')});const number=html('button',{class:'reading-number','aria-label':'Go to step '+(index+1)},String(index+1));number.onclick=()=>openReadingArticle(p.id,{route:true});li.append(number);const content=html('div');const title=html('button',{class:'reading-title'},p.title);title.onclick=()=>openReadingArticle(p.id,{route:true});content.append(title,html('span',{class:'reading-meta'},firstAuthor(p)+' · '+(p.year||'n.d.')),html('span',{class:'reading-reason'},item.reason));
 const controls=html('div',{class:'reading-row-actions'}),label=html('label'),check=html('input',{type:'checkbox','aria-label':'Mark as read: '+p.title});check.checked=p.status==='Read';check.onchange=()=>{p.status=check.checked?'Read':'Unread';save();updateReading()};label.append(check,html('span',{},'Read'));controls.append(label);
 for(const [direction,icon,name]of [[-1,'↑','Move up'],[1,'↓','Move down']]){const move=html('button',{'aria-label':name+': '+p.title},icon);move.disabled=index+direction<0||index+direction>=plan.length;move.onclick=()=>{const target=index+direction;if(target<0||target>=plan.length)return;[plan[index],plan[target]]=[plan[target],plan[index]];save();updateReading()};controls.append(move)}
 const remove=html('button',{'aria-label':'Remove from path: '+p.title},'×');remove.onclick=()=>{state.readingPlan=plan.filter(entry=>entry.id!==p.id);save();updateReading()};controls.append(remove);content.append(controls);
 if(item.evidence){const details=html('details',{class:'reading-evidence'});details.append(html('summary',{},'Why this reading? · '+item.stageLabel),html('p',{},item.evidence));content.append(details)}
 li.append(content);list.append(li)});
 for(const [id,g]of nodeEls){const index=plan.findIndex(item=>item.id===id);g.querySelector('.route-number').textContent=state.readingEnabled&&index>=0?String(index+1):'';g.classList.toggle('route-next',id===next?.id);const p=byId.get(id),read=p?.status==='Read';g.querySelector('.read-check').textContent=read?'✓':'';g.setAttribute('aria-label',(p?.title||id)+(read?' · Read':''))}
 const current=byId.get(selected),isRead=current?.status==='Read';$('#markRead').textContent=isRead?'Read ✓':'Mark as read';$('#markRead').setAttribute('aria-pressed',String(isRead));
 const at=plan.findIndex(item=>item.id===selected);$('#addReading').textContent=at>=0?`In your path · ${at+1} ↗`:'Add to my path ＋';refreshRouteLink();highlight();paint(1/60);
}
$('#suggestReading').title='Suggested by topic, publication type and year; you can edit it.';
$('#suggestReading').onclick=()=>{
 if(!state.papers.length){notice('Import a bibliography first.');return}
 if(state.readingPlan?.length&&!confirm('Replace the current order with a new suggestion for the visible topics?'))return;
 if(state.learningMode){
  const context=state.learningReport||{subject:shownPapers()[0]?.topic?.label||'',target:''};
  let targetPaperIds=null;
  try{if(context.target)targetPaperIds=rankResults(shownPapers(),compileQuery(context.target)).filter(item=>item.eligible).map(item=>item.p.id)}catch{notice('Review the saved learning query before suggesting a new path.');return}
  const report=buildLearningPath(shownPapers(),{...context,targetPaperIds});
  if(!report.steps.length){notice('No supported beginner entry was found. Search for foundation readings first.');return}
  state.readingPlan=report.steps;state.learningReport={version:1,subject:report.subject,target:report.target,gaps:report.gaps,complete:report.complete,requestedCount:report.requestedCount,candidateCount:report.candidateCount,eligibleCount:report.eligibleCount,selectedCount:report.selectedCount,shortfall:report.shortfall};
 }else state.readingPlan=suggestReadingPlan(shownPapers());
 state.readingEnabled=true;save();updateReading();
};
$('#continueReading').onclick=()=>{if(!state.readingEnabled)return;const next=state.readingPlan?.find(item=>state.papers.find(p=>p.id===item.id)?.status!=='Read');if(next)openReadingArticle(next.id,{route:true})};
$('#addReading').onclick=()=>{if(!selected)return;state.readingPlan??=[];if(state.readingPlan.some(item=>item.id===selected)){toggleReading(true);return}if(!state.readingPlan.length)state.readingEnabled=true;state.readingPlan.push({id:selected,reason:'Added by you.'});save();updateReading()};
$('#readingSwitch').onchange=()=>{state.readingEnabled=$('#readingSwitch').checked;save();updateReading()};
$('#markRead').onclick=()=>{const p=state.papers.find(p=>p.id===selected);if(!p)return;p.status=p.status==='Read'?'Unread':'Read';save();updateReading()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleReading(false)});
function rebuild(resetLayout=false){
 home=home||!state.papers.length;
 $('.universe').classList.toggle('is-welcome',home);
 $('#empty').hidden=!home;$('#graphHeading').hidden=home;
 // SVGElement does not reflect HTMLElement.hidden; update the actual attribute.
 if(home)$('#graph').setAttribute('hidden','');else $('#graph').removeAttribute('hidden');
 $('#resumeLibrary').hidden=!state.papers.length;$('#export').disabled=!state.papers.length;
 if(home){
  positions.clear();projected.clear();nodeEls.clear();edgeEls=[];selected=null;routeLink=null;routeLinks=[];
  $('#nodeLayer').replaceChildren();$('#edgeLayer').replaceChildren();$('#routeLayer').replaceChildren();
  $('#allLibrary').hidden=true;$('#card').hidden=true;toggleTopics(false);toggleReading(false);
  return;
 }
topicData=groupByContent(graphPapers());$('#allLibrary').hidden=!state.graphPaperIds;chosenTopics=new Set([...chosenTopics].filter(id=>topicData.groups.some(g=>g.id===id)));const papers=shownPapers(),ids=new Set(papers.map(p=>p.id));edges=connections(state.papers,state.manual).filter(e=>ids.has(e.source)&&ids.has(e.target));const key=papers.map(p=>p.id+':'+topicData.assignment.get(p.id)).join('|');if(resetLayout||key!==layoutKey){layout();layoutKey=key}hovered=null;if(selected&&!ids.has(selected)){selected=null;summaryGeneration++;$('#card').hidden=true}renderTopics();$('#empty').hidden=!!state.papers.length;$('#nodeLayer').replaceChildren();$('#edgeLayer').replaceChildren();nodeEls.clear();edgeEls=[];
 const defs=$('#graph').querySelector('defs');defs.querySelectorAll('.topic-gradient').forEach(g=>g.remove());topicData.groups.forEach((group,i)=>{const gradient=svg('radialGradient',{id:'topic-orb-'+i,class:'topic-gradient',cx:'30%',cy:'25%',r:'75%'});gradient.append(svg('stop',{offset:'0','stop-color':'#b5fff1'}),svg('stop',{offset:'.22','stop-color':'#00d4bd'}),svg('stop',{offset:'.5','stop-color':palette[i%palette.length]}),svg('stop',{offset:'.72','stop-color':'#0787ff'}),svg('stop',{offset:'1','stop-color':'#8338ff'}));defs.append(gradient)});
 for(const edge of edges){const line=svg('line',{class:'edge '+edge.type,'aria-label':edge.reason});if(edge.type==='manual')line.setAttribute('stroke-dasharray','5 5');line.append(svg('title',{},edge.reason));line.onclick=e=>{e.stopPropagation();select(edge.source);notice(edge.reason)};$('#edgeLayer').append(line);edgeEls.push({edge,line})}
 for(const p of papers){const g=svg('g',{class:'node',tabindex:0,role:'button','aria-label':p.title,'data-id':p.id});g.append(svg('circle',{class:'halo',r:65,fill:'url(#halo)'}),svg('circle',{class:'pulse',r:21}),svg('circle',{class:'sphere',r:14,fill:'url(#orb)'}),svg('circle',{class:'hit-target',r:27,fill:'transparent'}));const label=svg('text',{class:'node-label','text-anchor':'middle',y:29},firstAuthor(p)+' · '+(p.year||''));g.append(label,svg('text',{class:'route-number',y:1},''),svg('text',{class:'read-check',x:19,y:-18},''),svg('title',{},p.title));g.onpointerenter=()=>{hovered=p.id;highlight();paint(0)};g.onpointerleave=()=>{hovered=null;highlight();paint(0)};g.onfocus=()=>{hovered=p.id;highlight();paint(0)};g.onblur=()=>{hovered=null;highlight();paint(0)};g.onpointerdown=e=>{e.stopPropagation()};g.onclick=e=>{e.stopPropagation();openReadingArticle(p.id,{route:!!state.readingEnabled&&state.readingPlan.some(item=>item.id===p.id)})};g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();openReadingArticle(p.id,{route:!!state.readingEnabled&&state.readingPlan.some(item=>item.id===p.id)})}};$('#nodeLayer').append(g);nodeEls.set(p.id,g)}highlight();updateReading();paint(1)}
function highlight(){
 const id=hovered??selected,neighbors=new Set();
 edges.forEach(edge=>{if(edge.source===id)neighbors.add(edge.target);if(edge.target===id)neighbors.add(edge.source)});
 if(routeLink)neighbors.add(routeLink.target);
 for(const [pid,g]of nodeEls){
  g.classList.toggle('selected',pid===selected);g.classList.toggle('hovered',pid===hovered);g.classList.toggle('neighbor',neighbors.has(pid));
  g.querySelector('.sphere').setAttribute('fill',pid===selected?'url(#orbActive)':orbFor(pid));
  g.dataset.dim=id&&pid!==id&&!neighbors.has(pid)?'1':'0';
 }
 // Learning order is an overlay; it never replaces the graph's evidence-based connections.
 for(const {edge,line}of edgeEls){
  const active=edge.source===id||edge.target===id;
  line.classList.toggle('active',active);line.dataset.active=active?'1':'0';
  if(edge.type==='citation'&&active)line.setAttribute('marker-end','url(#arrow)');else line.removeAttribute('marker-end');
 }
}
function project(pos){const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch),x=pos.x*cy+pos.z*sy,z=pos.z*cy-pos.x*sy,y=pos.y*cp-z*sp,depth=pos.y*sp+z*cp,scale=790/(790-depth);return{x:x*scale*camera.zoom,y:y*scale*camera.zoom,z:depth,scale:scale*camera.zoom}}
function paint(dt){
 const projectionKey=[camera.yaw,camera.pitch,camera.zoom,selected].join('|');
 if(projectionCache?.key===projectionKey)projected=projectionCache.points;
 else{
 projected=new Map([...positions].map(([id,p])=>[id,project(p)]));
 // Zoom spreads positions without enlarging hit areas over neighbouring nodes.
 const points=[...projected].map(([id,p])=>({id,x:p.x,y:p.y,visualRadius:Math.max(12,Math.min(19,p.scale/camera.zoom*14))*(id===selected?1.6:1),radius:Math.max(22,Math.max(12,Math.min(19,p.scale/camera.zoom*14))*(id===selected?1.6:1))}));
 for(const p of separateNodes(points)){const target=projected.get(p.id);target.x=p.x;target.y=p.y;target.radius=p.visualRadius}
 projectionCache={key:projectionKey,points:projected};
 }
 const active=projected.get(selected),target=active?{x:-active.x*.8,y:-active.y*.65}:{x:0,y:0};
 const ease=pointerInGraph&&(!selected||hovered)?0:reduced?1:1-Math.exp(-dt*4);focus.x+=(target.x-focus.x)*ease;focus.y+=(target.y-focus.y)*ease;
 const labels=[];
 for(const [id,p]of projected){
  p.sx=600+p.x+focus.x;p.sy=345+p.y+focus.y;
  const g=nodeEls.get(id),size=p.radius/14;
  g.setAttribute('transform',`translate(${p.sx} ${p.sy}) scale(${size})`);
  g.querySelector('.hit-target').setAttribute('r',Math.max(22,p.radius)/size);
  g.style.opacity=g.dataset.dim==='1'?.48:Math.max(.65,Math.min(1,(p.z+420)/650));
  const label=g.querySelector('.node-label');
  labels.push({id,x:p.sx,y:p.sy+29*size,width:Math.max(40,label.textContent.length*6.5)*size,height:15*size});
 }
 const visible=visibleLabels(labels,{priority:[hovered,selected].filter(Boolean)});
 for(const [id,g]of nodeEls)g.querySelector('.node-label').style.opacity=visible.has(id)?'1':'0';
 for(const {edge,line}of edgeEls){const a=projected.get(edge.source),b=projected.get(edge.target);line.setAttribute('x1',a.sx);line.setAttribute('y1',a.sy);line.setAttribute('x2',b.sx);line.setAttribute('y2',b.sy);line.setAttribute('stroke-opacity',line.dataset.active==='1'?.95:.65)}
 for(const link of routeLinks){const a=projected.get(link.source),b=projected.get(link.target);if(a&&b){link.line.setAttribute('x1',a.sx);link.line.setAttribute('y1',a.sy);link.line.setAttribute('x2',b.sx);link.line.setAttribute('y2',b.sy)}}
 // Keep node elements attached: reparenting during animation interrupts pointer clicks and focus.
 if(selected)positionCard();}

function constrainCard(x,y){const wrap=$('.universe').getBoundingClientRect(),card=$('#card');return {x:Math.max(12,Math.min(x,Math.max(12,wrap.width-card.offsetWidth-12))),y:Math.max(12,Math.min(y,Math.max(12,wrap.height-card.offsetHeight-12)))}}
function positionCard(){const p=projected.get(selected);if(!p)return;const card=$('#card'),manual=cardPlacements.get(selected);if(manual){const pos=constrainCard(manual.x,manual.y);cardPlacements.set(selected,pos);card.style.left=pos.x+'px';card.style.top=pos.y+'px';return}const graph=$('#graph'),wrap=$('.universe').getBoundingClientRect(),pt=graph.createSVGPoint();pt.x=p.sx;pt.y=p.sy;const screen=pt.matrixTransform(graph.getScreenCTM());let x=screen.x-wrap.left+42*p.scale,y=screen.y-wrap.top-35;
 if(innerWidth<650){x=(wrap.width-card.offsetWidth)/2;y=Math.max(12,wrap.height-card.offsetHeight-55)}else if(x+card.offsetWidth>wrap.width-16)x=screen.x-wrap.left-card.offsetWidth-42*p.scale;const pos=constrainCard(x,y);card.style.left=pos.x+'px';card.style.top=pos.y+'px'}
const card=$('#card');
function endCardDrag(){cardDrag=null;card.classList.toggle('dragging',false)}
card.addEventListener('pointerdown',e=>{if(!selected||(e.button!==undefined&&e.button!==0)||e.target.closest('button,a,input,select,textarea,#summary,#cardTitle'))return;e.preventDefault();e.stopPropagation();card.getAnimations().forEach(a=>a.cancel());cardDrag={id:selected,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:parseFloat(card.style.left)||12,y:parseFloat(card.style.top)||12};card.classList.toggle('dragging',true);card.setPointerCapture(e.pointerId)});
card.addEventListener('pointermove',e=>{if(!cardDrag||e.pointerId!==cardDrag.pointer)return;e.preventDefault();const pos=constrainCard(cardDrag.x+e.clientX-cardDrag.startX,cardDrag.y+e.clientY-cardDrag.startY);cardPlacements.set(cardDrag.id,pos);positionCard()});
for(const event of ['pointerup','pointercancel','lostpointercapture'])card.addEventListener(event,endCardDrag);
card.addEventListener('selectstart',e=>{if(cardDrag)e.preventDefault()});
$('#cardDragHandle').addEventListener('keydown',e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta||!selected)return;e.preventDefault();const step=e.shiftKey?30:10,pos=constrainCard((parseFloat(card.style.left)||12)+delta[0]*step,(parseFloat(card.style.top)||12)+delta[1]*step);cardPlacements.set(selected,pos);positionCard()});

function select(id,{route=false}={}){endCardDrag();routeFocus=route;if(id)toggleReading(false);summaryGeneration++;selected=id;hovered=null;const p=state.papers.find(p=>p.id===id);$('#card').hidden=!p;if(p){$('#cardTitle').textContent=p.title;$('#summary').hidden=true;$('#summary').replaceChildren();$('#summarize').disabled=false;$('#summarize').textContent='Summarize paper ↗';$('#card').getAnimations().forEach(a=>a.cancel());if(!reduced)$('#card').animate([{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:350,easing:'ease-out'})}highlight();updateReading();paint(1/60)}
function closeCard(){select(null)}$('#closeCard').onclick=closeCard;document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCard();$('#graph').focus()}});
$('#graph').addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();if(e.target.closest('.node,.edge'))return;drag={x:e.clientX,y:e.clientY,yaw:camera.yaw,pitch:camera.pitch,moved:false};$('#graph').setPointerCapture(e.pointerId)});$('#graph').addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;camera.yaw=drag.yaw+dx*.006;camera.pitch=Math.max(-1.3,Math.min(1.3,drag.pitch+dy*.004));if(reduced)paint(1)});$('#graph').addEventListener('pointerup',e=>{if(drag&&!drag.moved&&!e.target.closest('.edge,.node'))closeCard();drag=null});$('#graph').addEventListener('pointercancel',()=>drag=null);$('#graph').addEventListener('lostpointercapture',()=>drag=null);for(const event of ['selectstart','dragstart'])$('#graph').addEventListener(event,e=>e.preventDefault());$('#graph').addEventListener('wheel',e=>{e.preventDefault();setZoom(camera.zoom*Math.exp(-e.deltaY*.001))},{passive:false});$('#fit').onclick=()=>{camera={yaw:0,pitch:-.12,zoom:1};focus={x:0,y:0};closeCard();if(reduced)paint(1)};
function setZoom(value){camera.zoom=Math.max(.35,Math.min(6,value));paint(1)}
$('#zoomIn').onclick=()=>setZoom(camera.zoom*1.35);
$('#zoomOut').onclick=()=>setZoom(camera.zoom/1.35);
$('#graph').addEventListener('pointerenter',()=>{pointerInGraph=true});
$('#graph').addEventListener('pointerleave',()=>{pointerInGraph=false});
function animate(t){const dt=Math.min(.05,(t-lastFrame)/1000||.016);lastFrame=t;if(!home&&!reduced&&!selected&&!hovered&&!drag&&!pointerInGraph)camera.yaw+=dt*.045;if(!home&&!document.hidden&&state.papers.length)paint(dt);requestAnimationFrame(animate)}if(!reduced)requestAnimationFrame(animate);new ResizeObserver(()=>{if(state.papers.length)paint(1)}).observe($('.universe'));
function safeUrl(p){try{const u=new URL(p.doi?'https://doi.org/'+p.doi:p.url);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}}
async function fetchMetadata(p){if(!p.doi)return false;const res=await fetch('https://api.crossref.org/works/'+encodeURIComponent(normalizeDoi(p.doi)),{signal:AbortSignal.timeout(16000)});if(!res.ok)throw Error('Crossref unavailable');const {message:m}=await res.json();if(m.abstract){const doc=new DOMParser().parseFromString(m.abstract,'text/html');p.abstract=(doc.body.textContent||'').trim()}p.references=(m.reference??[]).map(r=>normalizeDoi(r.DOI??'')).filter(Boolean);p.lookup='ok';p.lookupDate=new Date().toISOString();return true}
// Extractive summary: retain original sentences rather than infer findings from a title.
function summarizeAbstract(text){const sentences=text.replace(/\s+/g,' ').trim().match(/[^.!?]+(?:[.!?]+(?:\s|$)|$)/g)?.map(s=>s.trim()).filter(Boolean)??[text];if(sentences.length<=4)return sentences.join(' ');const cues=/\b(show|found|demonstrat|result|conclud|suggest|reveal|here|we|report|identify|identified)\w*/i;const scored=sentences.map((s,i)=>({s,i,score:(i===0?3:0)+(i===sentences.length-1?2:0)+(cues.test(s)?2:0)}));return scored.sort((a,b)=>b.score-a.score).slice(0,3).sort((a,b)=>a.i-b.i).map(x=>x.s).join(' ')}
$('#summarize').onclick=async()=>{const p=state.papers.find(p=>p.id===selected);if(!p)return;const generation=++summaryGeneration,rev=revision;$('#summarize').disabled=true;$('#summarize').textContent='Preparing summary…';const box=$('#summary');box.hidden=false;box.replaceChildren();try{if(!p.abstract&&p.doi){await fetchMetadata(p);if(rev===revision){save();rebuild()}}if(generation!==summaryGeneration||rev!==revision)return;if(p.abstract){box.append(html('small',{},'EXTRACTIVE ABSTRACT SUMMARY'),html('p',{},summarizeAbstract(p.abstract)))}else box.append(html('p',{},'No abstract is available to summarize this paper.'));const url=safeUrl(p);if(url)box.append(html('a',{href:url,target:'_blank',rel:'noopener noreferrer'},'Open paper ↗'))}catch{if(generation===summaryGeneration){box.append(html('p',{},'Could not retrieve the text. Please try again.'));const url=safeUrl(p);if(url)box.append(html('a',{href:url,target:'_blank',rel:'noopener noreferrer'},'Open paper ↗'))}}finally{if(generation===summaryGeneration){$('#summarize').disabled=false;$('#summarize').textContent='Summarize paper ↗';positionCard()}}};
function replace(data,persist=true){if(persist)home=false;revision++;summaryGeneration++;state=data;state.readingPlan??=[];state.readingEnabled??=state.readingPlan.length>0;chosenTopics.clear();layoutKey='';selected=null;hovered=null;camera={yaw:0,pitch:-.12,zoom:1};focus={x:0,y:0};$('#card').hidden=true;if(persist)save();rebuild(true)}
$('#welcomeSearch').onclick=()=>$('#discoverOpen').onclick();
$('#resumeLibrary').onclick=()=>{if(state.papers.length){home=false;rebuild(true)}};
$('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5e6)throw Error('The file exceeds 5 MB.');const text=await file.text(),data=file.name.toLowerCase().endsWith('.json')?validateWorkspace(JSON.parse(text)):{version:1,papers:parseBib(text),manual:[]};if(state.papers.length&&!confirm('Replace the current library? Export a backup if you want to keep it.'))return;replace(data)}catch(error){notice(error.message)}finally{e.target.value=''}};
$('#export').onclick=()=>{if(!state.papers.length){notice('Import a bibliography first.');return}const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));html('a',{href:url,download:'nexlit-library.json'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('#enrich').onclick=async()=>{if(busy)return;const papers=state.papers.filter(p=>p.doi&&p.lookup!=='ok');if(!papers.length){notice('Metadata is up to date.');return}busy=true;$('#enrich').disabled=true;$('#file').disabled=true;const rev=revision;let failed=0;try{for(let i=0;i<papers.length;i++){notice(`Updating ${i+1}/${papers.length}…`);try{await fetchMetadata(papers[i])}catch{papers[i].lookup='error';failed++}if(rev!==revision)break;save()}if(rev===revision)rebuild();notice(failed?`Metadata is unavailable for ${failed} references.`:'Metadata is up to date.')}finally{busy=false;$('#enrich').disabled=false;$('#file').disabled=false}};
$('#allLibrary').onclick=()=>{state.graphPaperIds=null;chosenTopics.clear();save();rebuild(true)};
setupDiscovery({getPapers:()=>state.papers,addPaper:paper=>{const duplicate=state.papers.find(p=>(p.doi&&paper.doi&&normalizeDoi(p.doi)===normalizeDoi(paper.doi))||p.id===paper.id||p.title.toLowerCase()===paper.title.toLowerCase());if(duplicate)return duplicate;let id=paper.id,suffix=2;while(state.papers.some(p=>p.id===id))id=paper.id+'-'+suffix++;const added={...paper,id};state.papers.push(added);if(home){home=false;state.graphPaperIds=null}save();rebuild(true);return added},createGraph:(incoming,{learning=false,learningPath=null}={})=>{
 const report=learning?(learningPath||buildLearningPath(incoming,{subject:incoming[0]?.topic?.label||''})):null;
 if(learning&&!report.steps.length){notice('No supported beginner entry was found. The existing library and path were kept.');return}
 home=false;const merged=mergeDiscoveryBatch(state.papers,incoming);
 const mappedId=id=>{const p=incoming.find(item=>item.id===id);return merged.papers.find(known=>known.id===id||(p?.doi&&normalizeDoi(known.doi)===normalizeDoi(p.doi))||(p?.title&&known.title.toLowerCase()===p.title.toLowerCase()))?.id};
 state.papers=merged.papers;state.graphPaperIds=merged.ids;state.learningMode=learning;
 if(learning){
  state.readingPlan=report.steps.map(step=>({...step,id:mappedId(step.id),requires:step.requires.map(mappedId),bridges:(step.bridges||[]).map(bridge=>({...bridge,from:mappedId(bridge.from)}))}));
  state.learningReport={version:1,subject:report.subject,target:report.target,gaps:report.gaps,complete:report.complete,requestedCount:report.requestedCount,candidateCount:report.candidateCount,eligibleCount:report.eligibleCount,selectedCount:report.selectedCount,shortfall:report.shortfall};state.readingEnabled=true;
 }
 routeFocus=false;chosenTopics.clear();selected=null;summaryGeneration++;$('#card').hidden=true;save();rebuild(true);
 notice(learning?'Learning path created with '+state.readingPlan.length+' readings.'+(report.complete?'':' A prerequisite stage is missing; review the path details.'):'Graph created with '+merged.ids.length+' papers.');
},pickPaper:id=>openReadingArticle(id)});
try{const saved=localStorage.getItem(KEY);if(saved)replace(validateWorkspace(JSON.parse(saved)),false);else rebuild()}catch{rebuild();notice('Could not restore the library. Import a JSON backup.')}
