export function setupChatGPT({onChange = () => {}} = {}) {
  const $ = s => document.querySelector(s), dialog = $('#chatgptDialog');
  let status = {available: false, signedIn: false, planGranted: false}, models = [], model = '', timer, polling = false, refreshing = false;
  const listeners = new Set();
  const message = text => { $('#chatgptStatus').textContent = text; };
  async function api(path, body, signal) {
    const response = await fetch('/api/chatgpt/' + path, {method: body === undefined ? 'GET' : 'POST', headers: {'X-Nexlit-Request': '1', ...(body === undefined ? {} : {'Content-Type': 'application/json'})}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: signal || AbortSignal.timeout(35_000)});
    let data;
    try { data = await response.json(); } catch { throw Error('Start Nexlit with npm start to connect ChatGPT.'); }
    if (!response.ok) throw Object.assign(Error(data.error || 'Could not contact ChatGPT.'), {code: data.code});
    return data;
  }
  function render() {
    for (const selector of ['#chatgptOpen', '#chatgptHeaderOpen']) {
      const button = $(selector);
      button.textContent = status.planGranted ? 'ChatGPT connected' : 'Connect ChatGPT';
      button.setAttribute('aria-label', status.planGranted ? 'ChatGPT connected. Open connection settings' : 'Connect ChatGPT');
    }
    $('#chatgptConnect').hidden = !status.available || status.pending;
    $('#chatgptConnect').textContent = status.signedIn ? 'Reconnect with ChatGPT' : 'Continue with ChatGPT';
    $('#chatgptCancel').hidden = !status.pending;
    $('#chatgptDisconnect').hidden = !status.signedIn;
    $('#chatgptModelSection').hidden = !status.planGranted;
    $('#chatgptAccount').textContent = status.signedIn ? `Signed in${status.email ? ' as ' + status.email : ''}.` : '';
    $('#chatgptPlanNotice').hidden = !status.planGranted || status.welcomeSeen;
    $('#chatgptModel').disabled = !models.length;
    onChange();
    for (const listener of listeners) listener();
  }
  async function loadModels() {
    models = []; $('#chatgptModel').replaceChildren(); render();
    const data = await api('models'); models = data.models;
    if (!models.some(m => m.id === model)) model = models[0]?.id || '';
    for (const item of models) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; $('#chatgptModel').append(option); }
    $('#chatgptModel').value = model; render();
    if (!models.length) throw Error('Your account does not currently offer any models. Review Manage usage or reconnect.');
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const previous = status; status = await api('status');
      if (!status.available) throw Error('Local service unavailable.');
      render();
      if (status.pending) message('Finish signing in in the new tab. You can return here afterwards.');
      else if (status.loginError) message(status.loginError);
      else if (status.planGranted) message('ChatGPT is connected. Manage your account and plan settings here.');
      else if (status.signedIn) message('Plan usage was not granted. Reconnect with ChatGPT and allow plan usage.');
      else message('Connect your ChatGPT account and allow access to your plan.');
      if (status.planGranted && !status.pending && (!previous.planGranted || previous.email !== status.email || !models.length)) await loadModels();
      if (!status.planGranted) { models = []; model = ''; render(); }
    } catch (e) {
      if (!status.available) { status = {available: false}; render(); message('To connect ChatGPT, start Nexlit with npm start and open the local address.'); }
      else message(e.message);
    } finally {
      refreshing = false;
      if (polling && status.pending) timer = setTimeout(refresh, 1500);
      else polling = false;
    }
  }
  $('#chatgptOpen').onclick = $('#chatgptHeaderOpen').onclick = () => { dialog.showModal(); void refresh(); };
  dialog.addEventListener('click', event => { if (event.target === dialog && !event.target.closest('.chatgpt-dialog > *')) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  $('#chatgptClose').onclick = () => dialog.close();
  $('#chatgptConnect').onclick = async () => {
    // Open synchronously to avoid popup blockers while the local request runs.
    const popup = window.open('about:blank', '_blank');
    if (!popup) { message('Allow popups for Nexlit, then try connecting again.'); return; }
    popup.opener = null;
    $('#chatgptConnect').disabled = true;
    try {
      const data = await api('connect', {});
      popup.location.href = data.url;
      status.pending = true; render(); message('Finish signing in in the new tab.');
      clearTimeout(timer); polling = true; timer = setTimeout(refresh, 1500);
    } catch (e) { popup.close(); message(e.message); }
    finally { $('#chatgptConnect').disabled = false; }
  };
  $('#chatgptCancel').onclick = async () => {
    try { await api('cancel', {}); clearTimeout(timer); polling = false; await refresh(); }
    catch (e) { message(e.message); }
  };
  $('#chatgptDisconnect').onclick = async () => {
    $('#chatgptDisconnect').disabled = true;
    try {
      const data = await api('disconnect', {}); models = []; model = ''; clearTimeout(timer); polling = false;
      await refresh();
      if (!data.revoked) message('Disconnected locally. Revocation could not be confirmed; disconnect Nexlit in ChatGPT settings too.');
    } catch (e) { message(e.message); }
    finally { $('#chatgptDisconnect').disabled = false; }
  };
  $('#chatgptWelcomeDone').onclick = async () => {
    try { await api('welcome', {}); status.welcomeSeen = true; render(); } catch (e) { message(e.message); }
  };
  $('#chatgptModel').onchange = () => { model = $('#chatgptModel').value; render(); };
  $('#chatgptRefreshModels').onclick = async () => {
    $('#chatgptRefreshModels').disabled = true;
    try { await loadModels(); message('Model list refreshed. Using ChatGPT plan.'); } catch (e) { message(e.message); }
    finally { $('#chatgptRefreshModels').disabled = false; }
  };
  void refresh();
  return {
    enabled: () => !!status.planGranted,
    model: () => model,
    models: () => models,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    selectModel: value => { if (models.some(m=>m.id===value)) { model=value; $('#chatgptModel').value=value; render(); } },
    async summarize(paper, signal) {
      if (!model) throw Error('Choose an available model in ChatGPT settings first.');
      return api('summarize', {title: paper.title, abstract: paper.abstract, model}, signal);
    }
  };
}
