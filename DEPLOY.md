# Deploy CarbonOps AI for a free-start setup

Supabase Auth manages accounts. Each signed-in user's workspace is stored in `carbonops_workspaces`; private uploaded floor-plan images are stored in the `carbonops-assets` Storage bucket. The `supabase/schema.sql` schema also creates the atomic hourly AI quota RPC. Do not drop or recreate the database during deployment.

## Cloudflare Pages

This repository is connected to the `carbonops-ai` Cloudflare Pages project. Production deploys from GitHub `main` with no build step and `.` as the output directory. The `functions/api/ai.js` Pages Function supplies `/api/ai`.

For another project, connect this repository to Cloudflare Pages, choose no framework, leave the build command blank, set the build output directory to `.`, and use Git integration. Keep automatic production deployments enabled for `main`.

## Hosted Gemini AI

Create a Gemini API key for a Google AI Studio project on the Free tier. Keep billing unlinked for a strictly free setup. In Cloudflare Pages **Settings → Variables and Secrets → Production**, add:

- `GEMINI_API_KEY` as an encrypted **Secret**.
- `GEMINI_MODEL` as the text value `gemini-3.8-flash` (also set in `wrangler.toml`).
- `SUPABASE_URL` as the project URL.
- `SUPABASE_ANON_KEY` as the public/publishable key.
- `SUPABASE_SERVICE_ROLE_KEY` as an encrypted **Secret** (server only; never put it in `config.js`).

`config.js` contains the public Supabase URL and publishable key used by the browser client. Apply `supabase/schema.sql` to the Supabase project once if it has not already been applied. After changing a secret, redeploy the project so the Pages Function receives the current configuration. The server uses Gemini only and does not fall back to another provider or model. Each signed-in account is limited by the database RPC, and Gemini Free-tier quotas can also be exhausted; requests will fail until a limit resets. The endpoint validates Supabase sessions and applies request size and same-origin checks.

Gemini Free-tier content may be used by Google to improve its products. Do not send sensitive customer or company information unless that processing is acceptable. Users can also add their own AI key in the app; their selected provider's billing, limits, and data terms apply.

## Local Pages Function preview

Install Wrangler and run `wrangler pages dev .`. Put the key in `.dev.vars` (ignored by Git):

```dotenv
GEMINI_API_KEY=your-free-tier-key
GEMINI_MODEL=gemini-3.8-flash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret
```

Never commit `.dev.vars`, API keys, or service-role keys.
