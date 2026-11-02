import test from 'node:test';
import assert from 'node:assert/strict';
import {separateNodes,settleNodes,visibleLabels} from '../dist/graph-layout.js';

test('dense projected groups keep every click target separated and preserve identities',()=>{
 const input=Array.from({length:200},(_,id)=>({id,x:Math.cos(id)*20,y:Math.sin(id)*20,radius:id===0?30:22}));
 const copy=structuredClone(input),output=separateNodes(input);
 assert.deepEqual(input,copy,'Projection adjustment must not mutate the saved topic positions');
 assert.deepEqual(output.map(p=>p.id),input.map(p=>p.id));
 for(let i=0;i<output.length;i++)for(let j=i+1;j<output.length;j++){
  const a=output[i],b=output[j];
  assert(Math.hypot(a.x-b.x,a.y-b.y)>=a.radius+b.radius+9.9,`Targets ${a.id} and ${b.id} overlap`);
 }
 assert.deepEqual(separateNodes(input),output,'A stationary view must have stable selectable targets');
});

test('coincident points separate without invalid coordinates; clear views do not move',()=>{
 const coincident=separateNodes([{id:'a',x:0,y:0,radius:22},{id:'b',x:0,y:0,radius:22}]);
 assert(coincident.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 assert(Math.hypot(coincident[0].x-coincident[1].x,coincident[0].y-coincident[1].y)>=53.9);
 const clear=[{id:1,x:0,y:0,radius:22},{id:2,x:100,y:0,radius:22}];
 assert.deepEqual(separateNodes(clear),clear);assert.deepEqual(separateNodes([]),[]);
});

test('overlapping labels hide while the hovered paper takes priority',()=>{
 const labels=[{id:'a',x:0,y:30,width:100,height:15},{id:'b',x:20,y:30,width:100,height:15},{id:'c',x:250,y:30,width:100,height:15}];
 assert.deepEqual([...visibleLabels(labels)],['a','c']);
 assert.deepEqual([...visibleLabels(labels,{priority:['b']})],['b','c']);
});

test('sparse labels respect the budget while always retaining explored papers',()=>{
 const labels=Array.from({length:20},(_,id)=>({id,x:id*150,y:30,width:100,height:15}));
 const sparse=visibleLabels(labels,{maxLabels:5});
 assert.equal(sparse.size,5);
 const focused=visibleLabels(labels,{priority:[19,18],maxLabels:5});
 assert.equal(focused.size,5);assert(focused.has(19));assert(focused.has(18));
 assert.equal(visibleLabels(labels,{maxLabels:12}).size,12);
 assert.deepEqual([...visibleLabels(labels,{priority:[19,18],maxLabels:1})],[19,18]);
});

test('rotation preserves separation offsets and stopping eases into a clear layout',()=>{
 const points=[{id:'a',x:0,y:0,radius:22},{id:'b',x:5,y:0,radius:22}];
 const original=structuredClone(points),offsets=new Map();
 const targets=separateNodes(points,{gap:14});
 const start=settleNodes(points,targets,offsets,{freeze:true});
 assert.deepEqual(start,points,'No corrective movement while rotating');
 const first=settleNodes(points,targets,offsets,{dt:1/60});
 assert(Math.hypot(first[0].x,first[0].y)>0);
 assert(Math.hypot(first[0].x,first[0].y)<Math.hypot(targets[0].x,targets[0].y),'First frame must not jump to the final position');
 const before=structuredClone(offsets);
 const rotated=points.map(point=>({...point,x:point.x+20,y:point.y-10}));
 const moving=settleNodes(rotated,separateNodes(rotated),offsets,{freeze:true});
 assert.deepEqual(offsets,before,'Keep correction offsets fixed throughout the rotation');
 for(let i=0;i<points.length;i++){
  assert(Math.abs(moving[i].x-first[i].x-20)<1e-9);
  assert(Math.abs(moving[i].y-first[i].y+10)<1e-9);
 }
 let settled;
 for(let i=0;i<120;i++)settled=settleNodes(points,targets,offsets,{dt:1/60});
 for(let i=0;i<points.length;i++){
  assert(Math.hypot(settled[i].x-targets[i].x,settled[i].y-targets[i].y)<.05);
 }
 assert(Math.hypot(settled[0].x-settled[1].x,settled[0].y-settled[1].y)>=57.9);
 assert.deepEqual(points,original,'Smoothing cannot mutate the topic projection');
 assert.deepEqual(settleNodes(points,targets,new Map(),{snap:true}),targets,'Reduced motion can use the settled layout immediately');
});
