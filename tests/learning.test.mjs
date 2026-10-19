import assert from 'node:assert/strict';
import {assessLearning,buildLearningPath,learningOrderIssues} from '../dist/learning-core.js';
import {compileQuery,learningSearchJobs,rankResults,selectLearningPapers} from '../dist/discovery-core.js';
import {validateWorkspace} from '../dist/core.js';
import {lessonPapers} from './fixtures/learning.mjs';

const context={subject:'graph theory',target:'"graph theory" AND transport',targetPaperIds:['applications','advanced']};
const path=buildLearningPath([...lessonPapers].reverse(),context);
assert(path.complete);assert.deepEqual(path.steps.map(step=>step.stage),[0,1,2,3,4]);
assert.deepEqual(path.steps[3].requires,['foundations','methods']);
assert(path.steps.every(step=>step.objective&&step.evidence&&step.reason.includes('Prerequisites:')));
assert.deepEqual(learningOrderIssues(path.steps),[]);
assert.equal(path.papers[0].id,'orientation');
assert(!path.papers[0].abstract.includes('transport'),'Broad foundation material need not match the final target');

const noMethods=buildLearningPath(lessonPapers.filter(p=>p.id!=='methods'),context);
assert.deepEqual(noMethods.steps.map(step=>step.id),['orientation','foundations']);
assert.equal(noMethods.gaps[0].label,'Methods');
assert(!noMethods.complete,'An application cannot bridge missing methods automatically');
assert.deepEqual(buildLearningPath(lessonPapers.slice(1),context).steps,[]);
const onlyBeginners=buildLearningPath(lessonPapers.slice(0,2),context);
assert.equal(onlyBeginners.steps.length,2);assert(!onlyBeginners.complete);
assert.equal(selectLearningPapers(lessonPapers.slice(0,2),20,context).papers.length,2,'No advanced quota');
const limited=buildLearningPath(lessonPapers,{...context,count:2});
assert.equal(limited.steps.length,2);assert(limited.gaps[0].reason.includes('limit'));
assert.equal(buildLearningPath(lessonPapers,{...context,subject:'medieval history'}).steps.length,0);

const unrelatedMethods={...lessonPapers[2],abstract:'This protocol describes methods for graph theory, focusing on spectroscopy and fluorescence measurements across biological samples.'};
assert.equal(buildLearningPath([lessonPapers[0],lessonPapers[1],unrelatedMethods,...lessonPapers.slice(3)],context).steps.length,2,'Do not bridge readings only because stage labels line up');
const catalogCitation={...lessonPapers[0],abstract:'“Introductory Graph Theory.” Journal of the Operational Research Society, 29(12), p. 1245'};
assert(!assessLearning(catalogCitation).supported,'A citation masquerading as an abstract does not support a teaching role');
assert(path.steps[2].bridges[0].concepts.includes('algorithm'));
const titleOnly={...lessonPapers[0],abstract:''};assert(!assessLearning(titleOnly).supported);
assert.equal(buildLearningPath([titleOnly,...lessonPapers.slice(1)],context).steps.length,0);
const advancedReview={...lessonPapers[4],title:'An introductory review of advanced graph theory',type:'review'};
assert.equal(assessLearning(advancedReview).level,4);
assert.equal(buildLearningPath([advancedReview],context).steps.length,0);
const plainReview={...lessonPapers[0],title:'A Review of Graph Theory',type:'review',abstract:'We review recent publications in graph theory, comparing experimental outcomes across several specialized research programs.'};
assert(!assessLearning(plainReview).supported,'Review type alone is not beginner evidence');
const negatedIntro={...lessonPapers[0],abstract:'This paper is not an introduction to graph theory for beginners. We focus on a highly specialized research question.'};
assert(!assessLearning(negatedIntro).supported);

const unmet={...lessonPapers[2],abstract:lessonPapers[2].abstract+' Requires prior knowledge of calculus.'};
assert.deepEqual(assessLearning(unmet).assumed,['calculus']);
assert.equal(buildLearningPath([lessonPapers[0],lessonPapers[1],unmet,...lessonPapers.slice(3)],context).steps.length,2);
const met={...lessonPapers[2],abstract:lessonPapers[2].abstract+' Assumes knowledge of graph theory.'};
assert(buildLearningPath([lessonPapers[0],lessonPapers[1],met,...lessonPapers.slice(3)],context).complete);

const query=compileQuery('"graph theory" AND transport NOT (biology OR chemistry)');
const foundation=learningSearchJobs(query,'graph theory',0),advanced=learningSearchJobs(query,'graph theory',4);
assert(!foundation.query.includes('transport'));assert(advanced.query.includes('transport'));
assert(foundation.query.includes('NOT'));assert(new URL(foundation.url).searchParams.get('search.title').includes('beginners'));
assert(!rankResults([{title:'Introduction to graph theory in biology'}],compileQuery(foundation.query))[0].eligible);
const conjunction=learningSearchJobs(compileQuery('graphs NOT (biology AND chemistry)'),'graphs',0);
assert(rankResults([{title:'Graphs in biology'}],compileQuery(conjunction.query))[0].eligible,'Preserve compound exclusion logic');

assert(learningOrderIssues([path.steps[1],path.steps[0],...path.steps.slice(2)]).length);
assert(learningOrderIssues(path.steps.filter(step=>step.id!=='methods')).length);
const report={version:1,subject:path.subject,target:path.target,gaps:path.gaps,complete:path.complete};
const workspace={version:1,papers:lessonPapers,manual:[],readingPlan:path.steps,learningMode:true,learningReport:report};
assert.deepEqual(validateWorkspace(structuredClone(workspace)),workspace);
assert.throws(()=>validateWorkspace({...structuredClone(workspace),learningReport:{...report,gaps:[{stage:99,label:'Bad',reason:'Bad'}]}}));
const bad=structuredClone(workspace);bad.readingPlan[1].requires=['missing'];assert.throws(()=>validateWorkspace(bad));
console.log('Level-zero entry, objective dependencies, abstract evidence, partial paths, exclusions and persistence pass.');
