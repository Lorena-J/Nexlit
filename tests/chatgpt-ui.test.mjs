import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const tick = () => new Promise(resolve => setImmediate(resolve));
const page = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../dist/chatgpt-ui.js', import.meta.url), 'utf8').replace('export function', 'function');

async function fixture(initial = {}, {blocked = false, connectError = false} = {}) {
  const elements = new Map();
  for (const match of page.matchAll(/id="([^"]+)"/g)) {
    elements.set('#' + match[1], {
      open: false, disabled: false, handlers: {}, children: [],
      addEventListener(type, handler) { this.handlers[type] = handler; },
      setAttribute() {}, replaceChildren() { this.children = []; },
      append(child) { this.children.push(child); },
      showModal() { this.open = true; },
      close() { this.open = false; this.handlers.close?.(); }
    });
  }
  let session = {available: true, signedIn: false, planGranted: false, ...initial};
  const calls = [], popups = [], timers = new Map(); let timerId = 0;
  const context = vm.createContext({
    document: {querySelector: s => elements.get(s), createElement: () => ({})},
    AbortSignal,
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    window: {open() {
      if (blocked) return null;
      const popup = {location: {}, close() { this.closed = true; }};
      popups.push(popup); return popup;
    }},
    fetch: async path => {
      const route = path.split('/').at(-1); calls.push(route);
      if (route === 'connect' && connectError) return {ok: false, json: async () => ({error: 'Sign-in unavailable.'})};
      if (route === 'connect') session = {...session, pending: true};
      if (route === 'welcome') session = {...session, welcomeSeen: true};
      if (route === 'cancel') session = {...session, pending: false};
      const body = route === 'status' ? {...session} : route === 'models' ? {models: [{id: 'test-model', name: 'Test model'}]} : route === 'connect' ? {url: 'https://auth.openai.com/test-login'} : {ok: true};
      return {ok: true, json: async () => body};
    }
  });
  const controller = vm.runInContext(source + '\nsetupChatGPT();', context);
  await tick();
  return {controller, elements, calls, popups,
    setSession(value) { session = {...session, ...value}; },
    async poll() { const [id, fn] = timers.entries().next().value; timers.delete(id); await fn(); }
  };
}

test('search sign-in opens ChatGPT once and waits for login and the plan notice', async () => {
  const f = await fixture();
  let completed = false;
  const pending = f.controller.ensureConnected(); pending.then(() => completed = true);
  assert.equal(f.controller.ensureConnected(), pending);
  await tick();
  assert.equal(f.popups.length, 1);
  assert.equal(f.popups[0].location.href, 'https://auth.openai.com/test-login');
  assert.equal(completed, false);
  f.setSession({signedIn: true, planGranted: true, pending: false, welcomeSeen: false});
  await f.poll();
  assert.equal(completed, false);
  await f.elements.get('#chatgptWelcomeDone').onclick();
  assert.equal(await pending, true);
  assert.equal(f.elements.get('#chatgptDialog').open, false);
  assert.equal(await f.controller.ensureConnected(), true);
  assert.equal(f.popups.length, 1);
});

test('an existing connected session searches without another popup', async () => {
  const f = await fixture({signedIn: true, planGranted: true, welcomeSeen: true});
  assert.equal(await f.controller.ensureConnected(), true);
  assert.equal(f.popups.length, 0);
  assert.equal(f.elements.get('#chatgptDialog').open, false);
});

test('an already pending login resumes polling without opening a second tab', async () => {
  const f = await fixture({pending: true});
  const pending = f.controller.ensureConnected(); await tick();
  assert.equal(f.popups.length, 0);
  f.setSession({signedIn: true, planGranted: true, pending: false, welcomeSeen: true});
  await f.poll();
  assert.equal(await pending, true);
});

test('closing or canceling sign-in stops the waiting search', async () => {
  for (const cancel of [false, true]) {
    const f = await fixture(); const pending = f.controller.ensureConnected();
    await tick();
    if (cancel) await f.elements.get('#chatgptCancel').onclick();
    else f.elements.get('#chatgptClose').onclick();
    assert.equal(await pending, false);
  }
});

test('blocked popups and failed sign-in do not leave search waiting', async () => {
  for (const options of [{blocked: true}, {connectError: true}]) {
    const f = await fixture({}, options);
    assert.equal(await f.controller.ensureConnected(), false);
    assert(f.elements.get('#chatgptStatus').textContent);
  }
});
