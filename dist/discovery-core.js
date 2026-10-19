import {normalizeDoi} from './core.js?v=7';
const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export const concepts=[
 {id:'ca2',label:'CA2 hipocampal',match:/\bca[ -]?2\b/,query:'(TITLE_ABS:CA2 AND TITLE_ABS:hippocamp*)'},
 {id:'hippocampus',label:'Hipocampo',match:/hipocamp|hippocamp/,query:'TITLE_ABS:hippocamp*'},
 {id:'pnn',label:'Redes perineuronales',match:/perineuron|\bpnn/,query:'(TITLE_ABS:"perineuronal nets" OR TITLE_ABS:"extracellular matrix")'},
 {id:'chabc',label:'ChABC',match:/chondroitinase|condroitinasa|\bchabc\b/,query:'(TITLE_ABS:chondroitinase OR TITLE_ABS:ChABC)'},
 {id:'social',label:'Memoria social',match:/memoria social|social memory|reconocimiento social|social recognition/,query:'(TITLE_ABS:"social memory" OR TITLE_ABS:"social recognition")'},
 {id:'odour',label:'Olores y orina',match:/olor|olfat|olfact|odo(?:u)?r|urina|orina|chemosensor/,query:'(TITLE_ABS:olfact* OR TITLE_ABS:odor* OR TITLE_ABS:odour* OR TITLE_ABS:urine)'},
 {id:'electrophys',label:'Electrofisiología',match:/electrofisi|electrophysi|silicon probe|sonda.*silicio/,query:'(TITLE_ABS:electrophysiolog* OR TITLE_ABS:"silicon probe")'},
 {id:'headfixed',label:'Head-fixed',match:/head[ -]?fix|cabeza.*(?:fija|inmovil)|inmovil.*cabeza/,query:'(TITLE_ABS:"head-fixed" OR TITLE_ABS:"head restrained")'},
 {id:'calcium',label:'Imagen de calcio',match:/calcium imag|imagen.*calcio|calcium imaging/,query:'TITLE_ABS:"calcium imaging"'},
 {id:'plasticity',label:'Plasticidad',match:/plasticid|plasticit|\bltp\b|\bltd\b/,query:'(TITLE_ABS:plasticity OR TITLE_ABS:LTP OR TITLE_ABS:LTD)'},
 {id:'pv',label:'Parvalbúmina',match:/parvalbum|\bpv\+/,query:'TITLE_ABS:parvalbumin'},
 {id:'inhibition',label:'Inhibición',match:/inhibic|inhibit|interneuron/,query:'(TITLE_ABS:inhibit* OR TITLE_ABS:interneuron*)'},
 {id:'castration',label:'Estado gonadal',match:/castra|gonad|androgen|testosteron/,query:'(TITLE_ABS:castrat* OR TITLE_ABS:gonad* OR TITLE_ABS:androgen*)'},
 {id:'identity',label:'Identidad individual',match:/identidad|identity|individual recognition/,query:'(TITLE_ABS:identity OR TITLE_ABS:"individual recognition")'},
 {id:'ripples',label:'Sharp-wave ripples',match:/sharp.wave|ripples?/,query:'TITLE_ABS:"sharp-wave ripples"'},
 {id:'optogenetic',label:'Optogenética',match:/optogenet/,query:'TITLE_ABS:optogenet*'},
 {id:'entorhinal',label:'Corteza entorrinal',match:/entorhinal|entorrinal/,query:'TITLE_ABS:entorhinal'},
 {id:'mouse',label:'Ratón',match:/\braton|\bmice\b|\bmouse\b/,query:'(TITLE_ABS:mice OR TITLE_ABS:mouse)'},
 {id:'female',label:'Hembras',match:/hembra|\bfemale/,query:'TITLE_ABS:female*'}
];
export function planSearch(text,mode='area',strict=false){
 const raw=text.trim();if(!raw)return {query:'',concepts:[]};const normalized=normalize(raw),found=concepts.filter(c=>c.match.test(normalized)),active=found.filter(c=>c.id!=='hippocampus'||!found.some(c=>c.id==='ca2'));
 if(!active.length)return {query:raw,concepts:[],fallback:mode==='experiment'};
 for(const term of normalized.match(/\b[a-z]{2,}\d[a-z0-9-]*\b/g)||[])if(!active.some(c=>c.match.test(term)))active.push({id:term,label:term.toUpperCase(),match:new RegExp('\\b'+term+'\\b'),query:'TITLE_ABS:'+term});
 const anchor=active.find(c=>c.id==='ca2')||active.find(c=>c.id==='hippocampus')||active[0],others=active.filter(c=>c!==anchor);
 let query=anchor.query;if(others.length)query+=' AND ('+others.map(c=>c.query).join(strict?' AND ':' OR ')+')';
 if(mode==='area'){let rest=normalized;for(const c of found)rest=rest.replace(new RegExp('(?:'+c.match.source+')[a-z0-9+-]*','g'),' ');const stop=new Set('de del el la los las un una y en sobre con para the of and in on about'.split(' '));const extra=[...new Set(rest.match(/[a-z][a-z0-9-]{2,}/g)||[])].filter(w=>!stop.has(w)&&!active.some(c=>c.match.test(w))).slice(0,8);if(extra.length)query+=' AND ('+extra.map(w=>'TITLE_ABS:'+w).join(' AND ')+')'}
 return {query,concepts:active,fallback:false};
}
export function matchConcepts(paper,selected){const text=normalize(paper.title+' '+(paper.abstract||'')+' '+(paper.keywords||''));return selected.filter(c=>c.match.test(text))}
export function fromEuropePMC(record,strip=s=>String(s||'').replace(/<[^>]+>/g,' ')){
 if(!record.id||!record.title)return null;const authors=record.authorList?.author?.map(a=>a.lastName?[a.lastName,a.firstName||a.initials].filter(Boolean).join(', '):a.fullName).filter(Boolean).join(' and ')||record.authorString||'';
 const types=record.pubTypeList?.pubType||[];
 return {id:'epmc-'+record.source+'-'+record.id,type:types.some(t=>/review/i.test(t))?'review':'article',title:strip(record.title).trim(),authors,year:String(record.pubYear||record.firstPublicationDate?.slice(0,4)||''),journal:record.journalInfo?.journal?.title||record.journalTitle||'',doi:normalizeDoi(record.doi||''),url:'https://europepmc.org/article/'+encodeURIComponent(record.source||'MED')+'/'+encodeURIComponent(record.id),abstract:strip(record.abstractText||'').trim(),keywords:(record.keywordList?.keyword||[]).join(', '),status:'Pendiente',notes:'',references:[],lookup:'unqueried',discoverySource:'Europe PMC',preprint:record.source==='PPR'||types.some(t=>/preprint/i.test(t))};
}
export function samePaper(a,b){if(a.doi&&b.doi&&normalizeDoi(a.doi)===normalizeDoi(b.doi))return true;if(a.id===b.id)return true;const title=s=>normalize(s).replace(/[^a-z0-9]/g,'');return !!a.title&&title(a.title)===title(b.title)}
export function searchUrl(query,cursor='*'){const u=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');u.search=new URLSearchParams({query,format:'json',resultType:'core',pageSize:'20',cursorMark:cursor});return u.href}
