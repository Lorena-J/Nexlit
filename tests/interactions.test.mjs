import {separateNodes,visibleLabels} from '../dist/graph-layout.js';
import {createOpenAlexClient as realOpenAlexClient} from '../dist/openalex-client.js';
const createOpenAlexClient=options=>realOpenAlexClient({...options,cacheTTL:0,minInterval:0});
import * as discoveryCore from '../dist/discovery-core.js';
import * as learningCore from '../dist/learning-core.js';
import {lessonPapers,asOpenAlex} from './fixtures/learning.mjs';
import {mergeDiscoveryBatch} from '../dist/discovery-core.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../dist/core.js';

// DOM doubles exercise application events; SVG hit testing still needs visual browser QA.
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs={};this.style={setProperty(k,v){this[k]=v}};this.dataset={};this.hidden=false;this.handlers={};this.offsetWidth=290;this.offsetHeight=180;this.parent=null;this.moves=0;this.textContent='';this.classList={toggle:(name,on)=>{const classes=new Set((this.attrs.class||'').split(' '));on?classes.add(name):classes.delete(name);this.attrs.class=[...classes].join(' ')}}}
  setAttribute(k,v){this.attrs[k]=String(v)}
  removeAttribute(k){delete this.attrs[k]}
  append(...nodes){for(const n of nodes){if(n.parent){n.moves++;n.parent.children=n.parent.children.filter(x=>x!==n)}n.parent=this;this.children.push(n)}}
  replaceChildren(...nodes){for(const n of this.children)n.parent=null;this.children=[];this.append(...nodes)}
  querySelector(s){return this.children.find(c=>s.startsWith('.')?(c.attrs.class||'').split(' ').includes(s.slice(1)):c.tagName===s)}
  querySelectorAll(s){return this.children.filter(c=>(c.attrs.class||'').split(' ').includes(s.slice(1)))}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this)}
  addEventListener(type,fn){this.handlers[type]=fn}
  getAnimations(){return []} animate(){} focus(){this.onfocus?.()} showModal(){this.open=true} close(){this.open=false}
  getBoundingClientRect(){return {width:1200,height:720,left:0,top:0}}
  createSVGPoint(){return {x:0,y:0,matrixTransform(){return {x:this.x,y:this.y}}}}
  getScreenCTM(){return {}} setPointerCapture(){}
}
const page=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),elements=new Map();
for(const match of page.matchAll(/id="([^"]+)"/g))elements.set('#'+match[1],new Element());
// SVG hidden is not an HTMLElement property: assigning .hidden does not reflect the attribute.
elements.get('#graph').setAttribute('hidden','');
elements.get('#topicsPanel').hidden=true;elements.get('#readingPanel').hidden=true;
elements.set('.universe',new Element());elements.get('#graph').append(new Element('defs'));
const papers=core.parseBib(readFileSync(new URL('../dist/example.bib',import.meta.url),'utf8'));
papers[0].abstract='We studied hippocampal representations. We found a distinct population response. These results support social memory processing.';
let animation,savedState;const docHandlers=new Map();
const context=vm.createContext({separateNodes,visibleLabels,core,console,discoveryConfig:null,discoveryMerge:mergeDiscoveryBatch,document:{hidden:false,querySelector:s=>elements.get(s),createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),addEventListener(type,fn){if(!docHandlers.has(type))docHandlers.set(type,[]);docHandlers.get(type).push(fn)}},localStorage:{getItem:()=>JSON.stringify({version:1,papers,manual:[]}),setItem(key,value){savedState=JSON.parse(value)}},matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>animation=fn,innerWidth:1200,setTimeout,clearTimeout,URL,Blob,confirm:()=>true});
const source="const {parseBib,connections,validateWorkspace,normalizeDoi,groupByContent,suggestReadingPlan,buildLearningPath,learningOrderIssues}=core;const mergeDiscoveryBatch=discoveryMerge;const setupDiscovery=config=>{discoveryConfig=config};\n"+readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
await vm.runInContext('(async()=>{'+source+'})()',context);
assert.equal(elements.get('#empty').hidden,false);
assert(Object.hasOwn(elements.get('#graph').attrs,'hidden'));
assert.equal(elements.get('#nodeLayer').children.length,0,'Opening the app must not render a saved graph automatically');
assert.equal(elements.get('#resumeLibrary').hidden,false);
elements.get('#resumeLibrary').onclick();
assert(!Object.hasOwn(elements.get('#graph').attrs,'hidden'),'Resuming must remove the SVG hidden attribute, not just assign an unrelated property');
const nodes=elements.get('#nodeLayer').children;
assert.equal(nodes.length,11);
const event={stopPropagation(){},preventDefault(){}};
for(let i=0;i<100;i++)animation(i*16);
assert(nodes.every(n=>n.moves===0),'Animation must not detach or reparent nodes');
for(const [i,node] of nodes.entries()){
  node.onclick(event);
  assert.equal(elements.get('#card').hidden,false,'Every node must open the card');
  assert.equal(elements.get('#cardTitle').textContent,papers[i].title);
  assert(node.attrs.class.includes('selected'));
  animation(1700+i*16);
  assert(Number.isFinite(parseFloat(elements.get('#card').style.left)));
  assert(Number.isFinite(parseFloat(elements.get('#card').style.top)));
}
elements.get('#closeCard').onclick();assert.equal(elements.get('#card').hidden,true);
nodes[0].onkeydown({...event,key:'Enter'});assert.equal(elements.get('#card').hidden,false);
await elements.get('#summarize').onclick();assert.equal(elements.get('#summary').hidden,false);assert(elements.get('#summary').children.some(n=>n.textContent.includes('We found')));
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
assert(css.includes('.node .halo{pointer-events:none;'));
assert(css.includes('fill:#d8e6f0;opacity:1;'));
assert(css.includes('.node .hit-target{pointer-events:all}'));
console.log('11 nodes: clicks, cards, keyboard access and summaries pass. Animation is stable over 100 frames.');
// Zoom separates centres without making their click targets swallow their neighbours.
elements.get('#closeCard').onclick();
elements.get('#graph').handlers.pointerenter();animation(1900);
const before=nodes.map(node=>node.attrs.transform);
animation(1916);assert.deepEqual(nodes.map(node=>node.attrs.transform),before,'Rotation must stop while the pointer is in the graph');
const beforeRadius=Number(nodes[0].querySelector('.hit-target').attrs.r);
for(let i=0;i<8;i++)elements.get('#zoomIn').onclick();
assert.notDeepEqual(nodes.map(node=>node.attrs.transform),before);
assert.equal(Number(nodes[0].querySelector('.hit-target').attrs.r),beforeRadius,'Zoom must not enlarge the hit targets');
for(let i=0;i<8;i++)elements.get('#zoomOut').onclick();
elements.get('#fit').onclick();
nodes[0].onpointerenter();animation(1932);
assert.equal(nodes[0].querySelector('.node-label').style.opacity,'1','The hovered label must remain readable');
nodes[0].onpointerleave();elements.get('#graph').handlers.pointerleave();
console.log('Dense graph controls: stationary hover, constant-size zoom targets and hovered labels pass.');


const topicList=elements.get('#topicsList');
const expectedGroups=core.groupByContent(papers).groups;assert.equal(topicList.children.length,expectedGroups.length);
elements.get('#topicsToggle').onclick();assert.equal(elements.get('#topicsPanel').hidden,false);
const firstGroup=expectedGroups.find(g=>!g.paperIds.includes(papers[0].id));topicList.children.find(b=>b.children[1].textContent===firstGroup.label).onclick();
assert.equal(elements.get('#nodeLayer').children.length,firstGroup.paperIds.length);
assert.equal(elements.get('#card').hidden,true,'Filtering out the selected article closes its card');
assert.equal(elements.get('#topicCount').textContent,'1');
const currentNodes=elements.get('#nodeLayer').children;currentNodes[0].onclick(event);assert.equal(elements.get('#card').hidden,false);
const secondGroup=expectedGroups.find(g=>g.id!==firstGroup.id);topicList.children.find(b=>b.children[1].textContent===secondGroup.label).onclick();
assert.equal(elements.get('#nodeLayer').children.length,firstGroup.paperIds.length+secondGroup.paperIds.length);
elements.get('#allTopics').onclick();assert.equal(elements.get('#nodeLayer').children.length,11);
assert.equal(elements.get('#topicCount').textContent,'All');
assert(!page.includes('id="topicLayer"'));
const unknown=[{id:'a',title:'Lithium battery electrodes'},{id:'b',title:'Lithium battery durability'}];
const groups=core.groupByContent(unknown);assert.equal(groups.groups.length,1);assert.deepEqual(groups.groups[0].paperIds,['a','b']);
console.log('Topic grouping, multiple filters, selection, reset and multidisciplinary topics pass.');

// Reading route: suggest, reorder, remove, add, resume, persist and validate imported plans.
elements.get('#readingToggle').onclick();assert.equal(elements.get('#readingPanel').hidden,false);
elements.get('#suggestReading').onclick();
let reading=elements.get('#readingList').children;assert.equal(reading.length,11);
assert.equal(reading[0].children[1].children[0].textContent,papers.find(p=>p.id==='oliva2022').title);
const firstTitle=reading[0].children[1].children[0].textContent;
reading[0].children[1].children[3].children[2].onclick();
reading=elements.get('#readingList').children;
assert.equal(reading[1].children[1].children[0].textContent,firstTitle,'Move down changes the order');
const titleAtStart=reading[0].children[1].children[0].textContent;
const checkbox=reading[0].children[1].children[3].children[0].children[0];checkbox.checked=true;checkbox.onchange();
assert.equal(elements.get('#readingProgress').textContent,'1 of 11 read');
elements.get('#continueReading').onclick();assert.equal(elements.get('#cardTitle').textContent,firstTitle);assert.equal(elements.get('#readingPanel').hidden,true);
reading=elements.get('#readingList').children;reading[0].children[1].children[3].children[3].onclick();assert.equal(elements.get('#readingList').children.length,10);
const removedPaper=papers.find(p=>p.title===titleAtStart);elements.get('#nodeLayer').children.find(n=>n.attrs['data-id']===removedPaper.id).onclick(event);
elements.get('#addReading').onclick();assert.equal(elements.get('#readingList').children.length,11);
elements.get('#addReading').onclick();assert.equal(elements.get('#readingList').children.length,11,'Adding twice does not duplicate an article');
const plan=core.suggestReadingPlan(papers);assert.equal(new Set(plan.map(x=>x.id)).size,papers.length);
const exported={version:1,papers,manual:[],readingPlan:plan};const imported=core.validateWorkspace(JSON.parse(JSON.stringify(exported)));assert.deepEqual(imported.readingPlan,plan);
assert.throws(()=>core.validateWorkspace({...exported,readingPlan:[plan[0],plan[0]]}));
assert.throws(()=>core.validateWorkspace({...exported,readingPlan:[{id:'missing',reason:'invalid'}]}));
const valid=core.validateWorkspace({version:1,papers,manual:[]});assert.deepEqual(valid.readingPlan,[]);
console.log('Reading paths: suggestions, reordering, progress, resume, removal, deduplication and import/export pass.');

// Pause the route without deleting it; read/unread state remains independent of route membership.
const selectedTitle=elements.get('#cardTitle').textContent;
let row=elements.get('#readingList').children.find(item=>item.children[1].children[0].textContent===selectedTitle);
row.children[1].children[3].children[3].onclick();
const planBefore=JSON.stringify(savedState.readingPlan);
elements.get('#readingSwitch').checked=false;elements.get('#readingSwitch').onchange();
assert.equal(savedState.readingEnabled,false);assert.equal(JSON.stringify(savedState.readingPlan),planBefore);
assert(elements.get('#nodeLayer').children.every(n=>n.querySelector('.route-number').textContent===''));
assert(elements.get('#nodeLayer').children.every(n=>!n.attrs.class.includes('route-next')));
assert.equal(elements.get('#continueReading').disabled,true);
const wasRead=elements.get('#markRead').attrs['aria-pressed']==='true';
elements.get('#markRead').onclick();assert.equal(elements.get('#markRead').attrs['aria-pressed'],String(!wasRead));
elements.get('#markRead').onclick();assert.equal(elements.get('#markRead').attrs['aria-pressed'],String(wasRead));
if(!wasRead)elements.get('#markRead').onclick();
const readPaper=savedState.papers.find(p=>p.title===selectedTitle);
assert.equal(readPaper.status,'Read');assert(!savedState.readingPlan.some(item=>item.id===readPaper.id));
const readNode=elements.get('#nodeLayer').children.find(n=>n.attrs['data-id']===readPaper.id);
assert.equal(readNode.querySelector('.read-check').textContent,'✓');
assert.equal(core.validateWorkspace(JSON.parse(JSON.stringify(savedState))).readingEnabled,false);
elements.get('#readingSwitch').checked=true;elements.get('#readingSwitch').onchange();
assert.equal(savedState.readingEnabled,true);assert.equal(JSON.stringify(savedState.readingPlan),planBefore);
assert(elements.get('#nodeLayer').children.some(n=>n.querySelector('.route-number').textContent!==''));
assert(css.includes('#graph:focus{outline:none}'));
console.log('Path toggling, independent read status, persistence and graph focus pass.');

const previousLibrary=JSON.parse(JSON.stringify(savedState.papers)),previousPlan=JSON.stringify(savedState.readingPlan);
context.discoveryConfig.createGraph(papers.slice(0,2));assert.equal(elements.get('#nodeLayer').children.length,2);assert.equal(savedState.papers.length,previousLibrary.length);assert.deepEqual(savedState.papers,previousLibrary);assert.equal(JSON.stringify(savedState.readingPlan),previousPlan);assert.equal(elements.get('#allLibrary').hidden,false);
assert.equal(core.validateWorkspace(JSON.parse(JSON.stringify(savedState))).graphPaperIds.length,2);
elements.get('#allLibrary').onclick();assert.equal(elements.get('#nodeLayer').children.length,11);assert.equal(savedState.graphPaperIds,null);
console.log('Graph size, library preservation, reading path preservation and full-library reset pass.');

context.discoveryConfig.createGraph(lessonPapers,{learning:true,learningPath:core.buildLearningPath(lessonPapers,{subject:'graph theory'})});assert(savedState.learningMode);assert(savedState.readingEnabled);assert.equal(savedState.readingPlan.length,5);
const relationshipCount=elements.get('#edgeLayer').children.length;
assert(relationshipCount>0,'Learning graphs must retain their topic/citation connections');
const assertRelationshipsVisible=()=>{
 assert.equal(elements.get('#edgeLayer').children.length,relationshipCount);
 assert(elements.get('#edgeLayer').children.every(edge=>Number(edge.attrs['stroke-opacity'])>=.65),'All relationship lines must remain clearly visible, including edges outside the selection');
 assert(elements.get('#edgeLayer').children.every(edge=>edge.style.pointerEvents!=='none'),'Relationship lines must stay interactive');
};
assert.equal(elements.get('#routeLayer').children.length,0,'No reading-order arrows before selecting a step');
assertRelationshipsVisible();
for(let frame=0;frame<30;frame++){animation(4000+frame*16);assertRelationshipsVisible()}
elements.get('#readingSwitch').checked=false;elements.get('#readingSwitch').onchange();assert.equal(elements.get('#routeLayer').children.length,0);assertRelationshipsVisible();
elements.get('#readingSwitch').checked=true;elements.get('#readingSwitch').onchange();assert.equal(elements.get('#routeLayer').children.length,0);assertRelationshipsVisible();
elements.get('#readingList').children[0].children[0].onclick();assert.equal(elements.get('#routeLayer').children.length,1);assertRelationshipsVisible();
assert.equal(elements.get('#routeLayer').children[0].attrs['aria-label'],'Reading step 1 to 2');
assert(elements.get('#edgeLayer').children.some(edge=>edge.dataset.active==='0'),'Fixture must include edges unrelated to the selected reading');
for(let frame=0;frame<30;frame++){animation(5000+frame*16);assertRelationshipsVisible()}
for(const coordinate of ['x1','y1','x2','y2'])assert(Number.isFinite(Number(elements.get('#routeLayer').children[0].attrs[coordinate])));
elements.get('#readingList').children[1].children[0].onclick();assert.equal(elements.get('#routeLayer').children.length,1);assertRelationshipsVisible();
assert.equal(elements.get('#routeLayer').children[0].attrs['aria-label'],'Reading step 2 to 3');
elements.get('#readingList').children.at(-1).children[0].onclick();assert.equal(elements.get('#routeLayer').children.length,0);assertRelationshipsVisible();
elements.get('#closeCard').onclick();assert.equal(elements.get('#routeLayer').children.length,0);assertRelationshipsVisible();
elements.get('#readingSwitch').checked=false;elements.get('#readingSwitch').onchange();assert.equal(elements.get('#routeLayer').children.length,0);assertRelationshipsVisible();
console.log('Step-by-step reading links and return to the relationship graph pass.');

const movable=elements.get('#card');elements.get('#nodeLayer').children[0].onclick(event);
movable.style.left='100px';movable.style.top='100px';
movable.handlers.pointerdown({...event,pointerId:7,button:0,clientX:110,clientY:110,target:{closest:()=>null}});
movable.handlers.pointermove({...event,pointerId:7,clientX:310,clientY:210});
assert.equal(movable.style.left,'300px');assert.equal(movable.style.top,'200px');movable.handlers.pointerup();
for(let i=0;i<25;i++)animation(9000+i*16);assert.equal(movable.style.left,'300px');assert.equal(movable.style.top,'200px');
movable.handlers.pointerdown({...event,pointerId:8,button:0,clientX:310,clientY:210,target:{closest:()=>null}});movable.handlers.pointermove({...event,pointerId:8,clientX:10000,clientY:10000});movable.handlers.pointercancel();assert.equal(movable.style.left,'898px');assert.equal(movable.style.top,'528px');
elements.get('#cardDragHandle').handlers.keydown({...event,key:'ArrowLeft'});assert.equal(movable.style.left,'888px');
elements.get('#readingToggle').onclick();assert.equal(elements.get('#readingPanel').hidden,false);
for(const fn of docHandlers.get('pointerdown'))fn({target:{closest:()=>null}});
assert.equal(elements.get('#readingPanel').hidden,true);assert.equal(movable.hidden,true);
elements.get('#topicsToggle').onclick();for(const fn of docHandlers.get('pointerdown'))fn({target:{closest:s=>s==='.topic-filter'?elements.get('#topicsPanel'):null}});assert.equal(elements.get('#topicsPanel').hidden,false);
for(const fn of docHandlers.get('pointerdown'))fn({target:{closest:()=>null}});assert.equal(elements.get('#topicsPanel').hidden,true);
console.log('Card dragging, position bounds, keyboard movement and outside-click dismissal pass.');

// Curriculum metadata survives save/import and flags broken prerequisite order.
assert(savedState.learningReport.complete);
assert.equal(core.validateWorkspace(JSON.parse(JSON.stringify(savedState))).readingPlan[1].requires[0],savedState.readingPlan[0].id);
const curriculum=elements.get('#readingList').children;
curriculum[0].children[1].children[3].children[2].onclick();
assert(elements.get('#readingLearningStatus').textContent.includes('Review prerequisites'));
elements.get('#readingList').children[0].children[1].children[3].children[3].onclick();
assert(elements.get('#readingLearningStatus').textContent.includes('Review prerequisites'));
const previousLearningState=JSON.stringify(savedState);
context.discoveryConfig.createGraph([{...lessonPapers[4],id:'unsupported'}],{learning:true});
assert.equal(JSON.stringify(savedState),previousLearningState,'An advanced-only request must keep the existing path');
console.log('Curriculum export/import, reordering warnings and non-destructive rejection of advanced-only paths pass.');

// Existing-library duplicates must remap both prerequisite and content-bridge identifiers.
const aliases=lessonPapers.map(p=>({...p,id:p.id+'-alias'}));
context.discoveryConfig.createGraph(aliases,{learning:true,learningPath:core.buildLearningPath(aliases,{subject:'graph theory'})});
assert.deepEqual(savedState.readingPlan.map(step=>step.id),lessonPapers.map(p=>p.id));
assert.equal(savedState.readingPlan[2].requires[0],'foundations');
assert.equal(savedState.readingPlan[2].bridges[0].from,'foundations');
assert.doesNotThrow(()=>core.validateWorkspace(JSON.parse(JSON.stringify(savedState))));

// First visits start at the welcome screen without fetching or saving a demo library.
let startupFetches=0,startupSaves=0,welcomeSearches=0;
const freshContext=vm.createContext({...context,localStorage:{getItem:()=>null,setItem(){startupSaves++}},fetch(){startupFetches++;throw Error('Unexpected startup request')}});
await vm.runInContext('(async()=>{'+source+'})()',freshContext);
assert.equal(elements.get('#empty').hidden,false);
assert(Object.hasOwn(elements.get('#graph').attrs,'hidden'));
assert.equal(elements.get('#resumeLibrary').hidden,false);
assert.equal(elements.get('#resumeLibrary').disabled,true);
assert.equal(elements.get('#nodeLayer').children.length,0);
assert.equal(startupFetches,0);assert.equal(startupSaves,0);
elements.get('#discoverOpen').onclick=()=>{welcomeSearches++};
elements.get('#welcomeSearch').onclick();assert.equal(welcomeSearches,1);
console.log('Welcome: saved libraries resume explicitly, first visits make no demo requests, and the main action opens search.');

// Exercise the real app and discovery controller together, without mocking createGraph.
for(const id of ['#discoverInput','#discoverQuery','#discoverFoundation'])elements.get(id).value='';
elements.get('#discoverInputLanguage').value='en';elements.get('#discoverBreadth').value='precise';
elements.get('#discoverGraphCount').value='2';elements.get('#discoverCandidateCount').value='100';
elements.get('#graph').setAttribute('hidden','');
let createdLibrary=null,searchRequests=0;
const integrationContext=vm.createContext({...context,createOpenAlexClient,discoveryCore,learningCore,AbortController,
 localStorage:{getItem:()=>null,setItem(key,value){createdLibrary=JSON.parse(value)}},
 DOMParser:class{parseFromString(text){return {body:{textContent:text.replace(/<[^>]+>/g,'')}}}},
 fetch:async()=>{searchRequests++;return {ok:true,json:async()=>({meta:{count:2,page:1},results:lessonPapers.slice(0,2).map(asOpenAlex)})}}
});
const bindings='const {parseBib,connections,validateWorkspace,normalizeDoi,groupByContent,suggestReadingPlan,buildLearningPath,learningOrderIssues,learningLevel}=core;const {mergeDiscoveryBatch,planSearch,compileQuery,rankResults,candidateTarget,fromOpenAlex,samePaper,searchUrl,isEnglishRecord,translateQuery,learningSearchJobs}=discoveryCore;const {learningGoals}=learningCore;';
const discoverySource=readFileSync(new URL('../dist/discovery-ui.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'').replace('export function setupDiscovery','function setupDiscovery');
const appSource=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
await vm.runInContext('(async()=>{'+bindings+discoverySource+appSource+'})()',integrationContext);
assert(Object.hasOwn(elements.get('#graph').attrs,'hidden'));
elements.get('#welcomeSearch').onclick();assert.equal(elements.get('#discoverDialog').open,true);
elements.get('#discoverInput').value='"graph theory"';elements.get('#discoverInput').oninput();
await elements.get('#discoverSearch').onclick();
assert.equal(elements.get('#discoverResults').children.length,2);
await elements.get('#discoverCreateGraph').onclick();
assert.equal(searchRequests,1);
assert.equal(createdLibrary.graphPaperIds.length,2);
assert.equal(elements.get('#nodeLayer').children.length,2);
assert(!Object.hasOwn(elements.get('#graph').attrs,'hidden'),'Created SVG graph must actually be visible');
assert.equal(elements.get('#empty').hidden,true);
assert.equal(elements.get('#discoverDialog').open,false);
console.log('Welcome → search → create graph: real controllers produce visible nodes and close the search dialog.');

// A learning search uses the same relationship graph as imported bibliography; reading order is an overlay.
elements.get('#discoverOpen').onclick();
elements.get('#discoverLearning').onclick();
elements.get('#discoverFoundation').value='graph theory';
await elements.get('#discoverCreateGraph').onclick();
assert.equal(createdLibrary.readingPlan.length,2);
assert.equal(elements.get('#routeLayer').children.length,0,'Do not replace topic lines with a full reading-order path');
assert(elements.get('#edgeLayer').children.length>0);
assert(elements.get('#edgeLayer').children.every(edge=>Number(edge.attrs['stroke-opacity'])>0));
const firstStepId=createdLibrary.readingPlan[0].id,secondStepId=createdLibrary.readingPlan[1].id;
elements.get('#nodeLayer').children.find(node=>node.attrs['data-id']===firstStepId).onclick(event);
assert.equal(elements.get('#routeLayer').children.length,1);
assert.equal(elements.get('#routeLayer').children[0].attrs['aria-label'],'Reading step 1 to 2');
assert(elements.get('#edgeLayer').children.every(edge=>Number(edge.attrs['stroke-opacity'])>0));
assert(elements.get('#nodeLayer').children.some(node=>node.attrs['data-id']===firstStepId));
assert(elements.get('#nodeLayer').children.some(node=>node.attrs['data-id']===secondStepId));
console.log('Learning search → graph: relationships stay visible; only the selected reading links to the next step.');
