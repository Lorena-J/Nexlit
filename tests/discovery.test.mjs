import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../dist/discovery-core.js';
const area=core.planSearch('CA2 del hipocampo');assert(area.query.includes('TITLE_ABS:CA2'));assert(!area.query.includes('TITLE_ABS:del'));
const exp=core.planSearch('CA2 del hipocampo, hembras head-fixed, orina, ChABC y redes perineuronales','experiment');
assert(exp.concepts.some(c=>c.id==='chabc'));assert(exp.concepts.some(c=>c.id==='pnn'));assert(exp.query.includes(' OR '));
assert(core.planSearch('hippocampus dopamine').query.includes('dopamine'));
assert(core.planSearch('CA2 Shank3','experiment').query.includes('shank3'));
const fixture={hitCount:3,resultList:{result:Array.from({length:3},(_,i)=>({id:String(i+1),source:i===0?'PPR':'MED',title:'Hippocampal CA2 test study '+i,pubYear:'2024',doi:'10.0000/atlas-test-'+i,abstractText:'<p>CA2 hippocampal test abstract.</p>',authorList:{author:[{lastName:'Example',firstName:'A'}]},journalInfo:{journal:{title:'Test journal'}}}))}};
const paper=core.fromEuropePMC(fixture.resultList.result[0]);assert(paper.title&&paper.doi&&paper.abstract);assert.equal(paper.status,'Pendiente');
assert(core.samePaper(paper,{...paper,id:'another',doi:'https://doi.org/'+paper.doi.toUpperCase()}));
assert.equal(new URL(core.searchUrl(area.query)).searchParams.get('query'),area.query);
assert.equal(core.fromEuropePMC({title:'Missing id'}),null);
class Element{
 constructor(){this.children=[];this.attrs={};this.hidden=true;this.value='';this.handlers={};this.disabled=false;this.textContent=''}
 setAttribute(k,v){this.attrs[k]=String(v)} append(...items){this.children.push(...items)} replaceChildren(...items){this.children=items}
 addEventListener(k,v){this.handlers[k]=v} focus(){} showModal(){this.hidden=false} close(){this.hidden=true}
}
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),els=new Map();for(const m of html.matchAll(/id="([^"]+)"/g))els.set('#'+m[1],new Element());
let library=[],requests=[],fetchMode='success',picked=null;
const context=vm.createContext({core,document:{querySelector:s=>els.get(s),createElement:()=>new Element()},DOMParser:class{parseFromString(s){return {body:{textContent:s.replace(/<[^>]+>/g,'')}}}},AbortController,URL,setTimeout,clearTimeout,fetch:async(url,options)=>{requests.push(url);if(fetchMode==='failure')return {ok:false,status:503};if(fetchMode==='cancel')return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));return {ok:true,json:async()=>({...fixture,nextCursorMark:requests.length===1?'next-page':null})}},getPapers:()=>library,addPaper:p=>library.push(p),pickPaper:id=>picked=id});
const source=readFileSync(new URL('../dist/discovery-ui.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'const {planSearch,matchConcepts,fromEuropePMC,samePaper,searchUrl}=core;\n').replace('export function setupDiscovery','function setupDiscovery');
vm.runInContext(source+'\nsetupDiscovery({getPapers,addPaper,pickPaper});',context);
els.get('#discoverOpen').onclick();assert.equal(els.get('#discoverDialog').hidden,false);
els.get('#discoverInput').value='CA2 del hipocampo';els.get('#discoverInput').oninput();
await els.get('#discoverSearch').onclick();assert.equal(els.get('#discoverResults').children.length,3);
let actions=els.get('#discoverResults').children[0].children.at(-1);actions.children[0].onclick();assert.equal(library.length,1);
actions=els.get('#discoverResults').children[0].children.at(-1);assert.equal(actions.children[0].disabled,true);actions.children[1].onclick();assert(picked);assert.equal(els.get('#discoverDialog').hidden,true);
await els.get('#discoverMore').onclick();assert.equal(els.get('#discoverResults').children.length,3,'Duplicate records across pages do not duplicate results');
fetchMode='failure';await els.get('#discoverSearch').onclick();assert(els.get('#discoverStatus').textContent.includes('disponible'));assert.equal(els.get('#discoverSearch').disabled,false);
fetchMode='cancel';const pending=els.get('#discoverSearch').onclick();els.get('#discoverCancel').onclick();await pending;assert.equal(els.get('#discoverSearch').disabled,false);assert.equal(els.get('#discoverStatus').textContent,'Búsqueda cancelada.');
console.log('Búsquedas por área y experimento, términos conservados, formato de Europe PMC, paginación, duplicados, importación, fallos y cancelación: correctos.');
