import {randomBytes, randomUUID, createHash, createPublicKey, verify, createCipheriv, createDecipheriv, timingSafeEqual} from 'node:crypto';
import {mkdir, readFile, writeFile, rename, chmod, unlink} from 'node:fs/promises';
import {join} from 'node:path';

// The same public-client plan-usage flow used in Refract. No Codex dependency.
export const ISSUER = 'https://auth.openai.com';
export const RESOURCE = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const TERMINAL = new Set(['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused','invalid_client']);
const random = () => randomBytes(32).toString('base64url');
const equal = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export class AppError extends Error {
  constructor(message, status = 400, code = 'request_failed') { super(message); this.status = status; this.code = code; }
}

export async function atomicWrite(path, data) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, data, {mode: 0o600, flag: 'wx'});
    await rename(temp, path);
    await chmod(path, 0o600);
  } finally { await unlink(temp).catch(() => {}); }
}

export class Session {
  constructor({directory, fetcher = fetch, now = Date.now} = {}) {
    this.directory = directory; this.fetcher = fetcher; this.now = now;
    this.queue = Promise.resolve(); this.pending = null; this.loginError = ''; this.epoch = 0; this.welcomedSubjects = [];
  }
  async init() {
    await mkdir(this.directory, {recursive: true, mode: 0o700});
    await chmod(this.directory, 0o700);
    const keyPath = join(this.directory, 'secret.key');
    try { this.key = await readFile(keyPath); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Never silently replace a key belonging to existing encrypted credentials.
      try { await readFile(join(this.directory, 'credentials.json')); throw new Error('Missing secret.key for saved credentials. Restore the key or move the local data directory before starting again.'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
      this.key = randomBytes(32); await writeFile(keyPath, this.key, {mode: 0o600, flag: 'wx'});
    }
    if (this.key.length !== 32) throw new Error('Invalid local credential encryption key.');
    await chmod(keyPath, 0o600);
    const hostPath = join(this.directory, 'host-id');
    try { this.hostID = (await readFile(hostPath, 'utf8')).trim(); }
    catch (e) { if (e.code !== 'ENOENT') throw e; this.hostID = `urn:uuid:${randomUUID()}`; await atomicWrite(hostPath, this.hostID); }
    this.credentials = await this.load();
    return this;
  }
  async load() {
    let raw;
    try { raw = JSON.parse(await readFile(join(this.directory, 'credentials.json'), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(raw.iv, 'base64'));
    decipher.setAAD(Buffer.from('nexlit-chatgpt-v1'));
    decipher.setAuthTag(Buffer.from(raw.tag, 'base64'));
    const saved = JSON.parse(Buffer.concat([decipher.update(Buffer.from(raw.data, 'base64')), decipher.final()]).toString());
    if (saved?.format === 2) { this.welcomedSubjects = saved.welcomedSubjects || []; return saved.credentials; }
    if (saved?.welcomeSeen && saved.sub) this.welcomedSubjects = [saved.sub];
    return saved;
  }
  async save(credentials) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from('nexlit-chatgpt-v1'));
    const data = Buffer.concat([cipher.update(JSON.stringify({format: 2, credentials, welcomedSubjects: this.welcomedSubjects})), cipher.final()]);
    await atomicWrite(join(this.directory, 'credentials.json'), JSON.stringify({version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64')}));
    this.credentials = credentials;
  }
  locked(work) {
    const next = this.queue.then(work); this.queue = next.catch(() => {}); return next;
  }
  status() {
    const c = this.credentials;
    if (this.pending && this.pending.expires <= this.now()) { this.pending = null; this.loginError = 'Sign-in timed out. Please try again.'; }
    return {available: true, signedIn: !!c?.refresh_token, planGranted: !!c?.refresh_token && (c.scope || '').split(' ').includes('chatgpt.tokens.use.direct'), email: c?.email || '', pending: !!this.pending, loginError: this.loginError, welcomeSeen: !!c?.welcomeSeen};
  }
  startLogin(origin, fresh = false) {
    const saved = fresh ? null : this.credentials;
    const p = {state: random(), nonce: random(), verifier: random(), redirect: `${origin}/auth/callback`, expires: this.now() + 10 * 60_000, clientID: saved?.client_id, subject: saved?.sub, epoch: ++this.epoch};
    this.pending = p; this.loginError = '';
    const url = new URL(`${ISSUER}/api/accounts/authorize`);
    const params = {response_type: 'code', client_id: p.clientID || 'dynamic_agent_client', redirect_uri: p.redirect, scope: SCOPES, resource: RESOURCE, state: p.state, nonce: p.nonce, code_challenge: createHash('sha256').update(p.verifier).digest('base64url'), code_challenge_method: 'S256', ext_agent_host_id: this.hostID};
    if (!p.clientID) params.agent_name_hint = 'Nexlit';
    else { if (saved.id_token) params.id_token_hint = saved.id_token; if (saved.email) params.login_hint = saved.email; }
    url.search = new URLSearchParams(params).toString();
    return url.href;
  }
  cancelLogin() { this.epoch++; this.pending = null; this.loginError = ''; }
  async tokenRequest(params) {
    let response;
    try { response = await this.fetcher(`${ISSUER}/api/accounts/oauth/token`, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({...params, resource: RESOURCE}), signal: AbortSignal.timeout(30_000)}); }
    catch { throw new AppError('Could not reach ChatGPT. Please try again.', 502); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = typeof body.error === 'string' ? body.error : body.error?.code;
      throw new AppError(TERMINAL.has(code) ? 'Your ChatGPT session ended. Connect again.' : 'ChatGPT sign-in is temporarily unavailable. Please try again.', response.status, code);
    }
    if (typeof body.access_token !== 'string' || !Number.isFinite(body.expires_in) || body.expires_in <= 0) throw new AppError('ChatGPT returned an incomplete sign-in response.', 502);
    return body;
  }
  async verifyIdentity(token, clientID, nonce) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw Error();
      const [h, payload, signature] = parts, header = JSON.parse(Buffer.from(h, 'base64url')), claims = JSON.parse(Buffer.from(payload, 'base64url'));
      if (header.alg !== 'RS256') throw Error();
      const response = await this.fetcher(`${ISSUER}/.well-known/jwks.json`, {signal: AbortSignal.timeout(15_000)});
      if (!response.ok) throw Error();
      const {keys} = await response.json();
      const jwk = keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig'));
      if (!jwk || !verify('RSA-SHA256', Buffer.from(`${h}.${payload}`), createPublicKey({key: jwk, format: 'jwk'}), Buffer.from(signature, 'base64url'))) throw Error();
      const now = this.now() / 1000;
      if (claims.iss !== ISSUER || !(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(clientID) || typeof claims.exp !== 'number' || claims.exp <= now || (claims.nbf && claims.nbf > now + 30) || !equal(claims.nonce, nonce) || typeof claims.sub !== 'string' || !claims.sub) throw Error();
      return claims;
    } catch { throw new AppError('Could not validate the ChatGPT sign-in. Please reconnect.', 400); }
  }
  applyTokens(old, next) {
    return {...old, access_token: next.access_token, refresh_token: next.refresh_token || old.refresh_token, id_token: next.id_token || old.id_token, scope: next.scope ?? old.scope, expires_at: this.now() + next.expires_in * 1000, earliest_refresh_at: typeof next.earliest_refresh_at === 'number' ? next.earliest_refresh_at * 1000 : Date.parse(next.earliest_refresh_at) || 0};
  }
  async finishLogin(params) {
    const p = this.pending;
    if (!p || p.used || p.expires <= this.now() || !equal(params.get('state'), p.state)) throw new AppError('Sign-in expired or did not match this browser. Please try again.');
    p.used = true;
    return this.locked(async () => {
      try {
        if (params.has('error')) throw new AppError('ChatGPT sign-in was cancelled or denied.');
        const clientID = params.get('client_id') || p.clientID;
        if (!clientID || clientID === 'dynamic_agent_client' || (p.clientID && clientID !== p.clientID) || !params.get('code')) throw new AppError('ChatGPT registration was incomplete. Please reconnect.');
        const tokens = await this.tokenRequest({grant_type: 'authorization_code', client_id: clientID, code: params.get('code'), code_verifier: p.verifier, redirect_uri: p.redirect});
        const identity = await this.verifyIdentity(tokens.id_token, clientID, p.nonce);
        if (p.subject && identity.sub !== p.subject) throw new AppError('A different account was selected. Disconnect before switching accounts.');
        if (!tokens.refresh_token) throw new AppError('ChatGPT did not grant offline access. Please reconnect.');
        if (this.epoch !== p.epoch) throw new AppError('This sign-in was cancelled.');
        await this.save(this.applyTokens({client_id: clientID, sub: identity.sub, email: identity.email || '', welcomeSeen: this.welcomedSubjects.includes(identity.sub)}, tokens));
      } catch (e) { if (this.epoch === p.epoch) this.loginError = e instanceof AppError ? e.message : 'Could not save the ChatGPT session.'; throw e; }
      finally { if (this.pending === p) this.pending = null; }
    });
  }
  async accessToken(force = false, rejectedToken) {
    return this.locked(async () => {
      const c = this.credentials;
      if (!this.status().planGranted) throw new AppError(c?.refresh_token ? 'ChatGPT plan usage was not granted. Reconnect and allow plan usage.' : 'Connect ChatGPT first.', 401, 'not_connected');
      // Concurrent 401s must not rotate the same refresh token repeatedly.
      if (force && rejectedToken && c.access_token !== rejectedToken) return c.access_token;
      const now = this.now();
      if (!force && (c.expires_at > now + 300_000 || (c.earliest_refresh_at > now && c.expires_at > now))) return c.access_token;
      try {
        const next = await this.tokenRequest({grant_type: 'refresh_token', client_id: c.client_id, refresh_token: c.refresh_token});
        await this.save(this.applyTokens(c, next));
        return this.credentials.access_token;
      } catch (e) {
        if (TERMINAL.has(e.code)) await this.save({...c, access_token: '', refresh_token: '', id_token: ''});
        throw e;
      }
    });
  }
  async welcome() {
    await this.locked(async () => {
      if (!this.credentials) return;
      if (!this.welcomedSubjects.includes(this.credentials.sub)) this.welcomedSubjects.push(this.credentials.sub);
      await this.save({...this.credentials, welcomeSeen: true});
    });
  }
  async disconnect() {
    this.cancelLogin();
    return this.locked(async () => {
      const c = this.credentials;
      // Clear locally even if revocation cannot be confirmed.
      await this.save(null);
      if (!c?.refresh_token) return {revoked: true};
      try {
        const r = await this.fetcher(`${ISSUER}/api/accounts/oauth/revoke`, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({token: c.refresh_token, token_type_hint: 'refresh_token', client_id: c.client_id}), signal: AbortSignal.timeout(15_000)});
        return {revoked: r.ok};
      } catch { return {revoked: false}; }
    });
  }
}
