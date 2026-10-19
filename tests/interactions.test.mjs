import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../dist/core.js';

// DOM doubles exercise application events; SVG hit testing still needs visual browser QA.
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs={};this.style={};this.dataset={};this.hidden=false;this.handlers={};this.offsetWidth=290;this.offsetHeight=180;this.parent=null;this.moves=0;this.textContent='';this.classList={toggle:(name,on)=>{const classes=new Set((this.attrs.class||'').split(' '));on?classes.add(name):classes.delete(name);this.attrs.class=[...classes].join(' ')}}}
  setAttribute(k,v){this.attrs[k]=String(v)}
  removeAttribute(k){delete this.attrs[k]}
  append(...nodes){for(const n of nodes){if(n.parent){n.moves++;n.parent.children=n.parent.children.filter(x=>x!==n)}n.parent=this;this.children.push(n)}}
  replaceChildren(...nodes){for(const n of this.children)n.parent=null;this.children=[];this.append(...nodes)}
  querySelector(s){return this.children.find(c=>(c.attrs.class||'').split(' ').includes(s.slice(1)))}
  addEventListener(type,fn){this.handlers[type]=fn}
  getAnimations(){return []} animate(){} focus(){this.onfocus?.()}
  getBoundingClientRect(){return {width:1200,height:720,left:0,top:0}}
  createSVGPoint(){return {x:0,y:0,matrixTransform(){return {x:this.x,y:this.y}}}}
  getScreenCTM(){return {}} setPointerCapture(){}
}
const page=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),elements=new Map();
for(const match of page.matchAll(/id="([^"]+)"/g))elements.set('#'+match[1],new Element());
elements.set('.universe',new Element());
const papers=core.parseBib(readFileSync(new URL('../dist/example.bib',import.meta.url),'utf8'));
papers[0].abstract='We studied hippocampal representations. We found a distinct population response. These results support social memory processing.';
let animation;
const context=vm.createContext({core,console,document:{hidden:false,querySelector:s=>elements.get(s),createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),addEventListener(){}},localStorage:{getItem:()=>JSON.stringify({version:1,papers,manual:[]}),setItem(){}},matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>animation=fn,innerWidth:1200,setTimeout,clearTimeout,URL,Blob,confirm:()=>true});
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'const {parseBib,connections,validateWorkspace,normalizeDoi}=core;\n');
await vm.runInContext('(async()=>{'+source+'})()',context);
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
console.log('11 nodos: clic, tarjeta, título, posición, cierre, teclado y resumen correctos. Animación estable tras 100 fotogramas.');
