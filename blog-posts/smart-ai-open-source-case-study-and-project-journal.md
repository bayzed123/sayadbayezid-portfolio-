---
Title: "smartflow-ai-case-study-and-project-journal"
slug: "smart-ai-open-source-case-study-and-project-journal"
Description: "Written to be read cold, months from now, by you or whoever you hand
this to If you forget everything else, read Quick Status and The
Account Map those two sections will get you oriented fastest"
image: "https://sayadbayezid.com/blog-posts/images/marketing-banner.png"
date: "2026-07-27"
author: "Sayad Md Bayezid Hosan"

---
## Quick Status (as of this writing)

**Working and verified:**
- Backend logic (encryption, database, AI routing with failover, order
  capture) — tested twice: once as a Node.js/Express app, once again
  as a full Cloudflare Workers rewrite. Both passed real integration
  tests against a live database.
- Meta Pixel — confirmed live and recording real events (3 PageViews
  seen in Events Manager) on `sayadbayezid.com`.
- WhatsApp Cloud API setup — a clean test number exists
  (Phone Number ID `1223636920832591`) under a fresh, unrestricted
  business portfolio, with a verified recipient and a generated token.

**Not working / unresolved:**
- **WhatsApp test messages never actually arrived on the phone**,
  despite the send action showing "Completed" on Meta's side, across
  three different verified recipient numbers. Root cause was never
  found — we never got to see the *raw* API response (only the
  simplified webpage checkmark), which is the one piece of evidence
  that would explain it. **This is the single most important loose
  end** — pick this up first if you come back to this project.
- The Cloudflare Workers project `smartflowai` had a build failure
  (duplicate folder + missing config) — a fix was written, but it was
  never confirmed whether it was actually pushed to GitHub.
- The marketing/sales site (`marketing/` folder) is built and tested
  locally but was not deployed live by the end of this session.
- The Workers-native backend (`backend-workers/`) needs a TiDB Cloud
  account created and wired up — this wasn't done yet either.

---

## What This Project Is

**SmartFlow AI** (project folder name: `fanchatbot-system`) is a
multi-tenant "Bring Your Own Key" AI automation platform. Tenants
connect WhatsApp, Messenger, Telegram, and Email, and plug in their
own OpenAI/Gemini/Groq/Manus API key — the platform routes messages
through that key, handles failover if one provider goes down, and
captures confirmed orders automatically. The business plan is to sell
this as a product — a lifetime-deal-style offer, advertised via
Facebook, similar in spirit to sites like BotCommerce's lifetime deal
page (which is what the marketing site's visual style was modeled on,
though with entirely original copy and no fabricated testimonials).

## What's Been Built, and Where

| Folder | What it is | Status |
|---|---|---|
| `backend/` | Original Node.js/Express backend. Needs a VPS. | Fully built and tested. Superseded by `backend-workers/` once budget became a constraint. |
| `backend-workers/` | Cloudflare Workers rewrite — no VPS needed, uses Hyperdrive to reach a MySQL-compatible database. | Built and verified end-to-end against a live database. **Needs a real TiDB Cloud database wired in before it can go live** — see its README. |
| `frontend/` | The dashboard app tenants log into (add API keys, connect channels, view orders). | Built, tested, not yet deployed live. |
| `marketing/` | The public sales page — lifetime deal pricing, Facebook Pixel wired in. | Built, tested locally, Pixel ID confirmed correct. Not yet deployed. |
| `docs/` | This file, plus `DEPLOYMENT.md` (Cloudflare setup) and `CHANNELS.md` (WhatsApp/Messenger setup + real costs). | Reference material — read these before repeating steps from scratch. |

Each folder has its own README with exact setup commands — this
document is the map that ties them together, not a replacement for
them.

---
!Image[WhatsApp Cloud API Setup Guide and Integration Costs](https://sayadbayezid.com/blog-posts/images/workflow-diagram.png)
## Key Decisions Made, and Why (so you don't re-litigate these)

1. **Official WhatsApp Cloud API and Messenger Platform, not the
   unofficial `baileys` library.** Baileys is free and doesn't need
   Meta approval, but it violates WhatsApp's Terms of Service and
   carries real ban risk — not something to build a paying product on.
2. **Cloudflare Workers instead of a VPS**, once "no budget for a
   server" became the actual constraint. This meant a genuine backend
   rewrite (Express → Hono, Node's `crypto` → Web Crypto, direct MySQL
   → Hyperdrive) rather than just redeploying the same code elsewhere.
3. **CSV instead of `.xlsx` for order exports in the Workers version.**
   `exceljs` depends on Node internals that aren't guaranteed to work
   in the Workers runtime. CSV needs no dependencies and Excel opens
   `.csv` files natively — same practical result, zero risk.
4. **No fabricated testimonials on the marketing site.** The
   testimonials section is a clearly-marked placeholder until there
   are real customers — inventing fake quotes would be deceptive
   advertising, full stop.
5. **A fresh Meta Business Portfolio ("CWB BD Agency") instead of
   fighting the original one.** See the Account Map below for why.

---

## The Account Map (read this before creating anything new on Meta)

This project's Meta/Facebook setup got genuinely confusing over the
course of one long session, because of two separate, unrelated
problems stacking on top of each other. Here's the untangled version:

### Business Portfolios
- **"Connect With Bayezid"** (Business Portfolio ID `525659053540933`)
  — your original, established portfolio. Two known problems here:
  1. **A domain typo** — `syedbayezid.com` was registered instead of
     the correct `sayadbayezid.com`, due to phone keyboard autocorrect.
     Reported to Meta support multiple times over ~6 months; each time
     told it'd auto-resolve in 24–48 hours. It hadn't, as of this
     session. A fresh report was filed again during this session.
  2. **WhatsApp Business Account restricted** — every WABA created
     under this portfolio (including a brand-new one with zero
     activity) showed the identical message: *"restricted due to
     activity that does not comply with WhatsApp's Business Terms of
     Service."* Since a zero-activity account got flagged too, the
     restriction is most likely on the **portfolio itself**, not on
     any individual WhatsApp number.
- **"CWB BD Agency"** — a brand-new, clean portfolio created
  specifically to route around the restriction above, since it wasn't
  resolving. **This is the portfolio to keep using** for WhatsApp/
  Messenger work until (if ever) the original one gets sorted out.

### Meta Developer Apps
You have/had roughly seven apps from earlier learning experiments
(names like "Connect with Bayezid," "CWB API," "Genz Frontier," etc.)
— these are mostly unused clutter, safe to ignore or delete later.
The two that actually matter:
- **"smartGen"** — created under the CWB BD Agency portfolio. This is
  the one with the working WhatsApp test setup. App ID not critical to
  remember; find it via My Apps → smartGen.
- Earlier attempts were made under an app also confusingly named
  similarly, tied to the *restricted* portfolio — abandoned in favor
  of smartGen.

### WhatsApp Test Numbers (for reference — these expire/reset regularly)
- `837071722828840` — first test Phone Number ID, created under the
  **restricted** portfolio. Do not reuse; abandoned.
- `1223636920832591` — second test Phone Number ID, created fresh
  under **CWB BD Agency** (the clean portfolio). This is the one with
  a verified recipient and a working token — **this is the one to
  debug the delivery issue with**, not the first one.
- Verified test recipients added: your own number (`01519601517`),
  your personal number (`01791527854`), and your mother's number
  (`01726103471`) — all three OTP-verified, none received a message
  despite "Completed" showing on the send action. This is the open
  bug described in "Quick Status."

### Meta Pixel
- **Pixel ID `1612338809888151`** ("Connect With Bayezid" dataset) —
  already wired into `marketing/index.html`, already confirmed
  recording real PageView events. This one is fine to keep using even
  though it's under the restricted portfolio's business — Pixel/ads
  tracking is unrelated to the WhatsApp Commerce Policy restriction.

### GitHub & Cloudflare
- Repo: `github.com/bayeziddev/smartflow.ai`
- Cloudflare Workers project: **`smartflowai`** — had a build failure
  traced to (a) a duplicate `fanchatbot-system/` folder nested inside
  the repo, and (b) no `wrangler.jsonc` present. A fix (remove the
  duplicate folder, add a `wrangler.jsonc`, set Root Directory to
  `frontend` in the dashboard) was written out in full but **never
  confirmed as actually applied** — check this first if `smartflowai`
  still shows the Cloudflare default placeholder page.
- Direct-upload alternative: a pre-built, ready-to-drag-and-drop zip
  of the marketing site was also provided as a faster path that
  sidesteps the git/build-pipeline issues entirely.

---

## Open Issues, Prioritized

1. **Find out why WhatsApp messages aren't delivering.** Next time you
   test a send from the API Setup page, copy the *raw* response text/
   JSON shown after clicking Send (not a screenshot of the pretty UI)
   — that's the one piece of diagnostic evidence this session never
   captured.
2. **Confirm whether the `smartflowai` git fix was pushed.** Check
   `github.com/bayeziddev/smartflow.ai` for whether `fanchatbot-system/`
   (the duplicate folder) is gone and `frontend/wrangler.jsonc` exists.
3. **Set up TiDB Cloud + Hyperdrive** for `backend-workers/` (see that
   folder's README) — this is the last step before the no-VPS backend
   can go live.
4. **Deploy the marketing site** — either via the git-based Cloudflare
   Pages flow, or the faster direct-upload zip approach.
5. Consider submitting the domain-typo report through Meta Business
   Help Center's direct chat/email support, not just the in-app
   "report an error" form, if the automated queue keeps not resolving
   it.

---

## What Was Deliberately Left Out (and why)

- Real API keys, tokens, and passwords shared during this build
  session are **not** recorded anywhere in this document, even though
  some were pasted into the chat at various points. Treat anything
  that was visible in chat as compromised on principle — regenerate it
  before relying on it, regardless of what it was.
- Fake customer testimonials — see "Key Decisions" above.
- Byte-for-byte duplication of each sub-project's README — this
  document is the index, not a copy. Go to the actual README when you
  need setup commands.
- 📍Next [two different integrations exist in this codebase](/whatsapp-cloud-api-setup-guide-and-integration-costs.md)
