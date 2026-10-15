# Deploy CarbonOps AI for a free-start setup

The current shared website version uses browser-local accounts and workspace data. It does not use the existing Supabase database or sync data across devices. The existing Supabase project/schema are left untouched; they can be connected in a later version if shared cloud storage is needed.

## Cloudflare Pages

This repository is connected to the `carbonops-ai` Cloudflare Pages project. Production deploys from GitHub `main` with no build step and `.` as the output directory. The `functions/api/ai.js` Pages Function supplies `/api/ai`.

For another project, connect this repository to Cloudflare Pages, choose no framework, leave the build command blank, set the build output directory to `.`, and use Git integration. Keep automatic production deployments enabled for `main`.

## Hosted Gemini AI

Create a Gemini API key for a Google AI Studio project on the Free tier. Keep billing unlinked for a strictly free setup. In Cloudflare Pages **Settings → Variables and Secrets → Production**, add:

- `GEMINI_API_KEY` as an encrypted **Secret**.
- `GEMINI_MODEL` as the text value `gemini-3.8-flash` (also set in `wrangler.toml`).

After changing a secret, redeploy the project so the Pages Function receives the current configuration. The server uses Gemini only and does not fall back to another provider or model. Free-tier quotas can be exhausted; requests will fail until the quota resets. The endpoint applies request size limits, same-origin checks, and best-effort per-IP throttling; the provider's Free-tier quota is the hard usage limit.

Gemini Free-tier content may be used by Google to improve its products. Do not send sensitive customer or company information unless that processing is acceptable. Users can also add their own AI key in the app; their selected provider's billing, limits, and data terms apply.

## Local Pages Function preview

Install Wrangler and run `wrangler pages dev .`. Put the key in `.dev.vars` (ignored by Git):

```dotenv
GEMINI_API_KEY=your-free-tier-key
GEMINI_MODEL=gemini-3.8-flash
```

Never commit `.dev.vars`, API keys, or service-role keys.
