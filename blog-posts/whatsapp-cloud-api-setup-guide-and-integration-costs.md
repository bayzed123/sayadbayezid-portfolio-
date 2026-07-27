---
title: "WhatsApp Cloud API Setup Guide and Integration Costs"
slug: "whatsapp-cloud-api-setup-guide-and-integration-costs"
description: "A complete guide comparing official WhatsApp Cloud API vs Baileys, Meta integration costs, step-by-step setup, and channel configurations."
date: "2026-07-27"
image: "/blog-posts/images/workflow-diagram.png"
tags: 
  - Case study
  - Smartgen Ai
  - smartgenflwo
category: case study
---
# Channels: official vs unofficial, and what things actually cost

## WhatsApp: two different integrations exist in this codebase

| | `whatsappCloudHandler.js` (official) | `whatsappWorker.js` + `whatsappManager.js` (baileys) |
|---|---|---|
| What it is | Meta's own Cloud API | Reverse-engineered WhatsApp Web protocol |
| Approved by Meta? | Yes | No — against WhatsApp's Terms of Service |
| Ban risk | None (it's the real API) | Real — numbers get banned, especially once you're sending commercial volume |
| Setup | Meta Developer account, no phone needed for testing | Scan a QR code with your own phone |
| Cost | Free for replying to customers (see below) | Free, but you're paying with risk instead of money |

**For a marketplace/commercial product, use the Cloud API.** It's what
`docs/DEPLOYMENT.md` and this guide both assume from here. The baileys
files are still in the repo in case you want them for a personal/low-
stakes project, but don't ship a paying product on top of them.

## What this actually costs you

- **WhatsApp Cloud API access itself: free.** No subscription fee to Meta.
- **Replying to a customer within 24 hours of their message ("service
  conversation"): free.** This is your exact use case — customer messages
  you, bot replies. You will not be charged for this.
- **You only pay if *you* message a customer first** with a marketing or
  utility template (e.g. a promotional broadcast) — a few cents per
  conversation, varies by country. Skip this entirely for now; nothing
  in the current build sends unprompted outbound messages.
- **You do not need a paid middleman (BSP)** like Twilio/360dialog/Wati.
  Meta's Cloud API can be called directly — the `whatsappCloudHandler.js`
  code in this repo does exactly that, no markup, no extra subscription.
- **Messenger Platform: free.** Meta doesn't charge per-conversation for
  Messenger the way it does for WhatsApp.

## Conversions API, Pixel, Open Graph — do you need these now?

Short answer: **skip the first two for now, Open Graph is already done.**

- **Meta Pixel / Conversions API** — these track website visitors and ad
  performance, for when you're running Facebook/Instagram ads. They have
  nothing to do with the chatbot working. Add them later if/when you
  actually start advertising; they add setup complexity and API review
  steps you don't need for a working product today.
- **Open Graph** — just the meta tags that make your link look right
  when shared on WhatsApp/Facebook/Twitter. Already added to
  `frontend/index.html`, using `docs/marketing-banner.png` as the
  preview image. Nothing left to do here.

## Setting up WhatsApp Cloud API (free, test mode — no business verification needed yet)

1. Go to [developers.facebook.com](https://developers.facebook.com), log
   in with your own Facebook account, create a Meta Developer account
   (free).
2. **My Apps → Create App → use case "Other" → type "Business."**
3. In your new app's dashboard, **Add Product → WhatsApp → Set up.**
4. Meta gives you a **free test phone number** and a **temporary access
   token** immediately — no business verification needed yet. You can
   add up to 5 of your own personal numbers as verified recipients and
   send/receive real messages right away.
5. Note down: the **Phone Number ID** (shown on the API Setup page) and
   the **access token**. These go into this platform's dashboard under
   Channels → WhatsApp (once that credential form is added — see below).
6. **Configure the webhook**: still on the WhatsApp product page →
   Configuration → Webhook → Edit. Set:
   - Callback URL: `https://api.yourdomain.com/api/webhooks/whatsapp`
   - Verify token: any string you make up (put the *same* string in
     this platform's Channels page so the two match)
   - Subscribe to the `messages` field.
7. Meta will call your callback URL once with a GET request to confirm
   it — this repo's webhook route already handles that handshake
   (`whatsappCloudHandler.verifyWebhook`).

**This all works with zero business verification and zero cost**, good
enough for your live preview and testing with your own phone. Business
verification (needed to message the general public beyond your 5 test
numbers) is a separate, still-free step you do later when you're ready
to launch for real.

## Setting up Messenger (also free)

1. Same Meta app → **Add Product → Messenger → Set up.**
2. Connect a Facebook Page you admin (create a free one if needed).
3. Generate a **Page Access Token** on the Messenger product page.
4. Webhook: Callback URL `https://api.yourdomain.com/api/webhooks/messenger`,
   same verify-token idea as WhatsApp, subscribe to the `messages` field.
5. While the app is in development mode, only Page admins/testers can
   message the bot — fine for your live preview.

## What's already built vs. what still needs the dashboard form

`backend/src/channels/whatsapp/whatsappCloudHandler.js` and
`.../messenger/messengerHandler.js` are complete and tested against a
real database (see `scripts/test-channel-creds.js`-style checks). The
API endpoint to save credentials exists too:
`POST /api/channels/:channel/credentials` with `{ accessToken,
phoneNumberId | pageId, webhookVerifyToken }`. What's left is a small
form on the Channels page in the dashboard so you don't have to call
that endpoint by hand with curl/Postman while testing — ask if you'd
like that added next.
 next [fanchatbot-production-deployment-guide-with-cloudflare.md]("/blog/fanchatbot-production-deployment-guide-with-cloudflare.md/")
