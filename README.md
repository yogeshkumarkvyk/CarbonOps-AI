# CarbonOps AI

CarbonOps AI is a browser-based factory emissions workspace. The current website package can also run locally by opening `index.html` in a modern browser.

## Publish

The live site uses Cloudflare Pages with GitHub integration. The Pages Function in `functions/api/ai.js` provides the hosted Gemini endpoint. Follow [DEPLOY.md](DEPLOY.md) for setup and local preview instructions.

## Accounts and storage

When the configured Supabase project is available, Supabase Auth manages accounts and the `carbonops_workspaces` table stores each signed-in user's workspace under row-level security. Floor-plan images are stored in the private `carbonops-assets` bucket. Local browser storage is a cache and is used for the demo account. Set the Cloudflare Pages Supabase variables listed in [DEPLOY.md](DEPLOY.md); never expose the service-role key in browser code.

## AI and privacy

The hosted AI endpoint uses `GEMINI_API_KEY` from Cloudflare's encrypted Production secrets and pins the server model to `gemini-3.8-flash`. The key is not included in browser code or this repository. Signed-in users' requests pass through Cloudflare and are forwarded to Google Gemini; an atomic Supabase RPC enforces a per-user hourly limit. Google Free-tier quotas and data terms apply. Users may also connect their own Gemini, Claude, or OpenAI key in the browser; those requests go directly to the chosen provider and that provider's charges, limits, and terms apply.

AI readings of bills, meter photos, and floor plans are suggestions. Review them against the source before saving.
