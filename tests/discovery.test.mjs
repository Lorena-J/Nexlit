import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../dist/discovery-core.js';
import {groupByContent,suggestReadingPlan} from '../dist/core.js';
for(const text of ['bases de programación','medieval history','macroeconomics inflation','solar energy','CA2 hippocampus']){
 const q=core.planSearch(text);assert(q.query);if(!/ca2/i.test(text))assert(!/ca2|hippocamp|perineuronal|TITLE_ABS/i.test(q.query));
}
const fixture={meta:{count:25,page:1},results:Array.from({length:3},(_,i)=>({id:'https://openalex.org/W'+i,title:['Programming Fundamentals','Medieval trade networks','Inflation and economic policy'][i],language:'en',publication_year:2024,doi:'https://doi.org/10.0000/test-'+i,abstract_inverted_index:{Test:[0],abstract:[1]},primary_topic:{id:'https://openalex.org/T'+i,display_name:['Programming Education','Medieval History','Macroeconomics'][i]},authorships:[{author:{display_name:'Alice Example'}}]}))};
const paper=core.fromOpenAlex(fixture.results[0]);assert.equal(paper.abstract,'Test abstract');assert.equal(paper.topic.label,'Programming Education');assert(core.samePaper(paper,{...paper,id:'alias'}));
const grouped=groupByContent(fixture.results.map(r=>core.fromOpenAlex(r)));assert.equal(grouped.groups.length,3);assert(!grouped.groups.some(g=>/social|neuro/i.test(g.label)));
assert(suggestReadingPlan(fixture.results.map(r=>core.fromOpenAlex(r))).every(p=>!p.reason.includes('CA2')));
const url=new URL(core.searchUrl('programming fundamentals','2'));assert.equal(url.hostname,'api.openalex.org');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('filter'),'language:en');assert(!url.searchParams.has('cursor'));
assert(core.translationChunks('á '.repeat(1000)).every(s=>new TextEncoder().encode(s).length<=440));
class Element{constructor(){this.children=[];this.attrs={};this.hidden=true;this.value='';this.handlers={};this.disabled=false;this.textContent=''}setAttribute(k,v){this.attrs[k]=String(v)}append(...items){this.children.push(...items)}replaceChildren(...items){this.children=items}addEventListener(k,v){this.handlers[k]=v}focus(){}showModal(){this.hidden=false}close(){this.hidden=true}}
const page=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),els=new Map();for(const m of page.matchAll(/id="([^"]+)"/g))els.set('#'+m[1],new Element());els.get('#discoverInputLanguage').value='en';
let library=[],requests=[],fetchMode='success',picked=null,graph=[];
const mockFetch=async(url,options)=>{requests.push(url);if(String(url).includes('mymemory'))return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'I am looking for academic publications on programming fundamentals.'}})};
 if(fetchMode==='failure')return {ok:false,status:503};if(fetchMode==='cancel')return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));
 const number=Number(new URL(url).searchParams.get('page'));return {ok:true,json:async()=>({meta:{count:25,page:number},results:fetchMode==='pages'&&number===2?[...fixture.results,...[4,5].map(i=>({...fixture.results[0],id:'https://openalex.org/W'+i,doi:'10.0000/extra-'+i,title:'Additional English publication '+i})),{...fixture.results[0],id:'https://openalex.org/Wfr',language:'fr'}]:fixture.results})};
};
const context=vm.createContext({core:{...core,translateQuery:(text,options)=>core.translateQuery(text,{...options,fetcher:mockFetch})},document:{querySelector:s=>els.get(s),createElement:()=>new Element()},DOMParser:class{parseFromString(s){return {body:{textContent:s.replace(/<[^>]+>/g,'')}}}},AbortController,URL,setTimeout,clearTimeout,fetch:mockFetch,getPapers:()=>library,addPaper:p=>library.push(p),pickPaper:id=>picked=id,createGraph:papers=>graph=papers});
const source=readFileSync(new URL('../dist/discovery-ui.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'const {planSearch,matchConcepts,fromOpenAlex,samePaper,searchUrl,isEnglishRecord,translateQuery}=core;\n').replace('export function setupDiscovery','function setupDiscovery');vm.runInContext(source+'\nsetupDiscovery({getPapers,addPaper,pickPaper,createGraph});',context);
els.get('#discoverOpen').onclick();els.get('#discoverInput').value='programming fundamentals';els.get('#discoverInput').oninput();await els.get('#discoverSearch').onclick();assert.equal(els.get('#discoverResults').children.length,3);
let actions=els.get('#discoverResults').children[0].children.at(-1);actions.children[0].onclick();assert.equal(library.length,1);actions=els.get('#discoverResults').children[0].children.at(-1);assert(actions.children[0].disabled);actions.children[1].onclick();assert(picked);
await els.get('#discoverMore').onclick();assert.equal(els.get('#discoverResults').children.length,3);
els.get('#discoverGraphCount').value='2';await els.get('#discoverCreateGraph').onclick();assert.equal(graph.length,2);assert(!els.get('#discoverSearch').disabled);
graph=[];els.get('#discoverGraphCount').value='10';await els.get('#discoverCreateGraph').onclick();assert.equal(graph.length,0);assert(els.get('#discoverStatus').textContent.includes('Solo hay 3'));
fetchMode='pages';await els.get('#discoverSearch').onclick();els.get('#discoverGraphCount').value='5';await els.get('#discoverCreateGraph').onclick();assert.equal(graph.length,5);assert(graph.every(p=>p.language==='en'));
fetchMode='failure';await els.get('#discoverSearch').onclick();assert(els.get('#discoverStatus').textContent.includes('disponible'));
fetchMode='cancel';const pending=els.get('#discoverSearch').onclick();els.get('#discoverCancel').onclick();await pending;assert.equal(els.get('#discoverStatus').textContent,'Búsqueda cancelada.');
fetchMode='success';els.get('#discoverInputLanguage').value='es';els.get('#discoverInput').value='bases de programación';els.get('#discoverInput').oninput();await els.get('#discoverSearch').onclick();const translatedSearch=new URL(requests.at(-1));assert.equal(translatedSearch.searchParams.get('search'),'programming fundamentals');assert(requests.some(u=>u.includes('mymemory')));assert(!requests.at(-1).includes('europepmc'));
const merged=core.mergeDiscoveryBatch([{...paper,status:'Leído',notes:'Keep'}],[paper]);assert.equal(merged.papers[0].notes,'Keep');assert.equal(merged.papers[0].status,'Leído');
console.log('Búsqueda multidisciplinar, español→inglés, temas genéricos, páginas sin clave, idioma, cantidad, cancelación y notas conservadas: correctos.');
