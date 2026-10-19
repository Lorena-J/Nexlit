export function clean(s=''){return String(s).replace(/\\(?:textit|textbf|emph|mathrm)\s*/g,'').replace(/[{}]/g,'').replace(/\\&/g,'&').replace(/\s+/g,' ').trim()}
export function parseBib(src){
 const papers=[],macros={};let i=0;
 function ws(){while(i<src.length){if(/\s/.test(src[i]))i++;else if(src[i]==='%'){while(i<src.length&&src[i]!=='\n')i++}else break}}
 function value(){ws();let out='';if(src[i]==='{'){i++;let depth=1;while(i<src.length&&depth){let c=src[i++];if(c==='\\'&&i<src.length){out+=c+src[i++];continue}if(c==='{')depth++;if(c==='}')depth--;if(depth)out+=c}if(depth)throw Error('The file contains an unclosed brace.')}else if(src[i]==='"'){i++;let closed=false;while(i<src.length){let c=src[i++];if(c==='\\'&&i<src.length){out+=c+src[i++];continue}if(c==='"'){closed=true;break}out+=c}if(!closed)throw Error('The file contains an unclosed quotation mark.')}else{while(i<src.length&&!/[,\s#})]/.test(src[i]))out+=src[i++];out=macros[out.toLowerCase()]??out}ws();if(src[i]==='#'){i++;out+=value()}return out}
 while(i<src.length){if(src[i++]!=='@')continue;let start=i;while(/[a-z]/i.test(src[i]??'')&&i<src.length)i++;let type=src.slice(start,i).toLowerCase();ws();let open=src[i++];if(!['{','('].includes(open))continue;let close=open==='{'?'}':')';if(['comment','preamble'].includes(type)){let depth=1;while(i<src.length&&depth){let c=src[i++];if(c===open)depth++;if(c===close)depth--}continue}ws();if(type==='string'){let k='';while(i<src.length&&src[i]!=='=')k+=src[i++];i++;macros[k.trim().toLowerCase()]=value();while(i<src.length&&src[i]!==close)i++;i++;continue}
 let key='';while(i<src.length&&src[i]!==','&&src[i]!==close)key+=src[i++];if(src[i]!==',')continue;i++;const fields={};let ended=false;
 while(i<src.length){ws();if(src[i]===close){i++;ended=true;break}if(src[i]===','){i++;continue}let k='';while(i<src.length&&/[\w-]/.test(src[i]))k+=src[i++];ws();if(!k||src[i]!=='=')throw Error('Cannot read the field near '+key.trim());i++;fields[k.toLowerCase()]=value()}
 if(!ended)throw Error('The entry '+key.trim()+' is incomplete.');if(!fields.title)continue;
 papers.push({id:key.trim(),type,title:clean(fields.title),authors:clean(fields.author??fields.organization??''),year:(fields.year??fields.date??'').slice(0,4),journal:clean(fields.journaltitle??fields.journal??''),doi:normalizeDoi(fields.doi??''),url:fields.url??'',abstract:clean(fields.abstract??''),keywords:clean(fields.keywords??''),status:'Unread',notes:'',references:[],lookup:'unqueried'});
 }if(!papers.length)throw Error('No references with titles were found.');const seen=new Set();for(const p of papers){if(seen.has(p.id))throw Error('Duplicate bibliography key: '+p.id);seen.add(p.id)}return papers;
}
export function normalizeDoi(s=''){return String(s).trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').toLowerCase()}
const stop=new Set('the a an and or of in on to for with by from its their this that as is are be was were not we it at into through using use how can between during et al study studies role effects effect associated underlying analysis research results paper article review introduction overview based approach el la los las de del en por para con una uno un que se su sus como estudio estudios investigacion resultado resultados'.split(' '));
export function tokens(p){return [...new Set((p.title+' '+(p.abstract??'')+' '+(p.keywords??'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g)?.filter(w=>!stop.has(w))??[])]}
export function connections(papers,manual=[]){
 const docs=papers.map(tokens),freq=new Map();docs.forEach(a=>a.forEach(t=>freq.set(t,(freq.get(t)??0)+1)));let result=[];
 for(let i=0;i<papers.length;i++)for(let j=i+1;j<papers.length;j++){let shared=docs[i].filter(t=>docs[j].includes(t));const weight=t=>1+Math.log((papers.length+1)/(freq.get(t)+1));let dot=shared.reduce((s,t)=>s+weight(t)**2,0),norm=docs[i].reduce((s,t)=>s+weight(t)**2,0)*docs[j].reduce((s,t)=>s+weight(t)**2,0);let score=norm?dot/Math.sqrt(norm):0;if(shared.length&&score>=.07)result.push({source:papers[i].id,target:papers[j].id,type:'topic',reason:'Shared terms: '+shared.sort((a,b)=>weight(b)-weight(a)).slice(0,6).join(', ')+'. Based on available titles, keywords and abstracts.',score});}
 const byDoi=new Map(papers.filter(p=>p.doi).map(p=>[normalizeDoi(p.doi),p.id]));for(const p of papers)for(const doi of new Set(p.references??[])){let target=byDoi.get(normalizeDoi(doi));if(target&&target!==p.id)result.push({source:p.id,target,type:'citation',reason:'The reference list for '+p.id+' in Crossref includes the DOI of '+target+'.',score:1})}
 const ids=new Set(papers.map(p=>p.id));return result.concat(manual.filter(e=>ids.has(e.source)&&ids.has(e.target)));
}
// Migrate built-in text from earlier Spanish libraries; preserve user content.
const legacyReasons = {
  "Añadido por ti.": "Added by you.",
  "Visión general: revisión o síntesis del área.": "Overview: a review or synthesis of the field.",
  "Conceptos y fundamentos antes de trabajos más específicos.": "Concepts and fundamentals before more specific papers.",
  "Métodos y aplicación práctica.": "Methods and practical applications.",
  "Profundización: el título indica un tratamiento avanzado o de frontera.": "In depth: the title suggests advanced or frontier research.",
  "Primer paso: el título presenta fundamentos o una introducción al tema.": "First step: the title presents fundamentals or an introduction to the topic.",
  "Amplía el contexto con una revisión o visión general del área.": "Build context with a review or overview of the field.",
  "Continúa con trabajos específicos o aplicaciones; revisa sus requisitos previos.": "Continue with specific papers or applications; check their prerequisites."
};
function migrateReadingReason(reason){
 if(Object.hasOwn(legacyReasons,reason))return legacyReasons[reason];
 const match=reason.match(/^Continuidad temática: (.*)\. Dentro del grupo, orden cronológico\.$/);
 if(match)return 'Topic continuity: '+(match[1]==='tema general'?'general topic':match[1]==='Otros temas'?'Other topics':match[1])+'. Chronological order within the group.';
 return reason;
}
export function validateWorkspace(data){if(data?.version!==1||!Array.isArray(data.papers)||!Array.isArray(data.manual))throw Error('This JSON file is not a Nexlit library.');if(!data.papers.length)throw Error('The library is empty.');const ids=new Set();for(const p of data.papers){if(typeof p.id!=='string'||typeof p.title!=='string'||ids.has(p.id))throw Error('Invalid or duplicate reference.');ids.add(p.id);for(const k of ['authors','year','journal','doi','url','abstract','keywords','notes'])if(p[k]!==undefined&&typeof p[k]!=='string')throw Error('Invalid field: '+k);p.status=({Pendiente:'Unread',Leyendo:'Reading','Leído':'Read'})[p.status]??p.status;if(!['Unread','Reading','Read'].includes(p.status))p.status='Unread';if(!Array.isArray(p.references)||p.references.some(x=>typeof x!=='string'))throw Error('Invalid reference list.')}if(data.graphPaperIds!==undefined&&data.graphPaperIds!==null&&(!Array.isArray(data.graphPaperIds)||!data.graphPaperIds.length||new Set(data.graphPaperIds).size!==data.graphPaperIds.length||data.graphPaperIds.some(id=>!ids.has(id))))throw Error('Invalid graph selection.');if(data.learningMode!==undefined&&typeof data.learningMode!=='boolean')throw Error('Invalid learning mode.');if(data.readingEnabled!==undefined&&typeof data.readingEnabled!=='boolean')throw Error('Invalid reading path state.');if(data.readingPlan===undefined)data.readingPlan=[];if(!Array.isArray(data.readingPlan))throw Error('Invalid reading path.');const planned=new Set();for(const item of data.readingPlan){if(!item||!ids.has(item.id)||planned.has(item.id)||typeof item.reason!=='string')throw Error('Invalid or duplicate reading path.');item.reason=migrateReadingReason(item.reason);planned.add(item.id)}for(const e of data.manual)if(e.type!=='manual'||typeof e.reason!=='string'||!ids.has(e.source)||!ids.has(e.target))throw Error('Invalid manual connection.');return data}

// Prefer provider-assigned topics; otherwise form groups from distinctive shared terms.
export function groupByContent(papers){
 const assignment=new Map(),groups=new Map(),pending=[];
 for(const p of papers){if(p.topic?.id&&p.topic?.label){const id='topic-'+p.topic.id;if(!groups.has(id))groups.set(id,{id,label:p.topic.label,paperIds:[]});groups.get(id).paperIds.push(p.id);assignment.set(p.id,id)}else pending.push(p)}
 const docs=pending.map(tokens),freq=new Map();docs.forEach(ts=>ts.forEach(t=>freq.set(t,(freq.get(t)||0)+1)));const assigned=new Set();
 const terms=[...freq].filter(([,count])=>count>=2&&!(pending.length>3&&count>pending.length*.6)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 for(const [term]of terms){const members=pending.filter((p,i)=>!assigned.has(p.id)&&docs[i].includes(term));if(members.length<2)continue;const id='term-'+term;groups.set(id,{id,label:/\d/.test(term)?term.toUpperCase():term.charAt(0).toUpperCase()+term.slice(1),paperIds:members.map(p=>p.id)});members.forEach(p=>{assigned.add(p.id);assignment.set(p.id,id)})}
 const rest=pending.filter(p=>!assigned.has(p.id));if(rest.length){groups.set('other',{id:'other',label:'Other topics',paperIds:rest.map(p=>p.id)});rest.forEach(p=>assignment.set(p.id,'other'))}
 return {groups:[...groups.values()],assignment};
}
export function suggestReadingPlan(papers,{fromScratch=false}={}){
 if(fromScratch)return papers.map((p,i)=>({id:p.id,reason:learningLevel(p).reason,level:learningLevel(p).level,i})).sort((a,b)=>a.level-b.level||a.i-b.i).map(({id,reason})=>({id,reason}));
 const {assignment,groups}=groupByContent(papers),labels=new Map(groups.map(g=>[g.id,g.label]));
 return papers.map(p=>{const review=/review|revisi[oó]n|survey|state of the art|annual review|current opinion/i.test([p.type,p.title,p.journal].join(' ')),intro=/introduction|fundamentals?|basics?|tutorial|primer|introduccion|fundamentos|conceptos basicos/i.test(p.title),methods=/methodolog|protocol|implementation|metodolog/i.test(p.title),group=assignment.get(p.id);return {id:p.id,stage:review?0:intro?1:methods?3:2,group,year:Number(p.year)||9999,reason:review?'Overview: a review or synthesis of the field.':intro?'Concepts and fundamentals before more specific papers.':methods?'Methods and practical applications.':'Topic continuity: '+(labels.get(group)||'general topic')+'. Chronological order within the group.'}}).sort((a,b)=>a.stage-b.stage||(a.group||'').localeCompare(b.group||'')||a.year-b.year||a.id.localeCompare(b.id)).map(({id,reason})=>({id,reason}));
}

export function learningLevel(p){
 const title=(p.title||'').toLowerCase();
 if(/\badvanced\b|frontiers|state.of.the.art|recent advances|cutting.edge/.test(title))return {level:3,label:'Advanced',reason:'In depth: the title suggests advanced or frontier research.'};
 if(/introduc|fundamental|\bbasic|elementary|tutorial|\bprimer\b|beginner|first course|starting|foundations of/.test(title))return {level:0,label:'Fundamentals',reason:'First step: the title presents fundamentals or an introduction to the topic.'};
 if(/review|survey|overview|handbook/.test(title+' '+(p.type||'')))return {level:1,label:'Overview',reason:'Build context with a review or overview of the field.'};
 return {level:2,label:'Development and applications',reason:'Continue with specific papers or applications; check their prerequisites.'};
}
