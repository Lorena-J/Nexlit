import {buildLearningPath,LEARNING_STAGES} from './learning-core.js?v=29';
import {normalizeDoi} from './core.js?v=29';
const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const stop=new Set('de del el la los las un una y en sobre con para por como que quiero queremos estudiar estudio analizar comparar investigar proyecto experimento mediante utilizando usando voy vamos se al es son tengo hacer hago registrar registros the a an and or of in on with for to from i we want study investigate compare using research project experiment aim aims propose will would'.split(' '));
function words(s){return normalize(s).match(/[a-z0-9][a-z0-9+-]{1,}/g)?.filter(w=>!stop.has(w))||[]}
// Keep Boolean syntax intact. Plain-language queries use the chosen scope;
// quoted phrases stay together and never get expanded without the user's input.
export function compileQuery(query){
 const parts=query.match(/"[^"\n]*"|[()]|[^\s()"]+|"/g)||[];
 let position=0;
 const peek=()=>parts[position];
 function atom(){
  const token=parts[position++];
  if(!token)throw Error('Add a concept after the operator.');
  if(token==='NOT')return {type:'not',child:atom()};
  if(token==='('){const node=or();if(parts[position++]!==')')throw Error('Close every parenthesis in your query.');return node}
  if(['AND','OR',')'].includes(token))throw Error('Place a concept between operators.');
  if(token==='"')throw Error('Close every quoted phrase in your query.');
  const value=token.replace(/^"|"$/g,'').trim();
  if(!value||/[~*?:\\]/.test(value))throw Error('Use words, quoted phrases, parentheses and AND, OR or NOT.');
  return {type:'term',value};
 }
 function and(){let left=atom();while(position<parts.length&&peek()!==')'&&peek()!=='OR'){if(peek()==='AND')position++;left={type:'and',left,right:atom()}}return left}
 function or(){let left=and();while(peek()==='OR'){position++;left={type:'or',left,right:and()}}return left}
 if(!parts.length)throw Error('Enter a subject or describe your project.');
 const tree=or();if(position!==parts.length)throw Error('Check the parentheses in your query.');
 const concepts=[];
 function collect(node,excluded=false){
  if(node.type==='term'){if(!excluded&&!concepts.some(c=>c.id===normalize(node.value)))concepts.push({id:normalize(node.value),label:node.value});return}
  if(node.type==='not')collect(node.child,!excluded);else{collect(node.left,excluded);collect(node.right,excluded)}
 }
 collect(tree);
 if(!concepts.length)throw Error('Include at least one positive search concept.');
 if(concepts.length>32||encodeURIComponent(query).length>3000)throw Error('Shorten the query to at most 32 concepts.');
 return {query:query.trim(),tree,concepts};
}
export function planSearch(text,mode='area',scope='balanced'){
 const raw=text.trim();if(!raw)return {query:'',concepts:[]};
 if(/\b(?:AND|OR|NOT)\b|[()]/.test(raw))return compileQuery(raw);
 const terms=[];
 for(const part of raw.match(/"[^"\n]*"|[^\s"]+|"/g)||[]){
  if(part==='"')throw Error('Close every quoted phrase in your query.');
  const values=part.startsWith('"')?[part]:words(part);
  for(const value of values)if(!terms.includes(value))terms.push(value);
 }
 const limit=mode==='area'?20:14;
 if(terms.length>limit)throw Error(`Use at most ${limit} concepts, or write an explicit Boolean query.`);
 if(!terms.length)return {query:'',concepts:[]};
 const breadth=scope===true||scope==='strict'?'precise':scope===false||scope==='broad'?'exploratory':scope;
 const query=breadth==='exploratory'?terms.join(' OR '):breadth==='balanced'&&terms.length>2?terms[0]+' AND ('+terms.slice(1).join(' OR ')+')':terms.join(' AND ');
 return compileQuery(query);
}
// Light plural matching avoids losing basic variants without truncating technical terms.
const stem=word=>word.length>4&&word.endsWith('ies')?word.slice(0,-3)+'y':word.length>4&&/s$/.test(word)&&!/(ss|us|is)$/.test(word)?word.slice(0,-1):word;
const matchWords=text=>(normalize(text).match(/[a-z0-9]+/g)||[]).map(stem);
function contains(text,concept){
 const haystack=' '+matchWords(text).join(' ')+' ',needle=matchWords(concept).join(' ');
 return !!needle&&haystack.includes(' '+needle+' ');
}
const paperFields=paper=>[paper.title,paper.abstract,...(paper.keywords||'').split(/[,;]/)];
export function matchConcepts(paper,selected){
 const fields=paperFields(paper);
 return selected.filter(c=>fields.some(field=>contains(field||'',c.label)));
}
function satisfies(node,paper){
 if(node.type==='term')return paperFields(paper).some(field=>contains(field||'',node.value));
 if(node.type==='not')return !satisfies(node.child,paper);
 return node.type==='and'?satisfies(node.left,paper)&&satisfies(node.right,paper):satisfies(node.left,paper)||satisfies(node.right,paper);
}
export function rankResults(papers,plan){
 const maxRelevance=Math.max(0,...papers.map(p=>Number(p.relevanceScore)||0));
 return papers.map((p,index)=>{
  const matches=matchConcepts(p,plan.concepts),titleMatches=matchConcepts({title:p.title},plan.concepts);
  const coverage=matches.length/Math.max(1,plan.concepts.length),titleCoverage=titleMatches.length/Math.max(1,plan.concepts.length);
  // Provider relevance stays the largest component; local evidence refines it.
  const provider=maxRelevance?Math.log1p(Math.max(0,Number(p.relevanceScore)||0))/Math.log1p(maxRelevance):1/(index+1);
  return {p,index,matches,eligible:satisfies(plan.tree,p),score:.55*provider+.3*coverage+.15*titleCoverage};
 }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score||a.index-b.index);
}
export function candidateTarget(count,pool=100){return Math.min(500,Math.max(count,Number(pool)||100))}
export function rebuildAbstract(index){const result=[];for(const [word,places]of Object.entries(index||{}))for(const pos of places)result[pos]=word;return result.filter(Boolean).join(' ')}
export function fromOpenAlex(record,strip=s=>String(s||'').replace(/<[^>]+>/g,' ')){
 if(!record.id||!record.title)return null;const primary=record.primary_topic,topic=primary?.id?{id:primary.id.split('/').pop(),label:primary.display_name,foundation:primary.subfield?.display_name||primary.field?.display_name||primary.display_name}:undefined;
 const authors=(record.authorships||[]).map(a=>a.author?.display_name).filter(Boolean).map(name=>{const parts=name.trim().split(/\s+/);return parts.length>1?parts.pop()+', '+parts.join(' '):name}).join(' and ');
 return {id:'openalex-'+record.id.split('/').pop(),openAlexId:record.id,type:record.type||'article',title:strip(record.title),authors,year:String(record.publication_year||''),journal:record.primary_location?.source?.display_name||'',doi:normalizeDoi(record.doi||''),url:record.doi||record.primary_location?.landing_page_url||record.id,abstract:rebuildAbstract(record.abstract_inverted_index),keywords:(record.keywords||[]).map(k=>k.display_name).join(', '),topic,relevanceScore:Math.max(0,Number(record.relevance_score)||0),status:'Unread',notes:'',references:[],lookup:'unqueried',discoverySource:'OpenAlex',language:record.language||'',preprint:record.type==='preprint'};
}
export function samePaper(a,b){if(a.doi&&b.doi&&normalizeDoi(a.doi)===normalizeDoi(b.doi))return true;if(a.id===b.id)return true;const title=s=>normalize(s).replace(/[^a-z0-9]/g,'');return !!a.title&&title(a.title)===title(b.title)}

export function searchUrl(query,page='1'){const u=new URL('https://api.openalex.org/works');u.search=new URLSearchParams({'search.title_abstract_keywords':query,filter:'language:en','per-page':'20',page:page==='*'?'1':page});return u.href}
export function isEnglishRecord(record){return ['en','eng','english'].includes(String(record.language||'').toLowerCase())}
export function translationChunks(text,maxBytes=440){const chunks=[];let current='';for(const word of text.trim().split(/\s+/)){if(new TextEncoder().encode(current+' '+word).length>maxBytes&&current){chunks.push(current);current=word}else current+=(current?' ':'')+word}if(current)chunks.push(current);return chunks}
export async function translateQuery(text,{signal,area=false,fetcher=fetch}={}){
 let source=text.replace(/\bbases\s+de\b/gi,'fundamentos de');const wrapped=area&&new TextEncoder().encode(source).length<300;if(wrapped)source='Estoy buscando publicaciones académicas sobre '+source+'.';const output=[];
 for(const chunk of translationChunks(source)){const u=new URL('https://api.mymemory.translated.net/get');u.search=new URLSearchParams({q:chunk,langpair:'es|en'});const response=await fetcher(u.href,{signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Could not translate the query. Write it in English and select “English”.');const data=await response.json();if(Number(data.responseStatus)!==200||data.quotaFinished||!data.responseData?.translatedText)throw Error('The translation service is unavailable. You can write the query in English.');output.push(data.responseData.translatedText)}
 return output.join(' ').replace(/^I(?: am|'m) (?:looking|searching) for academic publications (?:on|about)\s*/i,'').replace(/\.$/,'').trim();
}
export function mergeDiscoveryBatch(existing,incoming){const papers=[...existing],ids=[];for(const paper of incoming){let known=papers.find(p=>samePaper(p,paper));if(!known){let id=paper.id,n=2;while(papers.some(p=>p.id===id))id=paper.id+'-'+n++;known={...paper,id};papers.push(known)}if(!ids.includes(known.id))ids.push(known.id)}return {papers,ids}}

export function learningSearchJobs(plan,subject,stage=0){
 const label=LEARNING_STAGES[stage].label;
 const cues=[
  '(introduction OR introductory OR beginners OR overview)',
  '(fundamentals OR foundations OR "basic concepts" OR elementary)',
  '(methods OR methodology OR protocol OR "experimental design")',
  '(applications OR applied OR "case study")',
  '(advanced OR frontiers OR "open problems")'
 ];
 const quoted='"'+subject.replace(/["\\]/g,'').trim()+'"';
 // Foundation searches deliberately broaden the target, while retaining explicit exclusions.
 const exclusions=[];
 const expression=node=>node.type==='term'?'"'+node.value+'"':node.type==='not'?'NOT ('+expression(node.child)+')':'('+expression(node.left)+' '+node.type.toUpperCase()+' '+expression(node.right)+')';
 function negative(node){
  if(node.type==='not'){exclusions.push(expression(node));return}
  if(node.type!=='term'){negative(node.left);negative(node.right)}
 }
 negative(plan.tree);
 const base=stage<3?quoted:plan.query;
 const query='('+base+')'+(stage<3&&exclusions.length?' AND '+exclusions.join(' AND '):'');
 const url=new URL(searchUrl(query));url.searchParams.set('search.title',cues[stage]);
 return {stage,label,query,url:url.href};
}
export function learningSearchUrls(query){const plan=compileQuery(query);return [0,1].map(stage=>learningSearchJobs(plan,plan.concepts[0].label,stage).url)}
export function selectLearningPapers(candidates,count,context={}){
 const report=buildLearningPath(candidates,{...context,count});
 return {...report,missingBasics:!report.steps.length};
}
