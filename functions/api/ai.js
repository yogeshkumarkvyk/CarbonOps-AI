function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function geminiParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) throw new Error('Invalid message content.');
  return content.map((part) => {
    if (part && part.type === 'text' && typeof part.text === 'string') return { text: part.text };
    const url = part && part.type === 'image_url' && part.image_url && part.image_url.url;
    const image = typeof url === 'string' && url.match(/^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (image) return { inlineData: { mimeType: image[1], data: image[2] } };
    throw new Error('Unsupported message content.');
  });
}

function geminiPayload(messages, jsonMode) {
  const system = [];
  const contents = [];
  for (const message of messages) {
    const parts = geminiParts(message.content);
    if (message.role === 'system') system.push(...parts);
    else contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts });
  }
  if (!contents.length) throw new Error('At least one user message is required.');
  return {
    ...(system.length ? { systemInstruction: { parts: system } } : {}),
    contents,
    generationConfig: {
      maxOutputTokens: 1400,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {})
    }
  };
}

function openAIChunk(text) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

function streamAsOpenAI(upstream) {
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) {
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }
          pending += decoder.decode(part.value, { stream: true });
          const rows = pending.split('\n');
          pending = rows.pop() || '';
          for (const row of rows) {
            if (!row.startsWith('data:')) continue;
            const raw = row.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;
            let result;
            try { result = JSON.parse(raw); } catch (_) { continue; }
            const text = (result.candidates?.[0]?.content?.parts || [])
              .map((item) => typeof item.text === 'string' ? item.text : '')
              .join('');
            if (text) {
              controller.enqueue(new TextEncoder().encode(openAIChunk(text)));
              return;
            }
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) { return reader.cancel(reason); }
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json({ error: 'Sign in is required.' }, 401);
  const verified = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', {
    headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY }
  });
  if (!verified.ok) return json({ error: 'Your session is invalid or expired.' }, 401);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'AI service is not configured.' }, 503);
  const user = await verified.json();
  const quota = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/take_carbonops_ai_slot', {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: user.id, p_limit: 30 })
  });
  if (!quota.ok) return json({ error: 'AI request limit is unavailable.' }, 503);
  if (await quota.json() !== true) return json({ error: 'Hourly AI request limit reached.' }, 429);
  if (!env.GEMINI_API_KEY) return json({ error: 'AI provider is not configured.' }, 503);
  const model = env.GEMINI_MODEL || 'gemini-3.8-flash';
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 8 * 1024 * 1024) return json({ error: 'Request is too large.' }, 413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8 * 1024 * 1024) return json({ error: 'Request is too large.' }, 413);
    body = JSON.parse(raw);
  } catch (_) { return json({ error: 'Invalid request.' }, 400); }
  if (!Array.isArray(body.messages) || body.messages.length > 12 || body.messages.some((m) => !m || !['user', 'assistant', 'system'].includes(m.role) || !(typeof m.content === 'string' || Array.isArray(m.content)))) return json({ error: 'Invalid messages.' }, 400);
  if (body.messages.some((m) => typeof m.content === 'string' ? m.content.length > 30000 : JSON.stringify(m.content).length > 11 * 1024 * 1024)) return json({ error: 'Message is too large.' }, 413);

  let payload;
  try { payload = geminiPayload(body.messages, !!body.json); }
  catch (_) { return json({ error: 'Invalid message content.' }, 400); }
  const method = body.json ? 'generateContent' : 'streamGenerateContent?alt=sse';
  const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!upstream.ok) return json({ error: 'Gemini rejected the request. Free-tier quota may be exhausted.' }, upstream.status === 429 ? 429 : 502);
  if (!body.json) return streamAsOpenAI(upstream);

  let result;
  try { result = await upstream.json(); }
  catch (_) { return json({ error: 'Gemini returned an invalid response.' }, 502); }
  const text = (result.candidates?.[0]?.content?.parts || [])
    .map((part) => typeof part.text === 'string' ? part.text : '')
    .join('');
  if (!text) return json({ error: 'Gemini returned no response text.' }, 502);
  return json({ choices: [{ message: { content: text } }] }, 200);
}
