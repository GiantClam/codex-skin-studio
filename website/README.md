# Codex Skin Archive

Payload + Next.js application for a public Codex / ChatGPT Desktop skin archive.

Published metadata and preview images are public. ZIP packages are stored in
private R2 and are served only through a short-lived, single-use download grant.

## Product boundary

- Visitors browse and download published ZIP packages without registration.
- Only the admin surface requires authentication, supplied by Payload and protected at the edge with Cloudflare Access.
- Uploads are reviewed before publication. GitHub search creates reviewable source records; it never auto-publishes.
- Theme packages must satisfy the contract in `src/lib/theme-package/validator.mjs` before a draft can enter review.

## Local setup

```bash
npm install
npm run dev
```

Set `PAYLOAD_SECRET` before using the admin or running Payload migrations. For Cloudflare bindings, use Wrangler's local D1/R2 emulation or a remote environment after `wrangler login`.

Optional abuse protection variables:

- `TURNSTILE_SITE_KEY` — public site key for the submit form.
- `TURNSTILE_SECRET` — server-only Turnstile secret; when present, submissions and GitHub imports require a valid token.
- `TURNSTILE_ENFORCE=true` — fail closed even before a secret is configured (use after setting both Turnstile keys).

## Cloudflare deployment

1. The production D1 database and R2 bucket are already declared in `wrangler.jsonc`.
2. Set `PAYLOAD_SECRET` with `wrangler secret put PAYLOAD_SECRET`.
3. Set `SKIN_STUDIO_DOWNLOAD_SECRET` with `wrangler secret put SKIN_STUDIO_DOWNLOAD_SECRET`.
4. Run `npm run generate:types`, then `npm run deploy`.

`npm run deploy` applies Payload migrations to the remote D1 database before deploying the Worker. Rate limiting is attached through two native Cloudflare bindings: five manual submissions per IP per minute and ten GitHub imports per IP per minute. Cloudflare's native binding configuration is documented in [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

The current config follows Payload's official `with-cloudflare-d1` template and uses OpenNext for the Worker bundle.
