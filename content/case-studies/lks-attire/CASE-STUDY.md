# Lk's Attire — a women's fashion store from Tangail, and the template behind the next one

**A women's clothing brand in Tangail needed a real shop: one that speaks Bangla and English, understands Bangladeshi addresses, takes Cash on Delivery and mobile wallets, and gives the owner a dashboard to change everything — the logo, the offers, the bKash number — without calling a developer. It also had to be built so the same code could become the next client's shop with a different look.**

This is what was built, how it works, and what the tests found on the way.

| | |
|---|---|
| **Client** | Lk's Attire — Akurtakur Para, Tangail · *Style With A Signature* |
| **Try it** | [Online shop demo](https://demu.sayadbayezid.com/d/lks-attire-shop/) · [Admin dashboard demo](https://demu.sayadbayezid.com/d/lks-attire-admin/) (opens signed in) |
| **Role** | Sole developer — architecture, backend, frontend, brand design, DevOps, testing, documentation |
| **Stack** | TypeScript · Hono · Cloudflare Workers, D1, KV, R2 · vanilla ES modules · GitHub Actions · Vitest · Playwright |
| **Integrations** | Steadfast · Pathao · RedX · bKash (manual and Tokenized) · Nagad · Rocket · SSLCommerz · SMS · WhatsApp · email · Bangladesh-geocode data |
| **Scale of the codebase** | ~110 API endpoints, 2 migrations, ~8,400 lines across the Worker, storefront and dashboard, plus 1,400 lines of documentation |
| **Automated checks** | 73 Vitest tests in the Workers runtime and a Playwright suite on desktop and phone, gating every deploy |

> **About the figures in the screenshots.** The orders, revenue and customers were produced by placing 46 orders through the shop's own API against the real catalogue, then moving them through the admin pipeline. They are the system's own arithmetic, captured from a running browser — **not** the client's trading figures. Names and phone numbers are invented.

---

## Contents

1. [The brief](#1-the-brief)
2. [One Worker, three stores of data](#2-one-worker-three-stores-of-data)
3. [One brand file, many shops](#3-one-brand-file-many-shops)
4. [The storefront](#4-the-storefront)
5. [A checkout that understands Bangladeshi addresses](#5-a-checkout-that-understands-bangladeshi-addresses)
6. [Prices, discounts and delivery are decided by the server](#6-prices-discounts-and-delivery-are-decided-by-the-server)
7. [Invoice numbers, SKUs and order tracking](#7-invoice-numbers-skus-and-order-tracking)
8. [Finding a customer from anything you know about them](#8-finding-a-customer-from-anything-you-know-about-them)
9. [The dashboard](#9-the-dashboard)
10. [Everything the owner can change without a developer](#10-everything-the-owner-can-change-without-a-developer)
11. [Built for the phone](#11-built-for-the-phone)
12. [Security](#12-security)
13. [The tests, and the bugs they caught](#13-the-tests-and-the-bugs-they-caught)
14. [A pipeline that builds its own infrastructure](#14-a-pipeline-that-builds-its-own-infrastructure)
15. [A demo that runs the real code in the browser](#15-a-demo-that-runs-the-real-code-in-the-browser)
16. [What was delivered](#16-what-was-delivered)

---

## 1. The brief

Lk's Attire sells party wear — organza three-pieces, embroidered kurtis, gowns — to women across Bangladesh. The brand already had an identity: a black circular logo with a gold "LK" monogram, the line *Style With A Signature*, and a Facebook page full of photo shoots. What it did not have was a shop.

The brief arrived as an A–Z specification, and five requirements shaped every decision:

- **Bangla first, English one tap away.** Every screen, message and error in both languages.
- **Addresses the way Bangladesh writes them.** Division, district, upazila and a free-text area — and a delivery fee that depends on where the parcel is going.
- **Cash on Delivery by default,** with bKash, Nagad and Rocket for customers who pay first, and card payments ready to switch on.
- **The owner changes everything.** Logo, top banner, offer strip, coupons, the bKash number, delivery fees, SMS wording — all from a dashboard, all without a deploy.
- **A template, not a one-off.** The same code had to become another client's shop, with their own colours, fonts and layout, without forking the logic.

---

## 2. One Worker, three stores of data

![System architecture](images/lks-00-architecture.svg)

The entire system is **one Cloudflare Worker** written in TypeScript with Hono. It serves the storefront and the admin dashboard as static assets and answers about 110 API endpoints under `/api`. Behind it:

- **D1** (SQLite at the edge) holds the catalogue, orders, customers, delivery zones, coupons, reviews, staff and the audit log.
- **KV** holds sessions, one-time codes, rate-limit counters and a settings cache.
- **R2** holds product photographs. When R2 is not enabled on the account, uploads fall back to KV, so a new client can launch before their billing is sorted.

The frontends are plain ES modules with an auto-escaping HTML template helper — no framework to download, no build step for the shop's own code, and nothing that can inject markup a customer typed into a review.

Three consequences worth naming:

**Cost.** At this shop's volume everything sits inside Cloudflare's free tiers. The client pays for a domain.

**Speed on a phone.** The storefront's JavaScript is a few small modules, product pages get their SEO tags and JSON-LD rewritten in at the edge with `HTMLRewriter`, and photos are resized in the browser before they are ever uploaded.

**One repository.** Storefront, dashboard, API, migrations, tests and documentation live together. A change to how an order is priced is one pull request, and CI tests it end to end.

---

## 3. One brand file, many shops

Everything that makes this shop *Lk's Attire* lives in one file: `brands/lks-attire/brand.json`. Name and tagline in both languages, four colour palettes, fonts, the hero style, the woven "taant" motif that separates sections, contact details, map, social links, categories, delivery zones and the starting catalogue.

A build script turns that file into the theme (CSS variables), the admin's colours, the PWA manifest, SEO metadata, `robots.txt`, the Open Graph image, placeholder product art and the seed SQL. It validates the file first — every palette needs all sixteen colour tokens, the order prefix must be two to five capitals — and stops with a plain error rather than shipping a half-branded shop.

The design for Lk's Attire was taken from the logo: **Signature Noir** — near-black, the logo's gold, and a rani pink from the product photography — with Cormorant Garamond for display type, Hind Siliguri for Bangla, and Great Vibes for the signature line. The cover was recomposed from the client's own shoot into three gold-edged arches.

A second, deliberately different brand ships in the repository as a template, so onboarding the next client is copying a folder and editing a file. The documented estimate is about thirty minutes to a first preview.

---

## 4. The storefront

The shop opens on the noir hero, the client's own photography in arched frames, and a scrolling offer strip the owner writes from the dashboard. The announcement bar above it is a setting too.

![Storefront home](images/lks-01-storefront-home-hero.webp)

Categories are database rows, shown as arches that echo the logo. New arrivals and a festive banner follow, all managed from the dashboard.

![Categories and offers](images/lks-02-storefront-categories-and-offers.webp)

Product cards carry a discount badge when a product is on offer and a *Free delivery* tag when it ships free. Both come from the product record, so a badge can never promise something the checkout will not honour.

![Product grid](images/lks-03-storefront-product-grid.webp)

The shop page filters by category (including sub-categories), size, colour, price range and "on sale", and sorts by newest, popularity, price or discount. Filters live in the URL, so a filtered view can be shared in a Facebook comment.

![Shop with filters and sorting](images/lks-04-shop-filters-and-sorting.webp)

The product page has the gallery, colour swatches, sizes that disable themselves when out of stock, the price for the chosen variant, and three ways to commit: add to cart, buy now, or ask about it on WhatsApp with the product already in the message.

![Product detail](images/lks-05-product-detail.webp)

A size chart opens in place, because "will it fit?" is the question that loses the most sales.

![Size guide](images/lks-06-product-size-guide.webp)

The cart is a drawer, and it survives a refresh.

![Cart drawer](images/lks-07-cart-drawer.webp)

Every word is available in Bangla. The language is a toggle in the header, remembered per visitor, and the server answers errors in whichever language the customer is using.

![The storefront in Bangla](images/lks-12-storefront-in-bangla.webp)

---

## 5. A checkout that understands Bangladeshi addresses

Most checkouts in Bangladesh ask for a division, then a district, then an upazila — three dropdowns with hundreds of entries between them, on a phone.

This one lets the customer type **a postcode or a place name, in either language** — `1900`, `Mirzapur`, `মির্জাপুর` — and fills in all three.

![Area search at checkout](images/lks-08-checkout-area-search.webp)

It runs on data from the open [Bangladesh-geocode](https://github.com/bayeziddev/Bangladesh-geocode) dataset: 8 divisions, 64 districts, 494 upazilas, and 1,344 postcodes matched to their district (805 down to the upazila). The moment the address resolves, the delivery zone and fee appear, along with the delivery time and the free-delivery threshold.

![Address filled in with the delivery zone](images/lks-09-checkout-address-filled-and-delivery-zone.webp)

Delivery zones are the owner's to edit. The most specific rule wins — an upazila rule beats a district rule, which beats the default — so "inside Tangail town" can cost ৳50 while the rest of Tangail district costs ৳80, Dhaka ৳100 and everywhere else ৳130.

Payment is Cash on Delivery by default. For bKash, Nagad and Rocket, the checkout shows the shop's number, the exact amount to send and a field for the transaction ID. The numbers are settings, and the TrxID is recorded against the order for staff to verify.

![Paying with bKash and a transaction ID](images/lks-10-checkout-bkash-with-trxid.webp)

bKash's Tokenized checkout and SSLCommerz card payments are built in and switch on when their keys are added. Their callbacks verify themselves with the provider rather than trusting what the browser says happened.

---

## 6. Prices, discounts and delivery are decided by the server

The browser sends variant IDs and quantities. It never sends a price, and the server never reads one.

Everything that changes what a customer pays is resolved on the server at the moment of the quote and again at the moment of the order:

1. **The product's discount** — none, a percentage, a fixed taka amount, or a sale price typed by hand.
2. **Variant pricing** — an XXL can cost more than an M.
3. **Coupons** — percentage or fixed, with a minimum order, a cap, start and end dates, a usage limit, a per-customer limit counted by phone number, and optional restriction to categories *including their sub-categories*.
4. **Delivery** — the zone fee, the zone's free-delivery threshold, and each product's own delivery rule.

That last one was a late request from the owner: some products should ship free, some should carry a fixed charge. The rule the system settled on is simple enough to explain on the product page: **a cart pays the highest delivery charge among its items**, so delivery is free only when everything in it ships free. A free-delivery saree on its own ships free to Dhaka; add a normal kurti and the Dhaka fee comes back.

In the product editor the owner picks the discount type and the delivery rule from two dropdowns, and a **live preview** shows exactly how the product will appear in the shop — price, strike-through, badge, delivery label — as they type.

![Product editor with live preview](images/lks-25-admin-product-editor-live-preview.webp)

![Discount and delivery options](images/lks-26-admin-discount-and-delivery-options.webp)

The discount is stored as a rule *and* turned into a sale price on save, so the shop, the cart, reports and search-engine price markup all read the same number, and none of them had to learn about discount types.

Stock is protected the same way. An order is written as one D1 batch — order, lines, stock decrements, inventory log, status history — and the stock column carries `CHECK (stock >= 0)`. If two customers race for the last piece, the database refuses the second batch and the customer is told, in their language, that it just sold out. Overselling is not something the code tries to avoid; it is something the database cannot record.

---

## 7. Invoice numbers, SKUs and order tracking

Every order gets two identifiers: an order number for the customer (`LKS-260926-FM3M`) and a sequential **invoice number** for the business (`INV-2609-00047`). The invoice number is shown on the confirmation page, in the order SMS, on the printed invoice and shipping label, and it works in order tracking.

![Order confirmed, with the invoice number](images/lks-11-order-confirmed-with-invoice-number.webp)

The customer follows the parcel on a timeline — placed, confirmed, packed, on the way, delivered — with the courier's tracking link once it ships. A guest does not need an account: the confirmation link carries a private token, and anyone else needs the order number *and* the phone number it was placed with.

![Order tracking](images/lks-13-order-tracking.webp)

Every product and every size-and-colour variant has a **unique SKU**. Leave it blank and one is generated (`LKS-0042-XL-RED`); type one that another product uses and the editor says so, in both languages. Each order line keeps the SKU it was sold under, so an invoice stays correct even if the product is renamed later.

![Variants with SKUs](images/lks-27-admin-variants-with-sku.webp)

Adding invoice numbers and SKUs to a database that already had orders needed a migration that could run against live data. It backfills invoice numbers for existing orders, fills blank SKUs, renames any duplicates — including ones that differ only by letter case — and only then adds the unique indexes. It was rehearsed against a copy seeded with exactly those problems before it went anywhere near production.

---

## 8. Finding a customer from anything you know about them

A customer calls. They might quote the invoice number, the order number, their phone number — with or without `+880` — their name, the bKash TrxID, or the courier's tracking number. The search box at the top of every admin screen accepts all of those.

![Searching by phone number](images/lks-22-admin-search-by-phone.webp)

Results are grouped: matching orders (with invoice number, phone and status), the customer with how many orders they have placed, and products matched by any variant's SKU.

![Searching by invoice number](images/lks-23-admin-search-by-invoice.webp)

---

## 9. The dashboard

The admin is a soft-UI, three-pane layout in the purple-to-pink gradient the brief asked for: navigation on the left, the work in the middle, notifications and who else is online on the right. It collapses to one column on a phone.

The dashboard opens on the numbers the owner checks first — today's orders and sales against yesterday, this month against last, orders waiting for a confirmation call and how many are Cash on Delivery, low stock, new customers — with a twelve-month sales chart and the month's best sellers.

![Dashboard](images/lks-19-admin-dashboard.webp)

**Orders** move through a pipeline — pending, confirmed, packed, shipped, delivered — with returned and cancelled as exits. The status buttons only offer the moves that are allowed from where the order is. Cancelling or returning puts the stock back and logs it. Each step can send the customer an SMS, WhatsApp message or email in the language they ordered in.

![Orders](images/lks-20-admin-orders-pipeline.webp)

The order view has everything needed for the confirmation call: the customer's history ("3 orders, 1 cancelled/returned" is flagged, because it predicts a refused parcel), one-tap call and WhatsApp buttons, the items with SKUs, the coupon, and buttons to print an invoice or a shipping label with the COD amount in large type.

![Order detail](images/lks-21-admin-order-detail.webp)

**Products** show stock health at a glance, import and export as CSV (with a guard against spreadsheet formula injection), and can be duplicated as a draft.

![Products](images/lks-24-admin-products.webp)

**Inventory** lists every variant with quick ±1/±5 adjustments, low and out-of-stock filters, and a log of every change with who made it and why.

![Inventory](images/lks-28-admin-inventory.webp)

**Categories** nest and reorder by dragging.

![Categories](images/lks-29-admin-categories.webp)

**Customers** shows each person's orders and spend, and a customer can be blocked from ordering — matched by phone, the one identifier Cash on Delivery customers always give.

![Customers](images/lks-30-admin-customers.webp)

**Reports** break sales down by day, week or month, with best customers and courier performance, and export to CSV.

![Reports](images/lks-35-admin-reports.webp)

**Reviews** wait for approval before they appear, and the owner can reply publicly.

![Reviews](images/lks-33-admin-reviews.webp)

---

## 10. Everything the owner can change without a developer

The brief was explicit: the offer banner, the top banner, the logo, the bKash number, the offers — all changeable.

**Settings** covers the store's name, tagline, phone, WhatsApp, email, opening hours and address in both languages; the logo; Facebook, Instagram and TikTok links; the announcement bar; which payment methods are on and their numbers; courier choice; and the wording of every customer message, with placeholders such as `{name}`, `{invoice_no}` and `{tracking}`.

![Settings](images/lks-38-admin-settings-branding.webp)

**Homepage banners** manage the hero slides, the festive banner and the offer strip, each with a schedule, in both languages.

![Homepage banners](images/lks-32-admin-homepage-banners.webp)

**Coupons** are created, limited and switched off here.

![Coupons](images/lks-31-admin-coupons.webp)

**Delivery zones** set the fee, the free-delivery threshold, the districts and upazilas each zone covers, and the delivery time customers are told.

![Delivery zones](images/lks-34-admin-delivery-zones.webp)

The settings API refuses to store anything that looks like an API key. Secrets belong in Cloudflare's encrypted secrets, not in a database row that a dashboard can display.

The dashboard speaks Bangla as fluently as the shop does, and ships with a help centre of short, task-shaped answers — *a customer paid by bKash and sent a TrxID*, *I deleted something by mistake* — written for the people who will actually run it.

![Dashboard in Bangla](images/lks-40-admin-dashboard-bangla.webp)

![Help centre](images/lks-39-admin-help-center.webp)

---

## 11. Built for the phone

Almost every customer arrives on a phone, usually from Facebook. The storefront is designed for a 390-pixel screen first: a bottom navigation bar, a floating WhatsApp button, large tap targets, and a checkout where the postcode search does the work of three dropdowns. The Playwright suite also opens the dashboard's main screens at phone width and fails the build if any of them scrolls sideways.

| | | |
|---|---|---|
| ![Mobile home](images/lks-15-mobile-home.webp) | ![Mobile product](images/lks-16-mobile-product.webp) | ![Mobile checkout](images/lks-18-mobile-checkout-postcode.webp) |

The dashboard works on a phone too, because the owner confirms orders from wherever they are.

| | |
|---|---|
| ![Admin on a phone](images/lks-41-admin-mobile-dashboard.webp) | ![Orders on a phone](images/lks-42-admin-mobile-orders.webp) |

---

## 12. Security

The security model is written up as a runbook organised around the NIST Cybersecurity Framework — who owns what, what is protected, how an incident is contained, how a backup is restored — so it outlives the developer.

- **Passwords** are hashed with PBKDF2-SHA256 at 100,000 iterations using the platform's WebCrypto, compared in constant time.
- **Sessions** are random 256-bit tokens held in KV, in `HttpOnly`, `Secure` cookies — `SameSite=Strict` for staff.
- **Every admin route checks a permission**, not a role name. Four roles — super admin, manager, order processor, viewer — map onto 35 permissions, and the matrix is visible in the dashboard. An order processor can move an order along; they cannot change a price.

![Staff and roles](images/lks-36-admin-staff-and-roles.webp)

- **Cross-site requests** are refused unless they come from the shop's own origin with a custom header; payment and courier callbacks are exempt and verify themselves with the provider.
- **Input** is validated with zod on every endpoint, SQL is always parameterised, and both frontends escape everything they render. A strict Content Security Policy allows no inline scripts.
- **Rate limits** protect sign-in, checkout, password reset, reviews and tracking. Five failed staff sign-ins from one address sends the owner an SMS.
- **Everything is logged.** Every create, update, delete, restore, status change, refund, import, export and sign-in, with who did it and from where.

![Activity log](images/lks-37-admin-activity-log.webp)

Deleted products, orders and records go to a trash first. Only a super admin can purge.

---

## 13. The tests, and the bugs they caught

73 Vitest tests run inside the real Workers runtime against a real D1, KV and R2, with the actual migrations applied. They cover pricing, zone resolution, coupon rules, the order pipeline, stock, permissions, SKUs, invoice numbers, discounts, delivery rules and search. The Playwright suite runs the shop and dashboard on a desktop and a phone: browse, filter, buy, confirm an order in the admin, fill an address from a postcode, and check that nothing scrolls sideways.

Some of what they caught:

- **Invoice numbers came out empty.** SQLite's `strftime` has no two-digit year (`%y`), so the expression returned `NULL` — silently, with no error. The integration test asserting the invoice format failed; the fix builds the year from the ISO date instead.
- **The dashboard went blank when the chart library was slow.** The fallback for a missing chart tried to read a value that was not there and took the whole view down with it. It now shows the figures as a table instead.
- **Menu labels in the admin had dashed borders.** A print stylesheet's `.label` class, meant for shipping labels, was matching the navigation. It was renamed so printing and navigation no longer share a name.
- **The postcode search sometimes ignored fast typists.** On a quick desktop the listener attached after the first keystrokes. The end-to-end test failed intermittently until the search listened immediately and waited for its data instead.
- **The checkout said "Open your paybKash app".** A translation key was built from the wallet's name, and bKash's capital K did not match. It was found while capturing these screenshots, fixed, and the checkout test now asserts the wording for bKash.
- **A demo address read "Dhanmondi, Savar".** The data generator paired neighbourhood names with random upazilas. Small, but the kind of thing a client notices first.

---

## 14. A pipeline that builds its own infrastructure

The client added two secrets to GitHub — a Cloudflare account ID and an API token — and merged the pull request. The pipeline did the rest:

1. Type-check, run the Vitest suite and the Playwright suite. Nothing deploys from a red build.
2. **Create the D1 database, KV namespace and R2 bucket if they do not exist,** and write their IDs into the deployment configuration. Run again, and it finds them instead of duplicating them.
3. Apply database migrations.
4. On the first run only, seed the categories, delivery zones, settings, banners and starter products — later runs never overwrite the owner's edits.
5. Create the first admin account from two more secrets, if no admin exists yet.
6. Deploy, copy any payment, courier and SMS keys into the Worker's encrypted secrets, and run a smoke test against the live URL.

A nightly workflow exports the database as a backup, and D1's point-in-time recovery covers the rest.

One detail from handover: the owner added `ADMIN_USERNAME` rather than an email address. Rather than ask them to change it, sign-in was extended to accept a username or an email, with a test for both. A system should fit the people using it.

---

## 15. A demo that runs the real code in the browser

Future clients want to *use* a shop before they commission one, and a static demo that only looks like the product proves nothing. So the portfolio's demo hub hosts the **real** Lk's Attire code — with no server at all.

The same Worker is bundled for the browser. Its database is SQLite compiled to WebAssembly, its KV is the browser's local storage, and its data is saved to IndexedDB. The shop demo and the admin demo live side by side and share that data: place an order in the shop, and it appears in the admin; confirm it there, and the shop's tracking page moves on. The dates are shifted on first load so the order history always ends today.

Browsers do not allow a script to set a `Cookie` header or read `Set-Cookie`, so the demo hands cookies to the framework directly. The first attempt at sign-in "worked" — and then every following request was anonymous.

- [Open the shop demo](https://demu.sayadbayezid.com/d/lks-attire-shop/)
- [Open the admin demo](https://demu.sayadbayezid.com/d/lks-attire-admin/) — it opens signed in; the sign-in is `demo` / `demo12345`

---

## 16. What was delivered

- **Storefront** — bilingual, mobile-first, with the client's photography; categories, filters and sorting, product pages with variants and a size guide, cart, checkout, invoice numbers, tracking, customer accounts, wishlist, reviews and WhatsApp ordering.
- **A Bangladesh-aware checkout** — postcode and place-name search across 1,344 postcodes, zone-based delivery, COD, bKash, Nagad and Rocket with TrxID, and card payments ready to switch on.
- **Server-side pricing** — per-product discounts, variant pricing, coupons with per-customer limits, and per-product delivery rules, with stock the database will not let go negative.
- **Dashboard** — orders pipeline with invoices and shipping labels, one search box for every customer identifier, products with SKUs and a live preview, inventory, categories, customers, coupons, banners, reviews, zones, reports, staff roles, activity log and settings — all bilingual.
- **Couriers and messages** — Steadfast booking and webhooks, Pathao and RedX tracking, SMS, WhatsApp and email at every stage.
- **Security** — PBKDF2, role-based permissions on every route, CSRF protection, a strict CSP, rate limits, an audit log and a NIST CSF runbook.
- **A brand pipeline** — the same code becomes another client's shop from one file.
- **CI/CD that provisions itself** — tests, then D1, KV and R2 created and bound, migrations, first-run seed, first admin, deploy and smoke test; nightly backups.
- **Documentation** — README, full specification, setup guide, brand pipeline guide, security runbook, and a plain list of the GitHub and Cloudflare secrets the client needs to add.
- **A working demo** of both the shop and the dashboard, running the real code.

---

### Full-page captures

| | |
|---|---|
| [Home](images-fullpage/lks-L01-storefront-home-full-page.webp) | [Product](images-fullpage/lks-L02-product-full-page.webp) |
| [Checkout](images-fullpage/lks-L03-checkout-full-page.webp) | [Mobile home](images-fullpage/lks-L04-mobile-home-full-page.webp) |
| [Dashboard](images-fullpage/lks-L05-admin-dashboard-full-page.webp) | [Settings](images-fullpage/lks-L06-admin-settings-full-page.webp) |
