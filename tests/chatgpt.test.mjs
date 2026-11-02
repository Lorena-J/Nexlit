import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {get} from 'node:http';
import {generateKeyPairSync, sign} from 'node:crypto';
import {Session, ISSUER} from '../server/session.mjs';
import {Provider, readSummaryStream} from '../server/provider.mjs';
import {createAppServer} from '../server/http.mjs';

const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = {...publicKey.export({format: 'jwk'}), kid: 'test-key', use: 'sig'};
function jwt(claims) {
  const h = Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url');
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${h}.${p}.${sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}`;
}
const response = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json'}});
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'nexlit-chatgpt-'));
  t.after(() => rm(directory, {recursive:true, force:true}));
  const session = await new Session({directory, ...options}).init();
  return {session, directory};
}
const credentials = {client_id:'test-client',sub:'test-user',email:'reader@example.test',access_token:'private-access',refresh_token:'private-refresh',id_token:'private-id',scope:'openid chatgpt.tokens.use.direct',expires_at:Date.now()+3_600_000};

test('OAuth uses PKCE and a stable host; signed identity and granted scopes determine the session', async t => {
  let auth, form;
  const {session,directory} = await fixture(t, {fetcher:async (url, options) => {
    if (url.endsWith('jwks.json')) return response({keys:[jwk]});
    form = options.body;
    return response({access_token:'new-access',refresh_token:'new-refresh',scope:'openid chatgpt.tokens.use.direct',expires_in:3600,id_token:jwt({iss:ISSUER,aud:'issued-client',sub:'verified-user',email:'reader@example.test',nonce:auth.searchParams.get('nonce'),exp:Date.now()/1000+600})});
  }});
  auth = new URL(session.startLogin('http://127.0.0.1:8000'));
  assert.equal(auth.searchParams.get('client_id'),'dynamic_agent_client');
  assert.equal(auth.searchParams.get('agent_name_hint'),'Nexlit');
  assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
  const callback = new URLSearchParams({code:'test-code',state:auth.searchParams.get('state'),client_id:'issued-client'});
  await assert.rejects(session.finishLogin(new URLSearchParams({...Object.fromEntries(callback),state:'wrong'})),/did not match/);
  await session.finishLogin(callback);
  assert.equal(form.get('redirect_uri'),'http://127.0.0.1:8000/auth/callback');
  assert.equal(form.get('client_id'),'issued-client');
  assert(form.get('code_verifier'));
  assert.equal(session.status().planGranted,true);
  assert(!JSON.stringify(session.status()).includes('new-access'));
  const saved = await readFile(join(directory,'credentials.json'),'utf8');
  assert(!saved.includes('new-access') && !saved.includes('new-refresh') && !saved.includes('reader@example.test'));
  assert.equal((await stat(join(directory,'credentials.json'))).mode & 0o777,0o600);
  const restored = await new Session({directory}).init();
  assert.equal(restored.hostID,session.hostID);
  assert.equal(restored.credentials.access_token,'new-access');
  assert.equal(new URL(restored.startLogin('http://127.0.0.1:8000')).searchParams.get('client_id'),'issued-client');
  await session.welcome();
  await session.disconnect();
  const reopened = await new Session({directory,fetcher:session.fetcher}).init();
  assert.equal(reopened.status().signedIn,false);
  auth = new URL(reopened.startLogin('http://127.0.0.1:8000'));
  await reopened.finishLogin(new URLSearchParams({code:'new-code',state:auth.searchParams.get('state'),client_id:'issued-client'}));
  assert.equal(reopened.status().welcomeSeen,true,'First-use acknowledgement survives sign-out and restart');
});

test('ID token rejects forged signatures, wrong issuer/audience/nonce and expiry', async t => {
  const {session} = await fixture(t,{fetcher:async()=>response({keys:[jwk]})});
  const claims = {iss:ISSUER,aud:'client',sub:'reader',nonce:'nonce',exp:Date.now()/1000+600};
  assert.equal((await session.verifyIdentity(jwt(claims),'client','nonce')).sub,'reader');
  for (const change of [{iss:'https://fake.test'},{aud:'other'},{nonce:'wrong'},{exp:0}]) await assert.rejects(session.verifyIdentity(jwt({...claims,...change}),'client','nonce'),/validate/);
  const parts=jwt(claims).split('.');parts[1]=Buffer.from(JSON.stringify({...claims,sub:'forged'})).toString('base64url');
  await assert.rejects(session.verifyIdentity(parts.join('.'),'client','nonce'),/validate/);
});

test('parallel refreshes rotate once, persist before reuse, and retain transient failures', async t => {
  let refreshes=0;
  const {session,directory}=await fixture(t,{fetcher:async()=>{
    refreshes++;await new Promise(resolve=>setTimeout(resolve,10));
    return response({access_token:'rotated-access',refresh_token:'rotated-refresh',expires_in:3600});
  }});
  await session.save({...credentials,expires_at:0});
  assert.deepEqual(await Promise.all([session.accessToken(),session.accessToken(),session.accessToken()]),Array(3).fill('rotated-access'));
  assert.equal(refreshes,1);
  await Promise.all([session.accessToken(true,'private-access'),session.accessToken(true,'private-access')]);
  assert.equal(refreshes,1);
  assert.equal((await new Session({directory}).init()).credentials.refresh_token,'rotated-refresh');
  session.fetcher=async()=>response({error:'temporarily_unavailable'},503);
  await assert.rejects(session.accessToken(true));assert.equal(session.credentials.refresh_token,'rotated-refresh');
  session.fetcher=async()=>response({error:'invalid_grant'},400);
  await assert.rejects(session.accessToken(true));assert.equal(session.status().signedIn,false);
});

test('missing plan permission blocks calls; disconnect clears tokens even if revocation fails', async t => {
  const {session}=await fixture(t,{fetcher:async()=>{throw Error('network offline')}});
  await session.save({...credentials,scope:'openid'});
  await assert.rejects(session.accessToken(),/not granted/);
  assert.deepEqual(await session.disconnect(),{revoked:false});
  assert.equal(session.status().signedIn,false);assert.equal(session.credentials,null);
});

test('cancelled sign-in cannot be replayed, including a callback exchanging tokens', async t => {
  let release;
  const waiting=new Promise(resolve=>release=resolve);
  let auth;
  const {session}=await fixture(t,{fetcher:async url=>{
    if(url.endsWith('jwks.json'))return response({keys:[jwk]});
    await waiting;
    return response({access_token:'new',refresh_token:'new',expires_in:3600,scope:'chatgpt.tokens.use.direct',id_token:jwt({iss:ISSUER,aud:'client',sub:'reader',nonce:auth.searchParams.get('nonce'),exp:Date.now()/1000+600})});
  }});
  auth=new URL(session.startLogin('http://127.0.0.1:8000'));
  const params=new URLSearchParams({state:auth.searchParams.get('state'),client_id:'client',code:'code'});
  const finish=session.finishLogin(params);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(session.status().pending,true);
  session.cancelLogin();release();
  await assert.rejects(finish,/cancelled/);assert.equal(session.credentials,null);
  await assert.rejects(session.finishLogin(params),/expired/);
});

const frames=events=>events.map(event=>'data: '+JSON.stringify(event)+'\r\n\r\n').join('');
function stream(text, chunkSize=7){return new ReadableStream({start(controller){const bytes=new TextEncoder().encode(text);for(let i=0;i<bytes.length;i+=chunkSize)controller.enqueue(bytes.slice(i,i+chunkSize));controller.close()}})}
test('SSE supports split UTF-8 and frames; errors, limits and truncated responses never succeed',async()=>{
  const events=[{type:'response.output_text.delta',delta:'Células 🧠'},{type:'response.completed'}];
  assert.equal(await readSummaryStream(stream(frames(events),1)),'Células 🧠');
  await assert.rejects(readSummaryStream(stream(frames(events.slice(0,1)))),/before completing/);
  await assert.rejects(readSummaryStream(stream(frames([{type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded'}}}]))),/usage limit/);
  await assert.rejects(readSummaryStream(stream(frames([{type:'response.incomplete'}]))),/before completing/);
});

test('provider uses the account catalog and stateless streaming Responses; retries 401 once',async()=>{
  const calls=[], refresh=[];
  const provider=new Provider({accessToken:async(force,old)=>{refresh.push([force,old]);return force?'renewed':'first'}},{fetcher:async(url,options)=>{
    calls.push({url,options});
    if(calls.length===1)return response({},401);
    if(url.endsWith('/models'))return response({models:[{visibility:'hidden',slug:'hidden'},{visibility:'list',slug:'account-model',display_name:'Account model'}]});
    return new Response(stream(frames([{type:'response.output_text.delta',delta:'Supported finding.'},{type:'response.completed'}])));
  }});
  assert.deepEqual(await provider.summarize({title:'Paper',abstract:'Evidence in abstract.',model:'account-model'},AbortSignal.timeout(1000)),{text:'Supported finding.',model:'account-model'});
  assert.deepEqual(refresh[1],[true,'first']);
  const body=JSON.parse(calls.at(-1).options.body);
  assert.equal(body.store,false);assert.equal(body.stream,true);assert(Array.isArray(body.input));
  assert.equal(body.model,'account-model');assert(!('temperature'in body));
  assert(!('max_output_tokens'in body));
  await assert.rejects(provider.summarize({title:'Paper',abstract:'Evidence',model:'hidden'}),/no longer available/);
});

test('HTTP restricts local Host, cross-origin requests, credential paths and leaks',async t=>{
  const {session}=await fixture(t);await session.save(credentials);
  const server=createAppServer({session,provider:{models:async()=>[],summarize:async()=>({text:'ok'})},dist:new URL('../dist',import.meta.url).pathname});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close()});
  const origin=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin+'/api/chatgpt/status')).status,403);
  assert.equal((await fetch(origin+'/api/chatgpt/status',{headers:{'X-Nexlit-Request':'1',Origin:'https://evil.test'}})).status,403);
  const badHostStatus=await new Promise((resolve,reject)=>get(origin+'/',{headers:{Host:'evil.test'}},res=>{res.resume();resolve(res.statusCode)}).on('error',reject));
  assert.equal(badHostStatus,403);
  const result=await fetch(origin+'/api/chatgpt/status',{headers:{'X-Nexlit-Request':'1'}}),raw=await result.text();
  assert.equal(result.status,200);assert(!raw.includes('private-'));assert(!raw.includes('client_id'));
  for(const path of ['/.local/credentials.json','/server/session.mjs','/%2e%2e%2f.local/secret.key'])assert.equal((await fetch(origin+path)).status,404);
  assert.equal((await fetch(origin+'/')).status,200);
  assert.equal((await fetch(origin+'/api/chatgpt/connect',{method:'POST',headers:{'X-Nexlit-Request':'1','Content-Type':'application/json'},body:'{invalid'})).status,400);
  const r=await fetch(origin+'/api/chatgpt/connect',{method:'POST',headers:{'X-Nexlit-Request':'1','Content-Type':'application/json'},body:'{}'});
  const auth=new URL((await r.json()).url);assert.equal(auth.origin,ISSUER);assert.equal(auth.searchParams.get('redirect_uri'),origin+'/auth/callback');
});
