import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {mkdir, open, readFile, unlink} from 'node:fs/promises';
import {Session} from './session.mjs';
import {Provider} from './provider.mjs';
import {createAppServer} from './http.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(process.env.NEXLIT_DATA_DIR || join(root, '.local'));
const publicDirectory = join(root, 'dist');
if (directory === publicDirectory || directory.startsWith(publicDirectory + '/')) throw new Error('NEXLIT_DATA_DIR must be outside dist/ so private files cannot be served.');
const port = Number(process.env.PORT || 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
await mkdir(directory, {recursive: true, mode: 0o700});
const lockPath = join(directory, 'server.lock');
let lock;
try { lock = await open(lockPath, 'wx', 0o600); }
catch (e) {
  if (e.code !== 'EEXIST') throw e;
  const pid = Number(await readFile(lockPath, 'utf8'));
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid local server lock. Check .local/server.lock.');
  try { process.kill(pid, 0); throw new Error('Nexlit is already running with this data directory.'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
  await unlink(lockPath); lock = await open(lockPath, 'wx', 0o600);
}
await lock.writeFile(String(process.pid)); await lock.close();
try {
  const session = await new Session({directory}).init();
  const server = createAppServer({session, provider: new Provider(session), dist: join(root, 'dist')});
  const stop = async () => { server.closeAllConnections(); server.close(); await unlink(lockPath).catch(() => {}); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  console.log(`Nexlit is ready at http://localhost:${port}\nOpen Connect ChatGPT to connect your account.`);
} catch (e) { await unlink(lockPath).catch(() => {}); throw e; }
