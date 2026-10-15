/* CarbonOps AI — provider-neutral AI call (Gemini, Claude or OpenAI).
   Used in the browser (aibridge.js) and on the server (_worker.js is built from this file + tools/worker-main.js).
   req = { system, messages: [{ role: 'user'|'assistant', text }], images: [{ mime, b64 }], json: bool, maxTokens, signal }
   coAiCall(cfg, req)              -> { text, truncated, provider, model }
   coAiStream(cfg, req, onDelta)   -> same, calling onDelta(textPiece) as the answer arrives
   Errors are thrown as Error objects with a .code (bad_key, rate_limited, network, model_unavailable, ...). */
const CO_AI_MODELS = {
  gemini: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'],
  anthropic: ['claude-sonnet-5-5', 'claude-sonnet-4-5'],
  openai: ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini']
};
const CO_AI_GOOD = {}; // remembers the first model that worked, so later calls skip unavailable ones
function coAiProviderOf(key) {
  key = String(key || '').trim();
  if (/^AIza/.test(key) || /^AQ\./.test(key)) return 'gemini'; // AQ. = Google's newer auth keys (AI Studio, 2026)
  if (/^sk-ant-/.test(key)) return 'anthropic';
  if (/^sk-/.test(key)) return 'openai';
  return null;
}
function coAiErr(code, message) { const e = new Error(message || code); e.code = code; return e; }

function coAiHttpErr(status, raw) {
  let body = null; try { body = JSON.parse(raw); } catch (e) { body = { raw }; }
  if (Array.isArray(body)) body = body[0] || {};
  const msg = (body && body.error && (body.error.message || body.error.type)) || (body && body.raw) || ('HTTP ' + status);
  if (status === 404 || (status === 400 && /model|not found|not supported|does not exist/i.test(msg) && !/api key/i.test(msg))) return coAiErr('model_unavailable', msg);
  if (status === 401 || status === 403 || /api key not valid|invalid x-api-key|incorrect api key|API_KEY_INVALID|permission|ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(msg)) return coAiErr('bad_key', msg);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return coAiErr('rate_limited', msg);
  if (status === 503 || status === 529 || /overloaded|UNAVAILABLE|high demand|try again later/i.test(msg)) return coAiErr('overloaded', msg);
  if (status === 413) return coAiErr('too_large', msg);
  return coAiErr('error', msg);
}

const coAiSleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Tries the preferred model, retries once when Google/Anthropic/OpenAI say they are busy,
// then moves on to the next model in the list (each model has its own capacity and free quota).
async function coAiWithModels(cfg, fn) {
  const provider = cfg.provider || coAiProviderOf(cfg.key);
  if (!provider || !cfg.key) throw coAiErr('not_configured', 'No AI key is set up.');
  const first = cfg.model || CO_AI_GOOD[provider];
  const models = first ? [first].concat(CO_AI_MODELS[provider].filter((m) => m !== first)) : CO_AI_MODELS[provider];
  let last = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (cfg.onStatus) cfg.onStatus('trying', model);
        const out = await fn(provider, model);
        out.provider = provider; out.model = model; CO_AI_GOOD[provider] = model; return out;
      } catch (e) {
        last = e;
        if (e.started || e.code === 'cancelled') throw e;
        const busy = e.code === 'rate_limited' || e.code === 'overloaded';
        if (busy && attempt === 0) { if (cfg.onStatus) cfg.onStatus('busy', model); await coAiSleep(1500); continue; }
        if (busy || e.code === 'model_unavailable') break; // next model
        throw e;
      }
    }
  }
  throw last || coAiErr('error');
}

// Build the provider request (same shape for normal and streamed calls)
function coAiBuild(provider, key, model, req, stream) {
  const msgs = (req.messages || []).filter((m) => m && m.text);
  const imgs = req.images || [];
  const lastUser = (() => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role !== 'assistant') return i; return -1; })();
  const maxT = req.maxTokens || 8192;
  if (provider === 'gemini') {
    const contents = msgs.map((m, i) => {
      const parts = [];
      if (i === lastUser) imgs.forEach((im) => parts.push({ inline_data: { mime_type: im.mime, data: im.b64 } }));
      parts.push({ text: m.text });
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });
    const gen = { maxOutputTokens: maxT, temperature: req.json ? 0.1 : 0.5 };
    if (req.json) gen.responseMimeType = 'application/json';
    const body = { contents, generationConfig: gen };
    if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
    return { url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + (stream ? ':streamGenerateContent?alt=sse' : ':generateContent'), headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body };
  }
  if (provider === 'anthropic') {
    const messages = msgs.map((m, i) => {
      const content = [];
      if (i === lastUser) imgs.forEach((im) => content.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.b64 } }));
      content.push({ type: 'text', text: m.text + (i === lastUser && req.json ? '\n\nReply with only the JSON object, no other text.' : '') });
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content };
    });
    const body = { model, max_tokens: maxT, messages };
    if (req.system) body.system = req.system;
    if (stream) body.stream = true;
    return { url: 'https://api.anthropic.com/v1/messages', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body };
  }
  if (provider === 'openai') {
    const messages = msgs.map((m, i) => {
      if (i !== lastUser || !imgs.length) return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text };
      return { role: 'user', content: imgs.map((im) => ({ type: 'image_url', image_url: { url: 'data:' + im.mime + ';base64,' + im.b64, detail: 'high' } })).concat([{ type: 'text', text: m.text }]) };
    });
    if (req.system) messages.unshift({ role: 'system', content: req.system });
    const body = { model, messages, max_completion_tokens: maxT };
    if (req.json) body.response_format = { type: 'json_object' };
    if (stream) body.stream = true;
    return { url: 'https://api.openai.com/v1/chat/completions', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body };
  }
  throw coAiErr('not_configured', 'Unknown AI provider.');
}

async function coAiPost(b, signal) {
  try { return await fetch(b.url, { method: 'POST', headers: b.headers, body: JSON.stringify(b.body), signal }); } catch (e) {
    if (e && e.name === 'AbortError') throw coAiErr('cancelled', 'Stopped.');
    throw coAiErr('network', 'Could not reach the AI service. Check the internet connection.');
  }
}

async function coAiCall(cfg, req) {
  return coAiWithModels(cfg, async (provider, model) => {
    const res = await coAiPost(coAiBuild(provider, cfg.key, model, req, false), req.signal);
    const raw = await res.text();
    if (!res.ok) throw coAiHttpErr(res.status, raw);
    const body = JSON.parse(raw);
    if (provider === 'gemini') {
      const c = body && body.candidates && body.candidates[0];
      if (!c) throw coAiErr('blocked', (body && body.promptFeedback && body.promptFeedback.blockReason) || 'The AI returned no answer.');
      return { text: ((c.content && c.content.parts) || []).filter((p) => !p.thought).map((p) => p.text || '').join(''), truncated: c.finishReason === 'MAX_TOKENS' };
    }
    if (provider === 'anthropic') return { text: ((body && body.content) || []).filter((x) => x.type === 'text').map((x) => x.text).join(''), truncated: body && body.stop_reason === 'max_tokens' };
    const ch = body && body.choices && body.choices[0];
    return { text: (ch && ch.message && ch.message.content) || '', truncated: ch && ch.finish_reason === 'length' };
  });
}

// Streamed answer: reads the provider's server-sent events and passes each new piece of text to onDelta.
async function coAiStream(cfg, req, onDelta) {
  return coAiWithModels(cfg, async (provider, model) => {
    const res = await coAiPost(coAiBuild(provider, cfg.key, model, req, true), req.signal);
    if (!res.ok) throw coAiHttpErr(res.status, await res.text());
    const reader = res.body.getReader(); const dec = new TextDecoder();
    let buf = '', text = '', truncated = false;
    const take = (data) => {
      if (!data || data === '[DONE]') return;
      let j; try { j = JSON.parse(data); } catch (e) { return; }
      let piece = '';
      if (provider === 'gemini') {
        const c = j.candidates && j.candidates[0];
        if (c) { piece = ((c.content && c.content.parts) || []).filter((p) => !p.thought).map((p) => p.text || '').join(''); if (c.finishReason === 'MAX_TOKENS') truncated = true; }
      } else if (provider === 'anthropic') {
        if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') piece = j.delta.text || '';
        if (j.type === 'message_delta' && j.delta && j.delta.stop_reason === 'max_tokens') truncated = true;
        if (j.type === 'error') throw coAiErr(/overload|rate/i.test(JSON.stringify(j.error)) ? 'rate_limited' : 'error', (j.error && j.error.message) || 'AI error');
      } else {
        const ch = j.choices && j.choices[0];
        if (ch) { piece = (ch.delta && ch.delta.content) || ''; if (ch.finish_reason === 'length') truncated = true; }
      }
      if (piece) { text += piece; onDelta(piece); }
    };
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); if (line.startsWith('data:')) take(line.slice(5).trim()); }
      }
      if (buf.startsWith('data:')) take(buf.slice(5).trim());
    } catch (e) {
      if (e && e.name === 'AbortError') { const er = coAiErr('cancelled', 'Stopped.'); er.text = text; throw er; }
      if (e && e.code) { e.started = !!text; throw e; }
      const er = coAiErr('network', 'The connection dropped while the answer was arriving.'); er.text = text; er.started = !!text; throw er;
    }
    return { text, truncated };
  });
}

// Pull a JSON object out of a model reply (handles ```json fences and stray text).
function coAiParseJSON(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch (e) { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* fall through */ } }
  const a2 = t.indexOf('['), b2 = t.lastIndexOf(']');
  if (a2 >= 0 && b2 > a2) { try { return JSON.parse(t.slice(a2, b2 + 1)); } catch (e) { /* fall through */ } }
  throw coAiErr('bad_json', 'The AI reply was not valid JSON.');
}

if (typeof window !== 'undefined') window.CO_AI_CORE = { call: coAiCall, stream: coAiStream, parseJSON: coAiParseJSON, providerOf: coAiProviderOf, MODELS: CO_AI_MODELS };
