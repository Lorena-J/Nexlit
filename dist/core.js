export function clean(s=''){return String(s).replace(/\\(?:textit|textbf|emph|mathrm)\s*/g,'').replace(/[{}]/g,'').replace(/\\&/g,'&').replace(/\s+/g,' ').trim()}
export function parseBib(src){
 const papers=[],macros={};let i=0;
 function ws(){while(i<src.length){if(/\s/.test(src[i]))i++;else if(src[i]==='%'){while(i<src.length&&src[i]!=='\n')i++}else break}}
 function value(){ws();let out='';if(src[i]==='{'){i++;let depth=1;while(i<src.length&&depth){let c=src[i++];if(c==='\\'&&i<src.length){out+=c+src[i++];continue}if(c==='{')depth++;if(c==='}')depth--;if(depth)out+=c}if(depth)throw Error('Hay una llave sin cerrar en el fichero.')}else if(src[i]==='"'){i++;let closed=false;while(i<src.length){let c=src[i++];if(c==='\\'&&i<src.length){out+=c+src[i++];continue}if(c==='"'){closed=true;break}out+=c}if(!closed)throw Error('Hay comillas sin cerrar en el fichero.')}else{while(i<src.length&&!/[,\s#})]/.test(src[i]))out+=src[i++];out=macros[out.toLowerCase()]??out}ws();if(src[i]==='#'){i++;out+=value()}return out}
 while(i<src.length){if(src[i++]!=='@')continue;let start=i;while(/[a-z]/i.test(src[i]??'')&&i<src.length)i++;let type=src.slice(start,i).toLowerCase();ws();let open=src[i++];if(!['{','('].includes(open))continue;let close=open==='{'?'}':')';if(['comment','preamble'].includes(type)){let depth=1;while(i<src.length&&depth){let c=src[i++];if(c===open)depth++;if(c===close)depth--}continue}ws();if(type==='string'){let k='';while(i<src.length&&src[i]!=='=')k+=src[i++];i++;macros[k.trim().toLowerCase()]=value();while(i<src.length&&src[i]!==close)i++;i++;continue}
 let key='';while(i<src.length&&src[i]!==','&&src[i]!==close)key+=src[i++];if(src[i]!==',')continue;i++;const fields={};let ended=false;
 while(i<src.length){ws();if(src[i]===close){i++;ended=true;break}if(src[i]===','){i++;continue}let k='';while(i<src.length&&/[\w-]/.test(src[i]))k+=src[i++];ws();if(!k||src[i]!=='=')throw Error('No se puede leer el campo cerca de '+key.trim());i++;fields[k.toLowerCase()]=value()}
 if(!ended)throw Error('La entrada '+key.trim()+' está incompleta.');if(!fields.title)continue;
 papers.push({id:key.trim(),type,title:clean(fields.title),authors:clean(fields.author??fields.organization??''),year:(fields.year??fields.date??'').slice(0,4),journal:clean(fields.journaltitle??fields.journal??''),doi:normalizeDoi(fields.doi??''),url:fields.url??'',abstract:clean(fields.abstract??''),keywords:clean(fields.keywords??''),status:'Pendiente',notes:'',references:[],lookup:'unqueried'});
 }if(!papers.length)throw Error('No se encontraron referencias con título.');const seen=new Set();for(const p of papers){if(seen.has(p.id))throw Error('Clave bibliográfica duplicada: '+p.id);seen.add(p.id)}return papers;
}
export function normalizeDoi(s=''){return String(s).trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').toLowerCase()}
const stop=new Set('the a an and or of in on to for with by from its their this that as is are be was were not we it at into through using use how can between during et al study studies role effects effect associated underlying region hippocampal hippocampus social memory neuronal neurons neural cell cells'.split(' '));
export function tokens(p){return [...new Set((p.title+' '+(p.abstract??'')+' '+(p.keywords??'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g)?.filter(w=>!stop.has(w))??[])]}
export function connections(papers,manual=[]){
 const docs=papers.map(tokens),freq=new Map();docs.forEach(a=>a.forEach(t=>freq.set(t,(freq.get(t)??0)+1)));let result=[];
 for(let i=0;i<papers.length;i++)for(let j=i+1;j<papers.length;j++){let shared=docs[i].filter(t=>docs[j].includes(t));const weight=t=>1+Math.log((papers.length+1)/(freq.get(t)+1));let dot=shared.reduce((s,t)=>s+weight(t)**2,0),norm=docs[i].reduce((s,t)=>s+weight(t)**2,0)*docs[j].reduce((s,t)=>s+weight(t)**2,0);let score=norm?dot/Math.sqrt(norm):0;if(shared.length&&score>=.07)result.push({source:papers[i].id,target:papers[j].id,type:'topic',reason:'Términos compartidos: '+shared.sort((a,b)=>weight(b)-weight(a)).slice(0,6).join(', ')+'. Base: títulos, palabras clave y resúmenes disponibles.',score});}
 const byDoi=new Map(papers.filter(p=>p.doi).map(p=>[normalizeDoi(p.doi),p.id]));for(const p of papers)for(const doi of new Set(p.references??[])){let target=byDoi.get(normalizeDoi(doi));if(target&&target!==p.id)result.push({source:p.id,target,type:'citation',reason:'La lista de referencias de '+p.id+' en Crossref incluye el DOI de '+target+'.',score:1})}
 const ids=new Set(papers.map(p=>p.id));return result.concat(manual.filter(e=>ids.has(e.source)&&ids.has(e.target)));
}
export function validateWorkspace(data){if(data?.version!==1||!Array.isArray(data.papers)||!Array.isArray(data.manual))throw Error('Este JSON no es una biblioteca de Atlas.');if(!data.papers.length)throw Error('La biblioteca está vacía.');const ids=new Set();for(const p of data.papers){if(typeof p.id!=='string'||typeof p.title!=='string'||ids.has(p.id))throw Error('Referencia inválida o duplicada.');ids.add(p.id);for(const k of ['authors','year','journal','doi','url','abstract','keywords','notes'])if(p[k]!==undefined&&typeof p[k]!=='string')throw Error('Campo inválido: '+k);if(!['Pendiente','Leyendo','Leído'].includes(p.status))p.status='Pendiente';if(!Array.isArray(p.references)||p.references.some(x=>typeof x!=='string'))throw Error('Lista de referencias inválida.')}if(data.readingPlan===undefined)data.readingPlan=[];if(!Array.isArray(data.readingPlan))throw Error('Ruta de lectura inválida.');const planned=new Set();for(const item of data.readingPlan){if(!item||!ids.has(item.id)||planned.has(item.id)||typeof item.reason!=='string')throw Error('Ruta de lectura inválida o duplicada.');planned.add(item.id)}for(const e of data.manual)if(e.type!=='manual'||typeof e.reason!=='string'||!ids.has(e.source)||!ids.has(e.target))throw Error('Conexión manual inválida.');return data}

// Topic suggestions from available text, with title/keyword matches weighted above abstracts.
// Unrecognized subjects use shared, distinctive terms rather than neuroscience labels.
export function groupByContent(papers){
 const rules=[
  {id:'analysis',label:'Métodos de análisis',terms:[/spike sort\w*/g,/kilosort\w*/g,/cluster\w*/g,/spike detect\w*/g,/analisis de datos/g]},
  {id:'olfaction',label:'Información olfativa',terms:[/olfact\w*/g,/odo(?:u)?r\w*/g,/chemosensor\w*/g,/urinar\w*/g,/\bmups?\b/g]},
  {id:'representations',label:'Representaciones sociales',terms:[/represent\w*/g,/\bcoding\b/g,/identit\w*/g,/novelty/g,/threat/g,/safety/g,/selectiv\w*/g]},
  {id:'circuits',label:'Circuitos y dinámica',terms:[/\bcircuit\w*/g,/entorhinal/g,/ripples?/g,/reactivat\w*/g,/physiolog\w*/g,/oscillat\w*/g,/connectiv\w*/g]},
  {id:'matrix',label:'Matriz y plasticidad',terms:[/perineuronal/g,/extracellular/g,/\bpnns?\b/g,/plastic\w*/g,/chondroitin\w*/g]},
  {id:'memory',label:'Memoria social',terms:[/social memory/g,/social recognition/g,/memoria social/g,/reconocimiento social/g]}
 ];
 const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const groups=new Map(),assignment=new Map(),unknown=[];
 for(const p of papers){const title=norm(p.title),keywords=norm(p.keywords),abstract=norm(p.abstract);let best=null,bestScore=0;for(const rule of rules){let score=0;for(const term of rule.terms){score+=(title.match(term)||[]).length*4+(keywords.match(term)||[]).length*3+(abstract.match(term)||[]).length*.12}if(score>bestScore){bestScore=score;best=rule}}if(best&&bestScore>=3){if(!groups.has(best.id))groups.set(best.id,{id:best.id,label:best.label,paperIds:[]});groups.get(best.id).paperIds.push(p.id);assignment.set(p.id,best.id)}else unknown.push(p)}
 const docs=unknown.map(tokens),freq=new Map();docs.forEach(ts=>ts.forEach(t=>freq.set(t,(freq.get(t)||0)+1)));const assigned=new Set();
 const terms=[...freq].filter(([term,count])=>count>=2&&!(unknown.length>2&&count>unknown.length*.75)&&term!=='ca2').sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 for(const [term] of terms){const members=unknown.filter((p,i)=>!assigned.has(p.id)&&docs[i].includes(term));if(members.length<2)continue;const id='term-'+term;groups.set(id,{id,label:term.charAt(0).toUpperCase()+term.slice(1),paperIds:members.map(p=>p.id)});members.forEach(p=>{assigned.add(p.id);assignment.set(p.id,id)})}
 const rest=unknown.filter(p=>!assigned.has(p.id));if(rest.length){groups.set('other',{id:'other',label:'Otros temas',paperIds:rest.map(p=>p.id)});rest.forEach(p=>assignment.set(p.id,'other'))}
 return {groups:[...groups.values()],assignment};
}

export function suggestReadingPlan(papers){
 const {assignment}=groupByContent(papers);
 const stages={memory:1,circuits:2,olfaction:3,matrix:3,representations:4,analysis:5};
 const reasons={memory:'Base experimental para la memoria social.',circuits:'Circuitos y dinámica: contexto para interpretar la actividad neuronal.',olfaction:'Información olfativa: conexión entre estímulos y respuestas.',matrix:'Matriz y plasticidad: mecanismos que pueden modificar el circuito.',representations:'Representaciones sociales: integración de las dimensiones estudiadas.',analysis:'Métodos de análisis: apoyo para trabajar con los registros.'};
 return papers.map(p=>{const review=/\breview\b|revisi[oó]n|current opinion|annual review/i.test([p.type,p.title,p.journal].join(' ')),topic=assignment.get(p.id);return {id:p.id,stage:review?0:(stages[topic]??2),year:Number(p.year)||9999,reason:review?'Panorama general antes de los estudios específicos.':reasons[topic]||'Continuidad temática; dentro del grupo, del trabajo más antiguo al reciente.'}}).sort((a,b)=>a.stage-b.stage||a.year-b.year||a.id.localeCompare(b.id)).map(({id,reason})=>({id,reason}));
}
