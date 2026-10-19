import assert from 'node:assert/strict';
import {validateWorkspace,parseBib} from '../dist/core.js';
import {readFileSync} from 'node:fs';

const papers=parseBib(readFileSync(new URL('../dist/example.bib',import.meta.url),'utf8'));
for(const [legacy,current] of [['Pendiente','Unread'],['Leyendo','Reading'],['Leído','Read']]){
 const original={version:1,papers:[{...papers[0],status:legacy,notes:'Mis notas personales'}],manual:[],readingEnabled:false,readingPlan:[{id:papers[0].id,reason:'Añadido por ti.'}]};
 const migrated=validateWorkspace(structuredClone(original));
 assert.equal(migrated.papers[0].status,current);
 assert.equal(migrated.papers[0].notes,original.papers[0].notes);
 assert.equal(migrated.readingPlan[0].reason,'Added by you.');
 assert.equal(migrated.readingEnabled,false);
 assert.deepEqual(validateWorkspace(structuredClone(migrated)),migrated,'Migration must be idempotent');
}
const workspace={version:1,papers,manual:[],readingPlan:[{id:papers[0].id,reason:'Continuidad temática: Otros temas. Dentro del grupo, orden cronológico.'},{id:papers[1].id,reason:'Mi propia razón para leer este artículo.'}]};
const migrated=validateWorkspace(workspace);
assert.equal(migrated.readingPlan[0].reason,'Topic continuity: Other topics. Chronological order within the group.');
assert.equal(migrated.readingPlan[1].reason,'Mi propia razón para leer este artículo.');
console.log('Legacy statuses and built-in reading explanations migrate to English; user content and progress are preserved.');
