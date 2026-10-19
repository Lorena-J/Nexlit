// Keys belong to the current user, never to the published static app.
const abortError=()=>Object.assign(new Error('Request canceled.'),{name:'AbortError'});
function pause(ms,signal){
 if(signal?.aborted)return Promise.reject(abortError());
 return new Promise((resolve,reject)=>{
  const done=()=>{signal?.removeEventListener('abort',cancel);resolve()};
  const timer=setTimeout(done,ms);
  function cancel(){clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(abortError())}
  signal?.addEventListener('abort',cancel,{once:true});
 });
}
function seconds(value,now){
 if(value===null||value===undefined||value==='')return null;
 const number=Number(value);if(Number.isFinite(number))return Math.max(0,number);
 const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,(date-now)/1000):null;
}
export function createOpenAlexClient({fetcher=fetch,now=Date.now,wait=pause,cacheTTL=15*60*1000,minInterval=null,maxRetries=2}={}){
 let key='',lastRequest=-Infinity,blockedUntil=0,blockedMessage='';const cache=new Map();
 function setKey(value){
  const next=String(value||'').trim();
  if(/\s/.test(next))throw Error('The OpenAlex key must not contain spaces or line breaks.');
  if(next!==key){key=next;cache.clear();blockedUntil=0;blockedMessage='';lastRequest=-Infinity}
 }
 function quotaError(){return Object.assign(new Error(blockedMessage),{code:'daily_budget',needsKey:!key,retryAt:blockedUntil})}
 async function request(rawUrl,signal){
  const url=new URL(rawUrl);
  if(url.origin!=='https://api.openalex.org')throw Error('OpenAlex credentials can only be sent to OpenAlex.');
  url.searchParams.delete('api_key');url.searchParams.sort();const cacheKey=url.href;
  if(signal?.aborted)throw abortError();
  const cached=cache.get(cacheKey);
  if(cached&&cached.expires>now())return cached.data;
  if(blockedUntil>now())throw quotaError();
  for(let attempt=0;attempt<=maxRetries;attempt++){
   const spacing=minInterval??(key?250:1100),remaining=lastRequest+spacing-now();
   if(remaining>0)await wait(remaining,signal);
   if(signal?.aborted)throw abortError();
   lastRequest=now();
   const response=await fetcher(url.href,{signal,credentials:'omit',referrerPolicy:'no-referrer',headers:key?{Authorization:'Bearer '+key}:{}});
   let data;try{data=await response.json()}catch{data={}}
   if(response.ok){
    if(cacheTTL>0){cache.set(cacheKey,{data,expires:now()+cacheTTL});if(cache.size>50)cache.delete(cache.keys().next().value)}
    return data;
   }
   const header=name=>response.headers?.get(name)??null;
   if(response.status===429){
    const delay=seconds(header('Retry-After')??data.retryAfter,now());
    const reset=seconds(header('X-RateLimit-Reset'),now());
    const message=String(data.message||data.error||'');
    const daily=/insufficient budget|daily budget|daily quota|budget.*(?:used|exhausted|exceeded)/i.test(message)||data.dailyRemainingUsd===0||data.creditsRemaining===0||(header('X-RateLimit-Remaining')==='0'&&(delay??reset??0)>60);
    if(daily){
     const nextMidnight=new Date(now());nextMidnight.setUTCHours(24,0,0,0);
     blockedUntil=now()+(reset??delay??((nextMidnight.getTime()-now())/1000))*1000;
     const resetLabel=new Date(blockedUntil).toLocaleTimeString('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit'})+' UTC';
     blockedMessage=key?`Your OpenAlex daily budget is exhausted. It resets at ${resetLabel}. Check your OpenAlex account usage; waiting a few seconds will not help.`:`The shared anonymous OpenAlex daily budget is exhausted. It resets at ${resetLabel}. Add your own free OpenAlex API key below to use your personal budget; waiting a few seconds will not help.`;
     throw quotaError();
    }
    if(attempt<maxRetries&&(delay??0)<=15){await wait(Math.max(delay??0,2**attempt)*1000,signal);continue}
    throw Object.assign(new Error(delay?`OpenAlex is limiting request frequency. Retry in about ${Math.ceil(delay)} seconds.`:'OpenAlex is limiting request frequency. Try again later.'),{code:'rate_limit'});
   }
   if(response.status===401||response.status===403){
    const activation=/key_not_activated|not activated|verify|verification/i.test(JSON.stringify(data));
    throw Object.assign(new Error(activation?'Activate your OpenAlex key using the link in its verification email, then try again.':'OpenAlex rejected the API key. Check or replace it in OpenAlex access below.'),{code:'authentication',needsKey:true});
   }
   throw Error('OpenAlex is currently unavailable. Please try again.');
  }
 }
 return {request,setKey,hasKey:()=>!!key};
}
