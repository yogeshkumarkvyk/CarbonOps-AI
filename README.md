# CarbonOps AI

CarbonOps AI is a browser-based factory emissions workspace. The current website package can also run locally by opening `index.html` in a modern browser.

## Publish

The live site uses Cloudflare Pages with GitHub integration. The Pages Function in `functions/api/ai.js` provides the hosted Gemini endpoint. Follow [DEPLOY.md](DEPLOY.md) for setup and local preview instructions.

## Storage

In this website version, accounts and workspace data are stored in the current browser on the current device. They do not sync between devices and are not stored in Supabase. The existing Supabase project and schema are retained, but this version does not call them.

## AI and privacy

The hosted AI endpoint uses `GEMINI_API_KEY` from Cloudflare's encrypted Production secrets and pins the server model to `gemini-3.8-flash`. The key is not included in browser code or this repository. Requests made through hosted AI are forwarded from Cloudflare to Google Gemini. Google Free-tier quotas and data terms apply. Users may also connect their own Gemini, Claude, or OpenAI key in the browser; those requests go directly to the chosen provider and that provider's charges, limits, and terms apply.

AI readings of bills, meter photos, and floor plans are suggestions. Review them against the source before saving.
