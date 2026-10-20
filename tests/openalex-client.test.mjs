import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenAlexClient} from '../dist/openalex-client.js';
const url='https://api.openalex.org/works?search=social%20recognition';
const response=(status,data={},headers={})=>({ok:status===200,status,json:async()=>data,headers:{get:name=>headers[name]??null}});

test('daily shared budget blocks further requests until reset; adding a key enables a personal request',async()=>{
 let calls=0,clock=Date.UTC(2026,9,19,16),last;
 const client=createOpenAlexClient({now:()=>clock,minInterval:0,fetcher:async(address,options)=>{
  calls++;last={address,options};
  return calls===1?response(429,{message:'Insufficient budget',dailyRemainingUsd:0,retryAfter:28800}):response(200,{results:[]});
 }});
 await assert.rejects(client.request(url),error=>error.code==='daily_budget'&&error.needsKey&&/00:00 UTC/.test(error.message));
 await assert.rejects(client.request(url+'&page=2'),error=>error.code==='daily_budget');
 assert.equal(calls,1,'Daily exhaustion must not trigger automatic retries');
 client.setKey('test-personal-key');
 await client.request(url+'&api_key=discard-this-query-key');
 assert.equal(calls,2);assert.equal(last.options.headers.Authorization,'Bearer test-personal-key');
 assert(!last.address.includes('key'));assert.equal(last.options.credentials,'omit');assert.equal(last.options.referrerPolicy,'no-referrer');
 client.setKey('');assert.equal(client.hasKey(),false);
});

test('daily budget resets and cached results remain available during a budget block',async()=>{
 let clock=0,calls=0;
 const client=createOpenAlexClient({now:()=>clock,minInterval:0,fetcher:async()=>{
  calls++;return calls===2?response(429,{creditsRemaining:0},{'Retry-After':'60'}):response(200,{results:[calls]});
 }});
 const cached=await client.request(url);
 await assert.rejects(client.request(url+'&page=2'),{code:'daily_budget'});
 assert.deepEqual(await client.request(url),cached);assert.equal(calls,2);
 clock=61000;await client.request(url+'&page=2');assert.equal(calls,3);
});

test('cache expires, canonicalizes query order, and clears when credentials change',async()=>{
 let clock=0,calls=0;
 const client=createOpenAlexClient({now:()=>clock,minInterval:0,cacheTTL:100,fetcher:async()=>response(200,{request:++calls})});
 await client.request(url+'&page=1');await client.request('https://api.openalex.org/works?page=1&search=social%20recognition');assert.equal(calls,1);
 clock=101;await client.request(url+'&page=1');assert.equal(calls,2);
 client.setKey('different-key');await client.request(url+'&page=1');assert.equal(calls,3);
});

test('temporary throttling uses bounded backoff and retries, without treating it as daily exhaustion',async()=>{
 let calls=0,clock=0;const waits=[];
 const client=createOpenAlexClient({now:()=>clock,minInterval:0,wait:async ms=>{waits.push(ms);clock+=ms},fetcher:async()=>++calls<3?response(429,{}, {'Retry-After':'2'}):response(200,{results:[]})});
 await client.request(url);assert.equal(calls,3);assert.deepEqual(waits,[2000,2000]);
 calls=0;
 const limited=createOpenAlexClient({minInterval:0,wait:async()=>{},fetcher:async()=>{calls++;return response(429)}});
 await assert.rejects(limited.request(url),{code:'rate_limit'});assert.equal(calls,3);
 const longDelay=createOpenAlexClient({fetcher:async()=>response(429,{}, {'Retry-After':'120'})});
 await assert.rejects(longDelay.request(url),error=>error.code==='rate_limit'&&/120 seconds/.test(error.message));
});

test('credentials never go to other origins; activation and invalid keys have actionable errors',async()=>{
 let calls=0;
 const client=createOpenAlexClient({minInterval:0,fetcher:async()=>{calls++;return response(403,{error:'key_not_activated'})}});
 client.setKey('secret');
 await assert.rejects(client.request('https://example.org/works'),/only be sent to OpenAlex/);assert.equal(calls,0);
 await assert.rejects(client.request(url),error=>error.code==='authentication'&&/verification email/.test(error.message)&&!error.message.includes('secret'));
 assert.throws(()=>client.setKey('two words'),/spaces/);
 const invalid=createOpenAlexClient({fetcher:async()=>response(401)});
 await assert.rejects(invalid.request(url),error=>error.code==='authentication'&&/rejected/.test(error.message));
});

test('canceling a paced request aborts its wait without fetching again',async()=>{
 let calls=0;const controller=new AbortController();
 const client=createOpenAlexClient({minInterval:10000,fetcher:async()=>{calls++;return response(200)}});
 await client.request(url);
 const pending=client.request(url+'&page=2',controller.signal);controller.abort();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,1);
 await assert.rejects(client.request(url,controller.signal),{name:'AbortError'});
});
