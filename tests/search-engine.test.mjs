import assert from 'node:assert/strict';
import {planSearch,compileQuery,rankResults,searchUrl,fromOpenAlex,candidateTarget} from '../dist/discovery-core.js';

for(const mode of ['area','experiment']){
 const text='"social memory" hippocampus sleep';
 assert.equal(planSearch(text,mode,'precise').query,'"social memory" AND hippocampus AND sleep');
 assert.equal(planSearch(text,mode,'balanced').query,'"social memory" AND (hippocampus OR sleep)');
 assert.equal(planSearch(text,mode,'exploratory').query,'"social memory" OR hippocampus OR sleep');
}
const query='("social memory" OR "social recognition") AND hippocampus NOT sleep';
assert.equal(planSearch(query,'area','exploratory').query,query);
assert.deepEqual(compileQuery(query).concepts.map(c=>c.label),['social memory','social recognition','hippocampus']);
for(const invalid of ['"unclosed','sleep AND','(sleep OR memory','sleep OR OR memory','NOT sleep','sleep)','sleep*','""'])assert.throws(()=>compileQuery(invalid),invalid);
assert.throws(()=>planSearch('"unclosed'));
const plan=compileQuery(query);
const papers=[
 {id:'complete',title:'Social recognition in hippocampus',abstract:'We examine behavior.',relevanceScore:10},
 {id:'excluded',title:'Social memory in hippocampus during sleep',relevanceScore:100},
 {id:'partial',title:'Social memory in cortical circuits',relevanceScore:100},
 {id:'scattered',title:'Social behavior and memory in hippocampus',relevanceScore:100},
];
const ranked=rankResults(papers,plan);
assert.equal(ranked[0].p.id,'complete');
assert.deepEqual(ranked.filter(r=>r.eligible).map(r=>r.p.id),['complete']);
// Phrase matching must not stitch title, abstract and keywords together.
assert(!rankResults([{title:'Social',abstract:'Memory hippocampus'}],compileQuery('"social memory"'))[0].eligible);
assert(!rankResults([{title:'Example',keywords:'social, memory'}],compileQuery('"social memory"'))[0].eligible);
assert(rankResults([{title:'Lithium batteries'}],compileQuery('"lithium battery"'))[0].eligible);
assert(!rankResults([{title:'Cartography'}],compileQuery('art'))[0].eligible);
const relevance=rankResults([
 {id:'incidental',title:'A general review',abstract:'Solar energy storage.',relevanceScore:10},
 {id:'direct',title:'Solar energy storage',relevanceScore:10},
],compileQuery('"solar energy" AND storage'));
assert.equal(relevance[0].p.id,'direct');
const provider=rankResults([{id:'low',title:'Solar energy',relevanceScore:1},{id:'high',title:'Solar energy',relevanceScore:100}],compileQuery('solar'));
assert.equal(provider[0].p.id,'high');
const url=new URL(searchUrl(query,2));
assert.equal(url.searchParams.get('search.title_abstract_keywords'),query);
assert(!url.searchParams.has('search'));
assert.equal(url.searchParams.get('page'),'2');
assert.equal(fromOpenAlex({id:'W1',title:'Example',relevance_score:12}).relevanceScore,12);
assert.equal(candidateTarget(20,100),100);assert.equal(candidateTarget(200,100),200);assert.equal(candidateTarget(20,10000),500);
console.log('Boolean queries, phrases, scopes, exclusions, ranking, field boundaries and candidate limits pass.');
