export async function onRequestDelete({ request, env }) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 });
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return new Response('Deletion is not configured', { status: 503 });
  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const userResponse = await fetch(base + '/auth/v1/user', { headers: { Authorization: authorization, apikey: env.SUPABASE_ANON_KEY } });
  if (!userResponse.ok) return new Response('Unauthorized', { status: 401 });
  const user = await userResponse.json();
  const adminHeaders = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY };
  const assets = await fetch(base + '/storage/v1/object/list/carbonops-assets', {
    method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: user.id, limit: 1000, offset: 0 })
  });
  if (!assets.ok) return new Response('Could not remove account files', { status: 502 });
  const objects = await assets.json();
  const paths = objects.map((object) => user.id + '/' + object.name);
  if (paths.length) {
    const removed = await fetch(base + '/storage/v1/object/carbonops-assets', {
      method: 'DELETE', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths })
    });
    if (!removed.ok) return new Response('Could not remove account files', { status: 502 });
  }
  const deleted = await fetch(base + '/auth/v1/admin/users/' + encodeURIComponent(user.id), {
    method: 'DELETE', headers: adminHeaders
  });
  return new Response(null, { status: deleted.ok ? 204 : 502 });
}
