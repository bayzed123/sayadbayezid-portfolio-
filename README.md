# bayezid-agency-api

Tiny Cloudflare Worker with one job: receive an event the browser Pixel
already fired on connectwithbayezid's agency site, and forward it to Meta's
Conversions API server-side — the "dual delivery" pattern Meta recommends,
since the browser Pixel alone can be blocked by ad-blockers or Safari's
tracking prevention.

## One-time setup

1. `npm install`
2. Set the Conversions API access token as a Worker secret — **never** put
   this in `wrangler.jsonc` or commit it anywhere:
   ```
   npx wrangler secret put META_CONVERSIONS_API_TOKEN
   ```
   (paste the token from Events Manager → Conversions API → Set up direct
   integration)
3. GitHub repo → Settings → Secrets and variables → Actions, add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Push to `main` — GitHub Actions deploys automatically on any change under
   `worker/`.

## Endpoint

```
POST /api/track
{
  "event_name": "Lead",
  "event_id": "<same uuid the browser fbq() call used>",
  "event_source_url": "https://sayadbayezid.com/",
  "custom_data": { "content_name": "SmartGen" }
}
```

`event_id` must match what the browser-side `fbq()` call sent for the same
click — that's what tells Meta these are one event delivered twice, not two
separate events.

## Rotating the token

If it's ever pasted somewhere it shouldn't be (chat, a screenshot, a public
repo), treat it as compromised: Events Manager → Conversions API →
generate a new one, then `wrangler secret put META_CONVERSIONS_API_TOKEN`
again with the new value.
