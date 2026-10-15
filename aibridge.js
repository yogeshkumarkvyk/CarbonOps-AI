/* CarbonOps AI — AI connection for the hosted site (Cloudflare Pages) and the offline file.
   The app's AI features call CAP.sample(...) / CAP.sample.json(...). Inside claude.ai those come from Claude's runtime.
   Everywhere else this file provides the same interface, backed by:
     1. the site's own /api/ai endpoint (_worker.js, key kept as a Cloudflare secret), or
     2. a key the user pastes into "Connect AI" (kept in this browser only; the browser calls the AI provider directly). */
(function (G) {
  'use strict';
  const CORE = G.CO_AI_CORE;
  const LS = 'carbonops-ai-key';
  const STATE = { mode: null, provider: null, model: null, checked: false };
  const NAMES = { gemini: 'Gemini', anthropic: 'Claude', openai: 'OpenAI' };

  function readCfg() { try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); return v && v.key ? v : null; } catch (e) { return null; } }
  function writeCfg(v) { try { if (v) localStorage.setItem(LS, JSON.stringify(v)); else localStorage.removeItem(LS); return true; } catch (e) { return false; } }

  function blobToB64(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  }
  // Downscale very large images before sending (keeps requests fast and under provider limits).
  async function prepImage(blob) {
    const mime = /^image\/(png|jpe?g|webp|gif)$/.test(blob.type) ? blob.type.replace('jpg', 'jpeg') : 'image/png';
    if (blob.size < 3.5e6) return { mime, b64: await blobToB64(blob) };
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
      return { mime: 'image/jpeg', b64: cv.toDataURL('image/jpeg', 0.88).split(',')[1] };
    } finally { URL.revokeObjectURL(url); }
  }

  const aiErr = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  // onDelta (optional): receive the answer piece by piece as it is written
  async function call(req, onDelta) {
    if (STATE.mode === 'browser') {
      const cfg = Object.assign({}, readCfg(), { onStatus: req.onStatus });
      const out = onDelta ? await CORE.stream(cfg, req, onDelta) : await CORE.call(cfg, req);
      STATE.model = out.model; return out;
    }
    if (STATE.mode === 'server') {
      let res;
      try {
        const headers = { 'content-type': 'application/json' };
        if (G.CarbonOpsCloud && G.CarbonOpsCloud.ready) headers.Authorization = 'Bearer ' + await G.CarbonOpsCloud.token();
        res = await fetch('/api/ai', { method: 'POST', headers, body: JSON.stringify({ system: req.system, messages: req.messages, images: req.images, json: req.json, maxTokens: req.maxTokens, stream: !!onDelta }), signal: req.signal });
      } catch (e) { throw aiErr(e && e.name === 'AbortError' ? 'cancelled' : 'network', e && e.name === 'AbortError' ? 'Stopped.' : 'Network error'); }
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw aiErr(body.code || 'error', body.message || 'AI request failed'); }
      if (!onDelta) { const body = await res.json(); STATE.model = body.model; return body; }
      // streamed plain text, ending with "\u0000{json}"
      const reader = res.body.getReader(); const dec = new TextDecoder(); let text = '', tail = null;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          let chunk = dec.decode(value, { stream: true });
          if (tail != null) { tail += chunk; continue; }
          const z = chunk.indexOf('\u0000'); if (z >= 0) { tail = chunk.slice(z + 1); chunk = chunk.slice(0, z); }
          if (chunk) { text += chunk; onDelta(chunk); }
        }
      } catch (e) { const er = aiErr(e && e.name === 'AbortError' ? 'cancelled' : 'network', 'Stopped.'); er.text = text; throw er; }
      let meta = {}; try { meta = JSON.parse(tail || '{}'); } catch (e) { /* ignore */ }
      if (meta.error) { const er = aiErr(meta.error, meta.message); er.text = text; throw er; }
      STATE.model = meta.model; return { text, truncated: !!meta.truncated, model: meta.model };
    }
    throw aiErr('not_configured', 'AI is not connected');
  }

  // Same shape as Claude's runtime "sample" capability, so bills, meter photos, the advisor and floor plans all work.
  // Extra option: opts.system = system prompt. With opts.onText the answer streams in.
  function makeSample() {
    const sample = async (input, opts) => {
      opts = opts || {};
      const list = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
      const messages = list.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: typeof m.content === 'string' ? m.content : (m.content || []).map((c) => c.text || '').join('\n') }));
      const images = await Promise.all((opts.images || []).map(prepImage));
      let acc = '';
      const onDelta = opts.onText ? (d) => { acc += d; try { opts.onText({ text: acc, delta: d }); } catch (e) { /* ignore */ } } : null;
      const out = await call({ system: opts.system, messages, images, signal: opts.signal, maxTokens: opts.maxTokens || 4096 }, onDelta);
      return { text: out.text, truncated: !!out.truncated };
    };
    sample.json = async (prompt, opts) => {
      opts = opts || {};
      const images = await Promise.all((opts.images || []).map(prepImage));
      const out = await call({ messages: [{ role: 'user', text: prompt }], images, json: true, signal: opts.signal, maxTokens: opts.maxTokens || 12000, onStatus: opts.onStatus });
      return CORE.parseJSON(out.text);
    };
    sample.limits = async () => ({ images: true });
    sample.system = true; // this bridge accepts a system prompt
    return sample;
  }

  function apply(CAP) {
    const on = !!STATE.mode;
    CAP.sample = on ? makeSample() : null; CAP.images = on; CAP.ai = on ? { mode: STATE.mode, provider: STATE.provider, name: NAMES[STATE.provider] || 'AI' } : null;
  }

  async function probeServer() {
    if (!/^https?:$/.test(location.protocol)) return null;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch('/api/ai', { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t);
      if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) return null;
      const j = await r.json(); return j && j.ok ? j : null;
    } catch (e) { return null; }
  }

  async function init(CAP, done) {
    const cfg = readCfg();
    if (cfg) { STATE.mode = 'browser'; STATE.provider = cfg.provider || CORE.providerOf(cfg.key); }
    else {
      const s = await probeServer();
      if (s) { STATE.mode = 'server'; STATE.provider = s.provider; }
    }
    STATE.checked = true; apply(CAP); if (done) done();
  }

  G.CO_AI = { init, state: STATE, name: () => NAMES[STATE.provider] || 'AI' };

  // ---------------- "Connect AI" dialog ----------------
  const A = G.CarbonOps; if (!A) return;
  const { ACT, UI, ic, toast } = A; const esc = G.CO_CHARTS.esc;
  A.aiConnectButton = (cls) => '<button type="button" class="btn ' + (cls || 'sm') + '" data-act="ai-connect">' + ic('sparkles') + (STATE.mode ? NAMES[STATE.provider] + ' connected' : 'Connect AI') + '</button>';
  A.aiStatusLine = () => STATE.mode
    ? '<span class="ai-st on">' + ic('sparkles') + 'AI on · ' + esc(NAMES[STATE.provider] || 'AI') + (STATE.mode === 'server' ? ' (site key)' : ' (your key)') + '</span>'
    : '<span class="ai-st">' + ic('sparkles') + 'AI is not connected · <button type="button" class="linkish" data-act="ai-connect">Connect AI</button></span>';

  ACT['ai-connect'] = () => {
    const cfg = readCfg();
    UI.modal = () => '<div class="row between"><h2 style="font-size:18px">Connect AI</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div>' +
      '<p class="small" style="margin:0">AI reads floor plans into a 3D model, reads bills and meter photos, and answers questions in the Advisor. Paste an API key from <b>Google Gemini</b> (free), <b>Anthropic Claude</b> or <b>OpenAI</b>.</p>' +
      (STATE.mode === 'server' && !cfg ? '<div class="note ok small"><b>Already on.</b> This site has its own AI key set up (' + esc(NAMES[STATE.provider] || 'AI') + '). You only need a key here to use your own.</div>' : '') +
      '<div class="field"><label for="ai-key">API key</label><input type="password" id="ai-key" autocomplete="off" spellcheck="false" placeholder="AQ.… or AIza…  ·  sk-ant-…  ·  sk-…" value="' + esc(cfg ? cfg.key : '') + '"/></div>' +
      '<details class="small"><summary>Pin a model (optional)</summary><div class="field" style="margin-top:6px"><label for="ai-model">Model name</label><input type="text" id="ai-model" placeholder="Leave empty for the default" value="' + esc((cfg && cfg.model) || '') + '"/></div></details>' +
      '<div class="note small"><b>Free Gemini key:</b> open <b>aistudio.google.com/apikey</b>, sign in with Google, press <b>Create API key</b>, and paste it here. The key is kept in this browser only and sent only to the AI provider.</div>' +
      '<div id="ai-test-out" class="small"></div>' +
      '<div class="row"><button type="button" class="btn primary" data-act="ai-save">' + ic('check') + 'Save and test</button>' + (cfg ? '<button type="button" class="btn ghost danger" data-act="ai-forget">Remove my key</button>' : '') + '<button type="button" class="btn" data-act="close">Cancel</button></div>';
    A.renderOverlay();
    setTimeout(() => { const k = document.getElementById('ai-key'); if (k) k.focus(); }, 30);
  };
  ACT['ai-save'] = async () => {
    const key = ((document.getElementById('ai-key') || {}).value || '').trim();
    const model = ((document.getElementById('ai-model') || {}).value || '').trim() || null;
    const out = document.getElementById('ai-test-out');
    const provider = CORE.providerOf(key);
    if (!provider) { out.innerHTML = '<div class="note err">That does not look like a Gemini (AQ.… or AIza…), Claude (sk-ant-…) or OpenAI (sk-…) key.</div>'; return; }
    out.innerHTML = '<div class="note"><span class="spinner"></span> Testing the key with ' + NAMES[provider] + '…</div>';
    try {
      const r = await CORE.call({ provider, key, model }, { messages: [{ role: 'user', text: 'Reply with the single word OK.' }], maxTokens: 400 });
      if (!writeCfg({ provider, key, model: model || r.model })) throw Object.assign(new Error('This browser blocked saving the key.'), { code: 'storage' });
      STATE.mode = 'browser'; STATE.provider = provider; STATE.model = r.model; apply(A.CAP);
      UI.modal = null; A.renderOverlay(); A.render(); toast(NAMES[provider] + ' connected (' + r.model + '). AI features are on.');
    } catch (e) {
      const why = { bad_key: 'The key was rejected. Copy it again from the provider.', rate_limited: 'The key works but is rate limited right now. Wait a minute and try again.', network: 'Could not reach the AI service. Check your internet connection.', model_unavailable: 'That model name is not available for this key.' }[e.code] || (e.message || 'The test failed.');
      out.innerHTML = '<div class="note err">' + esc(why) + '</div>';
    }
  };
  ACT['ai-forget'] = async () => { writeCfg(null); STATE.mode = null; STATE.provider = null; await init(A.CAP); UI.modal = null; A.renderOverlay(); A.render(); toast('Your key was removed from this browser.'); };

  // AI section on Settings > Factory
  const origSettings = A.VIEWS.settings;
  A.VIEWS.settings = (vm) => {
    const html = origSettings(vm);
    if ((UI.settings.tab || 'factory') !== 'factory') return html;
    return html + '<section class="card set-card"><div class="set-h"><span class="set-ic">' + ic('sparkles') + '</span><div><h3>AI connection</h3><p>Reads floor plans into 3D, bills and meter photos, and powers the Advisor.</p></div><div class="set-r">' + A.aiConnectButton('sm primary') + '</div></div><div class="card-b">' + A.aiStatusLine() + '</div></section>';
  };
})(window);
