import {createOpenAlexClient as realOpenAlexClient} from '../dist/openalex-client.js';
const createOpenAlexClient=options=>realOpenAlexClient({...options,cacheTTL:0,minInterval:0});
import * as learningCore from '../dist/learning-core.js';
import {lessonPapers,asOpenAlex,expandedLessonPapers} from './fixtures/learning.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../dist/discovery-core.js';
import {groupByContent,suggestReadingPlan,learningLevel} from '../dist/core.js';
for(const text of ['bases de programación','medieval history','macroeconomics inflation','solar energy','CA2 hippocampus']){
 const q=core.planSearch(text);assert(q.query);if(!/ca2/i.test(text))assert(!/ca2|hippocamp|perineuronal|TITLE_ABS/i.test(q.query));
}
const fixture={meta:{count:25,page:1},results:Array.from({length:3},(_,i)=>({id:'https://openalex.org/W'+i,title:['Introduction to Programming Fundamentals','A Survey of Programming Fundamentals','Advanced Programming Fundamentals'][i],language:'en',publication_year:2024,doi:'https://doi.org/10.0000/test-'+i,abstract_inverted_index:{Test:[0],abstract:[1]},primary_topic:{id:'https://openalex.org/T'+i,display_name:['Programming Education','Medieval History','Macroeconomics'][i]},authorships:[{author:{display_name:'Alice Example'}}]}))};
const paper=core.fromOpenAlex(fixture.results[0]);assert.equal(paper.abstract,'Test abstract');assert.equal(paper.topic.label,'Programming Education');assert(core.samePaper(paper,{...paper,id:'alias'}));
const grouped=groupByContent(fixture.results.map(r=>core.fromOpenAlex(r)));assert.equal(grouped.groups.length,3);assert(!grouped.groups.some(g=>/social|neuro/i.test(g.label)));
assert(suggestReadingPlan(fixture.results.map(r=>core.fromOpenAlex(r))).every(p=>!p.reason.includes('CA2')));
const url=new URL(core.searchUrl('programming fundamentals','2'));assert.equal(url.hostname,'api.openalex.org');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('filter'),'language:en');assert(!url.searchParams.has('cursor'));
assert(core.translationChunks('á '.repeat(1000)).every(s=>new TextEncoder().encode(s).length<=440));
class Element{constructor(){this.children=[];this.attrs={};this.hidden=true;this.value='';this.handlers={};this.disabled=false;this.textContent=''}setAttribute(k,v){this.attrs[k]=String(v)}append(...items){this.children.push(...items)}replaceChildren(...items){this.children=items}addEventListener(k,v){this.handlers[k]=v}getBoundingClientRect(){return {left:100,top:100,right:900,bottom:700}}focus(){}showModal(){this.hidden=false}close(){this.hidden=true}}
const page=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),els=new Map();for(const m of page.matchAll(/id="([^"]+)"/g))els.set('#'+m[1],new Element());
let lastOptions,library=[],requests=[],fetchMode='success',picked=null,graph=[],graphOptions=null;
const mockFetch=async(url,options)=>{requests.push(url);lastOptions=options;if(String(url).includes('mymemory'))return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'I am looking for academic publications on programming fundamentals.'}})};
 if(fetchMode==='daily')return {ok:false,status:429,json:async()=>({message:'Insufficient budget',dailyRemainingUsd:0,retryAfter:3600})};
 if(fetchMode==='failure')return {ok:false,status:503};if(fetchMode==='cancel')return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));
 if(fetchMode==='learning-many'){
  const page=Number(new URL(url).searchParams.get('page'));
  const records=page===1?[...expandedLessonPapers.slice(0,5),...Array.from({length:15},(_,i)=>({...expandedLessonPapers[0],id:'unclassified-'+i,doi:'10.0000/unknown-'+i,title:'Social recognition observation '+i,abstract:'An empirical observation without enough metadata to establish a teaching role.'}))]:expandedLessonPapers.slice(5);
  return {ok:true,json:async()=>({meta:{count:40,page},results:records.map(asOpenAlex)})};
 }
 if(['learning','learning-empty','learning-cancel'].includes(fetchMode)){
  const titleQuery=new URL(url).searchParams.get('search.title')||'';
  if(titleQuery&&fetchMode==='learning-cancel')return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));
  if(titleQuery&&fetchMode==='learning-empty')return {ok:true,json:async()=>({meta:{count:0,page:1},results:[]})};
  const stage=titleQuery.includes('introductory')?0:titleQuery.includes('fundamentals')?1:titleQuery.includes('methods')?2:titleQuery.includes('applications')?3:4;
  return {ok:true,json:async()=>({meta:{count:1,page:1},results:[asOpenAlex(lessonPapers[stage])]})};
 }
 const number=Number(new URL(url).searchParams.get('page'));
 if(fetchMode==='pool'||fetchMode==='pool-cancel'){
  if(fetchMode==='pool-cancel'&&number>1)return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));
  return {ok:true,json:async()=>({meta:{count:100,page:number},results:Array.from({length:20},(_,offset)=>{const i=(number-1)*20+offset;return {...fixture.results[0],id:'https://openalex.org/Pool'+i,doi:'10.0000/pool-'+i,title:'Programming fundamentals topic '+i,relevance_score:i===45?1000:1}})})};
 }
 return {ok:true,json:async()=>({meta:{count:25,page:number},results:fetchMode==='pages'&&number===2?[...fixture.results,...[4,5].map(i=>({...fixture.results[0],id:'https://openalex.org/W'+i,doi:'10.0000/extra-'+i,title:'Programming Fundamentals applications '+i})),{...fixture.results[0],id:'https://openalex.org/Wfr',language:'fr'}]:fixture.results})};
};
const session=new Map();let authenticate=async()=>true;
const context=vm.createContext({sessionStorage:{getItem:key=>session.get(key),setItem:(key,value)=>session.set(key,value),removeItem:key=>session.delete(key)},createOpenAlexClient,ensureConnected:()=>authenticate(),learningCore,learningLevel,core:{...core,translateQuery:(text,options)=>core.translateQuery(text,{...options,fetcher:mockFetch})},document:{querySelector:s=>els.get(s),createElement:()=>new Element()},DOMParser:class{parseFromString(s){return {body:{textContent:s.replace(/<[^>]+>/g,'')}}}},AbortController,URL,setTimeout,clearTimeout,fetch:mockFetch,getPapers:()=>library,addPaper:p=>library.push(p),pickPaper:id=>picked=id,createGraph:(papers,options)=>{graph=papers;graphOptions=options}});
const source="const {planSearch,compileQuery,rankResults,candidateTarget,fromOpenAlex,samePaper,searchUrl,isEnglishRecord,translateQuery,learningSearchJobs}=core;const {buildLearningPath,learningGoals}=learningCore;\n"+readFileSync(new URL('../dist/discovery-ui.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'').replace('export function setupDiscovery','function setupDiscovery');vm.runInContext(source+'\nsetupDiscovery({getPapers,addPaper,pickPaper,createGraph,ensureConnected});',context);
// Search waits for sign-in; canceling or closing the dialog sends no search request.
const initialRequests=requests.length;
authenticate=async()=>false;
await els.get('#discoverSearch').onclick();assert.equal(requests.length,initialRequests);
let completeLogin;authenticate=()=>new Promise(resolve=>completeLogin=resolve);
const waitingSearch=els.get('#discoverSearch').onclick();
assert(els.get('#discoverSearch').disabled);assert.equal(requests.length,initialRequests);
els.get('#discoverClose').onclick();completeLogin(true);await waitingSearch;
assert.equal(requests.length,initialRequests);assert(!els.get('#discoverSearch').disabled);
authenticate=async()=>true;
els.get('#discoverOpen').onclick();els.get('#discoverInput').value='programming fundamentals';els.get('#discoverInput').oninput();await els.get('#discoverSearch').onclick();assert.equal(els.get('#discoverResults').children.length,3);
let actions=els.get('#discoverResults').children[0].children.at(-1);actions.children[0].onclick();assert.equal(library.length,1);actions=els.get('#discoverResults').children[0].children.at(-1);assert(actions.children[0].disabled);actions.children[1].onclick();assert(picked);
await els.get('#discoverMore').onclick();assert.equal(els.get('#discoverResults').children.length,3);
els.get('#discoverGraphCount').value='2';await els.get('#discoverCreateGraph').onclick();assert.equal(graph.length,2);assert(!els.get('#discoverSearch').disabled);
graph=[];els.get('#discoverGraphCount').value='10';await els.get('#discoverCreateGraph').onclick();assert.equal(graph.length,3,'Create a smaller graph instead of filling it with unrelated papers');
fetchMode='pages';await els.get('#discoverSearch').onclick();els.get('#discoverGraphCount').value='5';await els.get('#discoverCreateGraph').onclick();assert.equal(graph.length,5);assert(graph.every(p=>p.language==='en'));
fetchMode='failure';await els.get('#discoverSearch').onclick();assert(els.get('#discoverStatus').textContent.includes('unavailable'));
fetchMode='cancel';const pending=els.get('#discoverSearch').onclick();await new Promise(resolve=>setImmediate(resolve));els.get('#discoverCancel').onclick();await pending;assert.equal(els.get('#discoverStatus').textContent,'Search canceled.');
fetchMode='success';els.get('#discoverInput').value='programming fundamentals';els.get('#discoverInput').oninput();await els.get('#discoverSearch').onclick();assert.equal(new URL(requests.at(-1)).searchParams.get('search.title_abstract_keywords'),'programming AND fundamentals');assert(!requests.some(u=>u.includes('mymemory')));
const merged=core.mergeDiscoveryBatch([{...paper,status:'Read',notes:'Keep'}],[paper]);assert.equal(merged.papers[0].notes,'Keep');assert.equal(merged.papers[0].status,'Read');
console.log('Discovery: multidisciplinary search, English queries, pagination, graph size, cancellation and note preservation pass.');

const teaching=lessonPapers;
const selected=core.selectLearningPapers(teaching,5,{subject:'graph theory'});assert.equal(selected.papers.length,5);assert.equal(selected.papers[0].id,'orientation');assert.equal(selected.papers.at(-1).id,'advanced');
assert(core.selectLearningPapers(teaching.slice(1),5,{subject:'graph theory'}).missingBasics);
assert.equal(suggestReadingPlan(teaching,{fromScratch:true,subject:'graph theory'})[0].id,'orientation');
assert(core.learningSearchUrls('graph theory').every(u=>new URL(u).searchParams.get('filter')==='language:en'));
fetchMode='learning';els.get('#discoverInput').value='"graph theory" AND transport';els.get('#discoverInput').oninput();await els.get('#discoverSearch').onclick();
els.get('#discoverFoundation').value='graph theory';
els.get('#discoverLearning').onclick();assert.equal(els.get('#discoverLearning').attrs['aria-checked'],'true');els.get('#discoverGraphCount').value='5';
const learningStart=requests.length;await els.get('#discoverCreateGraph').onclick();assert(graphOptions.learning);assert.equal(graph.length,5);assert.equal(learningLevel(graph[0]).level,0);
assert(graphOptions.learningPath.complete);
const foundationQuery=new URL(requests[learningStart]).searchParams.get('search.title_abstract_keywords');assert(!foundationQuery.includes('transport'),'Foundation search must broaden beyond the narrow target');
assert.equal(graphOptions.learningPath.steps[1].requires[0],graph[0].id);
assert.equal(els.get('#discoverLearningPlan').hidden,false);
console.log('Learning mode: curriculum-driven foundation searches, five stages, prerequisites and explanations pass.');
// No beginner evidence must not replace the previously created graph.
fetchMode='learning-empty';els.get('#discoverInput').oninput();await els.get('#discoverSearch').onclick();
const completeLearningGraph=graph;await els.get('#discoverCreateGraph').onclick();
assert.equal(graph,completeLearningGraph);assert(els.get('#discoverStatus').textContent.includes('No supported beginner entry'));
fetchMode='learning-cancel';els.get('#discoverInput').oninput();await els.get('#discoverSearch').onclick();
const canceledLearning=els.get('#discoverCreateGraph').onclick();els.get('#discoverCancel').onclick();await canceledLearning;
assert.equal(graph,completeLearningGraph);assert(!els.get('#discoverFoundation').disabled);assert(!els.get('#discoverSearch').disabled);
assert.equal(els.get('#discoverStatus').textContent,'Search canceled.');
fetchMode='success';

els.get('#discoverOpen').onclick();const modal=els.get('#discoverDialog');modal.handlers.pointerdown({target:modal,clientX:200,clientY:200,preventDefault(){}});assert.equal(modal.hidden,false);modal.handlers.pointerdown({target:modal,clientX:40,clientY:40,preventDefault(){}});assert.equal(modal.hidden,true);
console.log('Search closes on backdrop clicks and stays open for clicks inside the dialog.');

// Graph selection must compare beyond the first page and retain late relevant papers.
fetchMode='pool';els.get('#discoverLearning').onclick();
els.get('#discoverInput').value='programming fundamentals';els.get('#discoverInput').oninput();
const start=requests.length;await els.get('#discoverSearch').onclick();
els.get('#discoverCandidateCount').value='100';els.get('#discoverGraphCount').value='5';await els.get('#discoverCreateGraph').onclick();
assert.equal(graph.length,5);assert.equal(graph[0].id,'openalex-Pool45');
assert.deepEqual(requests.slice(start).map(url=>Number(new URL(url).searchParams.get('page'))),[1,2,3,4,5]);

// Canceling the expansion must not create a graph or leave controls locked.
fetchMode='pool-cancel';els.get('#discoverInput').oninput();await els.get('#discoverSearch').onclick();
const previousGraph=graph;const expansion=els.get('#discoverCreateGraph').onclick();els.get('#discoverCancel').onclick();await expansion;
assert.equal(graph,previousGraph);assert(!els.get('#discoverSearch').disabled);assert(!els.get('#discoverCandidateCount').disabled);
assert.equal(els.get('#discoverStatus').textContent,'Search canceled.');

// Edited Boolean syntax survives submission; editing invalidates the previous graph candidates.
fetchMode='success';els.get('#discoverInput').value='programming AND fundamentals NOT medieval';els.get('#discoverInput').oninput();
assert.equal(els.get('#discoverGraphTools').hidden,true);
await els.get('#discoverSearch').onclick();
assert.equal(new URL(requests.at(-1)).searchParams.get('search.title_abstract_keywords'),'programming AND fundamentals NOT medieval');

// Repeating an English query never calls the translation service.
els.get('#discoverInput').value='programming fundamentals';els.get('#discoverInput').oninput();
await els.get('#discoverSearch').onclick();await els.get('#discoverSearch').onclick();
assert(!requests.some(url=>url.includes('mymemory')));
assert.equal(new URL(requests.at(-1)).searchParams.get('search.title_abstract_keywords'),'programming AND fundamentals');
console.log('Candidate expansion, late relevance, cancellation, query invalidation and repeated English queries pass.');

// Covering the five stages on page one must not stop expansion at five papers.
fetchMode='learning-many';els.get('#discoverInput').value='"social recognition"';els.get('#discoverInput').oninput();
await els.get('#discoverSearch').onclick();els.get('#discoverFoundation').value='social recognition';
els.get('#discoverLearning').onclick();els.get('#discoverGraphCount').value='20';els.get('#discoverCandidateCount').value='100';
const expansionStart=requests.length;await els.get('#discoverCreateGraph').onclick();
assert.equal(graph.length,20);assert.equal(graphOptions.learningPath.requestedCount,20);
assert(requests.slice(expansionStart).some(url=>new URL(url).searchParams.get('page')==='2'),'Continue fetching after five stages are covered');
assert.equal(new Set(graphOptions.learningPath.steps.map(step=>step.stage)).size,5);
console.log('Learning discovery continues beyond its five-stage outline to reach a 20-reading target.');

// An exhausted shared budget shows an error and does not keep calling the service.
fetchMode='daily';await els.get('#discoverSearch').onclick();
assert(els.get('#discoverStatus').textContent.includes('daily budget is exhausted'));
const blockedCalls=requests.length;await els.get('#discoverSearch').onclick();assert.equal(requests.length,blockedCalls);
console.log('Daily budget errors are displayed and repeated requests stay blocked.');
