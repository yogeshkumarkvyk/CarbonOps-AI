/* Browser-side Supabase client. RLS is the security boundary; this key is public. */
(function (G) {
  'use strict';
  const c = G.CARBONOPS_CONFIG || {};
  const ready = !!(G.supabase && c.supabaseUrl && c.supabaseAnonKey &&
    !/YOUR_PROJECT|YOUR_SUPABASE/.test(c.supabaseUrl + c.supabaseAnonKey));
  const client = ready ? G.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;

  async function token() {
    if (!client) throw new Error('Cloud services are not configured yet.');
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw new Error('Please sign in again.');
    return data.session.access_token;
  }
  async function loadWorkspace(userId) {
    if (!client) return null;
    const { data, error } = await client.from('carbonops_workspaces')
      .select('state').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    const state = data && data.state ? data.state : null;
    if (!state || !state.factories) return state;
    await Promise.all(Object.values(state.factories).map(async (factory) => {
      const image = factory.blueprint && factory.blueprint.img;
      if (!image || !image.startsWith('__CARBONOPS_STORAGE__:')) return;
      const path = image.slice('__CARBONOPS_STORAGE__:'.length);
      const { data: blob, error: downloadError } = await client.storage.from('carbonops-assets').download(path);
      if (downloadError) throw downloadError;
      factory.blueprint.img = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
      });
    }));
    return state;
  }
  let saveQueue = Promise.resolve();
  function saveWorkspace(userId, state) {
    if (!client) return Promise.resolve();
    const snapshot = JSON.parse(JSON.stringify(state));
    const task = saveQueue.catch(() => {}).then(() => persistWorkspace(userId, snapshot));
    saveQueue = task;
    return task;
  }
  async function persistWorkspace(userId, cloudState) {
    await Promise.all(Object.entries(cloudState.factories || {}).map(async ([factoryId, factory]) => {
      const image = factory.blueprint && factory.blueprint.img;
      if (!image || !image.startsWith('data:')) return;
      const path = userId + '/floorplan-' + factoryId;
      const blob = await (await fetch(image)).blob();
      const { error: uploadError } = await client.storage.from('carbonops-assets').upload(path, blob, { upsert: true, contentType: blob.type || 'image/png' });
      if (uploadError) throw uploadError;
      factory.blueprint.img = '__CARBONOPS_STORAGE__:' + path;
    }));
    const keep = new Set(Object.entries(cloudState.factories || {}).flatMap(([factoryId, factory]) =>
      factory.blueprint && factory.blueprint.img && factory.blueprint.img.startsWith('__CARBONOPS_STORAGE__:')
        ? [userId + '/floorplan-' + factoryId] : []));
    const { data: files, error: listError } = await client.storage.from('carbonops-assets').list(userId, { limit: 1000 });
    if (listError) throw listError;
    const stale = (files || []).map((file) => userId + '/' + file.name).filter((path) => !keep.has(path));
    if (stale.length) {
      const { error: removeError } = await client.storage.from('carbonops-assets').remove(stale);
      if (removeError) throw removeError;
    }
    const { error } = await client.from('carbonops_workspaces').upsert({
      user_id: userId, state: cloudState, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) console.error('CarbonOps cloud save failed:', error.message);
  }
  async function requestModel(body, signal) {
    const accessToken = await token();
    const response = await fetch('/api/ai', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const err = new Error('AI request failed');
      err.code = response.status === 429 ? 'rate_limited' : response.status === 413 ? 'image_rejected' : 'provider_error';
      throw err;
    }
    return response;
  }
  async function sample(messages, options) {
    options = options || {};
    const response = await requestModel({ messages }, options.signal);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '', full = '';
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      pending += decoder.decode(part.value, { stream: true });
      const rows = pending.split('\n'); pending = rows.pop() || '';
      for (const row of rows) {
        if (!row.startsWith('data:')) continue;
        const raw = row.slice(5).trim(); if (!raw || raw === '[DONE]') continue;
        try {
          const obj = JSON.parse(raw), text = obj.choices && obj.choices[0] && obj.choices[0].delta.content;
          if (typeof text === 'string') { full += text; if (options.onText) options.onText({ text: full }); }
        } catch (_) { /* Ignore incomplete SSE frames. */ }
      }
    }
    return { text: full, truncated: false };
  }
  sample.json = async function (prompt, options) {
    options = options || {};
    const content = [{ type: 'text', text: prompt }];
    for (const image of options.images || []) {
      const blob = image instanceof Blob ? image : new Blob([image]);
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      content.push({ type: 'image_url', image_url: { url: dataUrl } });
    }
    const response = await requestModel({ messages: [{ role: 'user', content }], json: true }, options.signal);
    const payload = await response.json();
    const text = payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
    if (typeof text !== 'string') { const err = new Error('Invalid model response'); err.code = 'invalid_json'; throw err; }
    try { return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); }
    catch (_) { const err = new Error('Invalid JSON from model'); err.code = 'invalid_json'; throw err; }
  };
  G.CarbonOpsCloud = { ready, client, loadWorkspace, saveWorkspace, sample };
})(window);
