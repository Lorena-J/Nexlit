import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {AppError} from './session.mjs';

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.bib':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
function json(res, status, body) { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); }
async function readJSON(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError('Expected JSON.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 400_000) throw new AppError('Request too large.', 413); chunks.push(chunk); }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks)); } catch { throw new AppError('Invalid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('Expected a JSON object.');
  return value;
}

export function createAppServer({session, provider, dist}) {
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
    try {
      const port = server.address().port;
      const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      if (!allowedHosts.has(req.headers.host)) throw new AppError('Local requests only.', 403);
      const origin = `http://${req.headers.host}`, url = new URL(req.url, origin);
      if (url.pathname.startsWith('/api/')) {
        if (req.headers['x-nexlit-request'] !== '1' || (req.headers.origin && req.headers.origin !== origin) || (req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site']))) throw new AppError('Open Nexlit locally to use ChatGPT.', 403);
        const route = `${req.method} ${url.pathname}`;
        if (route === 'GET /api/chatgpt/status') return json(res, 200, session.status());
        if (route === 'POST /api/chatgpt/connect') { const input = await readJSON(req); return json(res, 200, {url: session.startLogin(`http://127.0.0.1:${port}`, !!input.fresh)}); }
        if (route === 'POST /api/chatgpt/cancel') { session.cancelLogin(); return json(res, 200, {ok: true}); }
        if (route === 'POST /api/chatgpt/welcome') { await session.welcome(); return json(res, 200, {ok: true}); }
        if (route === 'POST /api/chatgpt/disconnect') return json(res, 200, await session.disconnect());
        if (route === 'GET /api/chatgpt/models') return json(res, 200, {models: await provider.models()});
        if (route === 'POST /api/chatgpt/summarize') {
          const input = await readJSON(req), controller = new AbortController();
          res.on('close', () => controller.abort());
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]);
          return json(res, 200, await provider.summarize(input, signal));
        }
        throw new AppError('Not found.', 404);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new AppError('Method not allowed.', 405);
      if (url.pathname === '/auth/callback') {
        let message = 'Connected. You can close this tab and return to Nexlit.', status = 200;
        try { await session.finishLogin(url.searchParams); if (!session.status().planGranted) message = 'Signed in, but ChatGPT plan usage was not granted. Return to Nexlit and reconnect to allow it.'; }
        catch (e) { status = 400; message = e instanceof AppError ? e.message : 'Could not complete sign-in. Return to Nexlit and try again.'; }
        res.writeHead(status, {'Content-Type': 'text/html; charset=utf-8'});
        return res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Nexlit · ChatGPT</title><body><h1>Nexlit</h1><p>${message.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</p></body></html>`);
      }
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.split('/').some(part => part.startsWith('.')) || pathname.includes('\\')) throw new AppError('Not found.', 404);
      const root = resolve(dist), path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(root + sep)) throw new AppError('Not found.', 404);
      const content = await readFile(path).catch(() => { throw new AppError('Not found.', 404); });
      res.writeHead(200, {'Content-Type': mime[extname(path)] || 'application/octet-stream'});
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (e) {
      if (res.destroyed) return;
      json(res, e instanceof AppError ? e.status : 500, {error: e instanceof AppError ? e.message : 'Nexlit could not complete the request.', code: e.code && e instanceof AppError ? e.code : 'server_error'});
    }
  });
  server.requestTimeout = 150_000;
  server.headersTimeout = 15_000;
  return server;
}
