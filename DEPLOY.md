# Publish CarbonOps for a free-start deployment

This project uses Cloudflare Pages for the static site and API functions, Supabase for account authentication, Postgres and private file storage, and OpenRouter for optional hosted model inference. Free quotas and provider terms can change.

## 1. Supabase project (already created)

The Supabase project is `CarbonOps-AI` in the Asia-Pacific (Sydney) region. Its URL and publishable key are already set in `config.js`. The SQL in `supabase/schema.sql` has been applied successfully; it creates per-user workspace and AI quota tables, a private Storage bucket, RLS policies, and the quota RPC.

After Cloudflare creates the final `https://…pages.dev` address, set it as the Site URL in Supabase Authentication settings and add it to the allowed redirect URLs. Keep email confirmation enabled. Configure SMTP for dependable delivery; the built-in test sender is intended for testing.

The publishable key in `config.js` is public by design. The row and storage policies enforce access. Never place a service-role key in this file.

The current schema gives each account a private workspace. It does not yet implement shared organizations or invitations.

## 2. Connect a private GitHub repository

Create a private GitHub repository and add the contents of this folder at its root. Then connect the repository to Cloudflare Pages. Keep `.dev.vars`, `.env` files, API keys, and service-role keys out of Git. The Supabase URL and publishable key in `config.js` are browser-visible public settings.

## 3. Deploy the site

1. In Cloudflare, create a **Pages** project connected to the GitHub repository.
2. Choose no framework. Leave the build command blank and set the build output directory to `.`.
3. Deploy. The `functions/` directory is deployed with the static app.
4. Copy the resulting `pages.dev` URL into Supabase Auth's site and redirect URL settings, then redeploy if you changed `config.js`.

Use Git integration from the start so pushes deploy automatically. Cloudflare does not convert a direct-upload project into a Git-integrated project.

## 4. Configure AI requests (optional)

Create an OpenRouter key. In Cloudflare Pages, open the project's **Settings → Variables and Secrets** and add these as encrypted secrets or variables:

- `OPENROUTER_API_KEY` — secret API key.
- `OPENROUTER_MODEL` — model ID supported by OpenRouter. For a free multimodal prototype, check its current model list for a free vision-capable model; `google/gemma-4-31b-it:free` was listed as image-capable when this setup was written. Free model availability and rate limits change.
- `SUPABASE_URL` — project URL.
- `SUPABASE_ANON_KEY` — publishable/anon key, used by the function to validate signed-in users.
- `SUPABASE_SERVICE_ROLE_KEY` — secret used for the AI quota check and account deletion. It bypasses RLS and must be stored only in Cloudflare's encrypted secret settings.

Redeploy after adding variables. Free model routes can be busy, rate-limited, or changed by the provider. CarbonOps currently caps AI calls at 30 per signed-in user per hour. AI features will report an error when the model is unavailable; manual entry and rule-based answers remain available.

## 5. Optional local Pages Functions preview

Install Wrangler on your development machine and use `wrangler pages dev .`. Put local function secrets in `.dev.vars` (ignored by Git):

```dotenv
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=your-model-id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not share or commit `.dev.vars`.

## Before inviting real users

- Confirm Supabase email delivery and password reset work with the deployed redirect URL.
- Review all AI outputs before saving bills, meter readings, or room labels.
- Decide whether the selected model provider may process your users' documents and images.
- Replace the in-app privacy and terms drafts with your operator name, contact, hosting/data region, retention and deletion policy, and the provider/subprocessor terms that apply to your deployment.
- Add shared-factory membership and server-enforced roles before using the app for teams. The current cloud schema isolates one workspace per account; the role selector is a UI preference, not a multi-user authorization system.
- Plan backups and a paid tier if the service becomes important. Supabase free projects may pause after inactivity and have storage and database quotas.
