const MODEL_FALLBACK = 'gemini-3.8-flash';
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 4;
const MAX_MESSAGES = 20;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function providerConfig(env) {
  if (!env.GEMINI_API_KEY) return null;
  return { key: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || MODEL_FALLBACK };
}

// Best-effort per-isolate protection for the public, browser-local account version.
// Cloudflare isolates are ephemeral, so this complements request-size and origin checks;
// Gemini's Free-tier quota remains the hard provider-side limit.
const requestBuckets = new Map();
function overLimit(ip) {
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  const recent = (requestBuckets.get(ip) || []).filter((time) => time > cutoff);
  if (recent.length >= 30) {
    requestBuckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  requestBuckets.set(ip, recent);
  if (requestBuckets.size > 5000) {
    for (const [key, times] of requestBuckets) {
      if (!times.some((time) => time > cutoff)) requestBuckets.delete(key);
      if (requestBuckets.size <= 4000) break;
    }
  }
  return false;
}

function geminiParts(messages, images) {
  let lastUser = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role !== 'assistant') { lastUser = index; break; }
  }
  return messages.map((message, index) => {
    const parts = [];
    if (index === lastUser) {
      for (const image of images) parts.push({ inline_data: { mime_type: image.mime, data: image.b64 } });
    }
    if (message.text) parts.push({ text: message.text });
    return { role: message.role === 'assistant' ? 'model' : 'user', parts };
  });
}

function errorResponse(status, message, code) {
  return json({ code, message }, status);
}

function googleError(status, body) {
  const message = body?.error?.message || 'Gemini could not complete the request.';
  if (status === 429) return errorResponse(429, 'Gemini Free-tier quota is busy or exhausted. Try again later.', 'rate_limited');
  if (status === 401 || status === 403) return errorResponse(502, 'The Gemini server key was rejected. Check the Cloudflare secret.', 'bad_key');
  if (status === 413) return errorResponse(413, 'The request is too large.', 'too_large');
  if (status === 503) return errorResponse(503, 'Gemini is temporarily unavailable. Try again shortly.', 'overloaded');
  return errorResponse(502, message.slice(0, 500), 'error');
}

export async function onRequestGet({ env }) {
  const cfg = providerConfig(env);
  return json({ ok: !!cfg, provider: cfg ? 'gemini' : null, images: true });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return errorResponse(403, 'Cross-site requests are not allowed.', 'forbidden');
    } catch (_) { return errorResponse(403, 'Cross-site requests are not allowed.', 'forbidden'); }
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (overLimit(ip)) return errorResponse(429, 'This network has reached the hourly AI request limit. Try again later.', 'rate_limited');

  const cfg = providerConfig(env);
  if (!cfg) return errorResponse(503, 'No Gemini API key is configured on the server.', 'not_configured');
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_BODY_BYTES) return errorResponse(413, 'The request is too large.', 'too_large');

  let raw;
  let input;
  try {
    raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return errorResponse(413, 'The request is too large.', 'too_large');
    input = JSON.parse(raw);
  } catch (_) { return errorResponse(400, 'The request body must be valid JSON.', 'bad_request'); }

  if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length > MAX_MESSAGES) {
    return errorResponse(400, 'Provide between 1 and 20 messages.', 'bad_request');
  }
  const messages = input.messages.map((message) => ({
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    text: typeof message?.text === 'string' ? message.text.slice(0, 100000) : ''
  })).filter((message) => message.text);
  if (!messages.length) return errorResponse(400, 'At least one message must contain text.', 'bad_request');

  const suppliedImages = Array.isArray(input.images) ? input.images : [];
  if (suppliedImages.length > MAX_IMAGES || suppliedImages.some((image) => !image || typeof image.b64 !== 'string' || !/^image\/(png|jpe?g|webp|gif)$/.test(image.mime))) {
    return errorResponse(400, 'Provide at most four PNG, JPEG, WebP, or GIF images.', 'bad_request');
  }
  const images = suppliedImages.map((image) => ({ mime: image.mime.replace('jpg', 'jpeg'), b64: image.b64 }));
  if (images.some((image) => image.b64.length > 8 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.b64))) {
    return errorResponse(413, 'An image is too large or invalid.', 'too_large');
  }

  const model = cfg.model;
  const maxTokens = Math.max(128, Math.min(16000, Number(input.maxTokens) || 4096));
  const generationConfig = { maxOutputTokens: maxTokens, temperature: input.json ? 0.1 : 0.5 };
  if (input.json) generationConfig.responseMimeType = 'application/json';
  const payload = {
    contents: geminiParts(messages, images),
    generationConfig,
    ...(typeof input.system === 'string' && input.system ? { systemInstruction: { parts: [{ text: input.system.slice(0, 100000) }] } } : {})
  };

  let upstream;
  try {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify(payload),
      signal: request.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') return errorResponse(499, 'The request was stopped.', 'cancelled');
    return errorResponse(502, 'Could not reach Gemini. Try again shortly.', 'network');
  }

  if (!upstream.ok) {
    let errorBody = {};
    try { errorBody = await upstream.json(); } catch (_) { /* keep generic error */ }
    return googleError(upstream.status, errorBody);
  }

  let result;
  try { result = await upstream.json(); }
  catch (_) { return errorResponse(502, 'Gemini returned an invalid response.', 'error'); }
  const candidate = result.candidates?.[0];
  const text = (candidate?.content?.parts || []).filter((part) => !part.thought && typeof part.text === 'string').map((part) => part.text).join('');
  if (!text) return errorResponse(502, 'Gemini returned no response text.', 'blocked');
  const output = { text, truncated: candidate.finishReason === 'MAX_TOKENS', model, provider: 'gemini' };

  if (input.stream) {
    const trailer = `\u0000${JSON.stringify({ done: true, truncated: output.truncated, model, provider: 'gemini' })}`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text + trailer));
        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  return json(output);
}
