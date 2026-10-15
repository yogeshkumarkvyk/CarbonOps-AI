function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
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
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) return json({ error: 'AI provider is not configured.' }, 503);
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
  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.OPENROUTER_API_KEY,
      'Content-Type': 'application/json',
      'HTTP-Referer': new URL(request.url).origin,
      'X-Title': 'CarbonOps AI'
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages: body.messages,
      stream: !body.json,
      ...(body.json ? { response_format: { type: 'json_object' } } : {}),
      max_tokens: 1400
    })
  });
  if (!upstream.ok) return json({ error: 'Model provider rejected the request.' }, upstream.status === 429 ? 429 : 502);
  return new Response(upstream.body, {
    headers: { 'Content-Type': body.json ? 'application/json' : 'text/event-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}
