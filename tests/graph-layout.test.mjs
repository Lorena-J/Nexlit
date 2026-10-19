import test from 'node:test';
import assert from 'node:assert/strict';
import {separateNodes,visibleLabels} from '../dist/graph-layout.js';

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
