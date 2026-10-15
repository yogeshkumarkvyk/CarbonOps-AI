# CarbonOps AI

CarbonOps is a browser-based industrial emissions workspace. It can run as a local demo or as a hosted app connected to Supabase and an OpenAI-compatible model provider.

## Hosted setup

Follow [DEPLOY.md](DEPLOY.md). Before publishing, configure Supabase, add the SQL in `supabase/schema.sql`, and replace the public placeholders in `config.js`. Provider secrets belong in Cloudflare Pages settings, never in browser files.

## Local demo

Open `index.html` in a current desktop browser and choose **Explore the demo workspace**. Local demo accounts and data stay in that browser. Hosted account creation requires the Supabase settings described in `DEPLOY.md`.

## Data and AI

Hosted accounts and workspace JSON are stored in Supabase. Floor-plan images are stored in the private `carbonops-assets` bucket. AI requests go through a Cloudflare Pages Function and are forwarded to the configured model provider. Review the provider's data terms before sending business documents or images.

AI-generated document, meter, and floor-plan readings are suggestions. Review them against the source and confirm them before saving. Emissions calculations use CarbonOps' factor registry and calculation engine.
