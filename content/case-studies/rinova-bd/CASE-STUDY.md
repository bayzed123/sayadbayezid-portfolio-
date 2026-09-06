# Rinova BD — a beauty shop built to be advertised

**A beauty retailer in Rajshahi needed more than a website. They needed a shop that could be advertised: pages an ad click can land on and buy from, prices the server guarantees, a Meta pixel that counts each sale once, and a dashboard the owner and their staff can run without a developer standing behind them.**

This is what was built, how it works, and what the test suite found on the way.

| | |
|---|---|
| **Client** | Rinova BD — Malopara, Boalia, Rajshahi |
| **Live at** | [rinovabd.com](https://rinovabd.com) · ad pages on [ads.rinovabd.com](https://ads.rinovabd.com) |
| **Role** | Sole developer — architecture, backend, frontend, design, DevOps, testing, documentation |
| **Stack** | TypeScript · Hono · Cloudflare Workers, D1, R2, KV · GitHub Pages · GitHub Actions · Playwright |
| **Integrations** | Steadfast Courier · bKash · Google Analytics 4 · Google Tag Manager · Meta Pixel + Conversions API · Google Sheets |
| **Scale of the codebase** | 105 API routes, 23 database migrations, ~9,500 lines across the Worker, storefront and dashboard |
| **Automated checks** | 418, across 15 behaviour suites, gating every deploy |

> **About the figures in the screenshots.** Revenue, profit, stock and order numbers were produced by placing real orders through the live pricing engine against a demonstration dataset, then letting the system do its own arithmetic. They are its calculations, captured from a running browser — **not** the client's trading figures.

---

## Contents

1. [The brief](#1-the-brief)
2. [The architecture, and the constraint that shaped it](#2-the-architecture-and-the-constraint-that-shaped-it)
3. [The storefront](#3-the-storefront)
4. [Pricing is a server-side decision](#4-pricing-is-a-server-side-decision)
5. [Checkout, delivery and payment](#5-checkout-delivery-and-payment)
6. [Pages built to be advertised](#6-pages-built-to-be-advertised)
7. [Campaign Studio — the owner builds their own ad pages](#7-campaign-studio--the-owner-builds-their-own-ad-pages)
8. [Counting a sale exactly once](#8-counting-a-sale-exactly-once)
9. [Built for the phone](#9-built-for-the-phone)
10. [The dashboard](#10-the-dashboard)
11. [Staff who can run the shop but not reprice it](#11-staff-who-can-run-the-shop-but-not-reprice-it)
12. [The test suite, and the bugs it caught](#12-the-test-suite-and-the-bugs-it-caught)
13. [Security](#13-security)
14. [Deployment](#14-deployment)
15. [Documentation in Bangla](#15-documentation-in-bangla)
16. [What was delivered](#16-what-was-delivered)

---

## 1. The brief

Rinova BD sells skincare and makeup — serums, face washes, blushes, gift sets — to customers across Bangladesh, almost all of them paying cash when the courier hands the parcel over.

The shop already existed. What it could not do was carry advertising. Money was going into Facebook and Instagram ads, and the clicks were landing on an ordinary product page that asked a customer to browse, add to a bag, open a checkout, and fill in a form. Every one of those steps loses people.

Five requirements shaped every decision that followed:

- **An ad click must be able to become an order on the page it lands on.** Not one hop later.
- **The price shown must be the price charged.** Advertising a number the checkout then contradicts is worse than not advertising at all.
- **Meta must count each sale once.** A pixel and a server-side conversion both reporting the same purchase halves every reported cost per acquisition, and every bid decision made from it is then wrong.
- **The owner has to run it.** Prices, offers, delivery charges, ad pages, staff logins — all of it, without a developer.
- **Staff are not the owner.** Someone processing orders should not be able to change what the shop charges.

---

## 2. The architecture, and the constraint that shaped it

Everything runs on Cloudflare's edge. A single **Cloudflare Worker** is the entire API — routing, authentication, pricing, orders, offers, courier calls, analytics. **D1** is the database. **R2** holds product photography. **KV** caches lookups.

There is one complication worth being honest about, because it dictated real design decisions.

**The domain and the Worker live in different Cloudflare accounts.** Cloudflare only allows a Worker route or custom domain when the zone and the Worker share an account, so the storefront Worker can never be bound to `rinovabd.com` directly. `rinovabd.com` is served by GitHub Pages; the Worker answers the API on its own origin; and a second, deliberately tiny Worker owns `ads.rinovabd.com` inside the domain's account and forwards ad traffic to the storefront Worker.

That constraint is why the ad pages live on `ads.rinovabd.com` rather than the apex domain. It is also why the proxy is restricted to exactly the paths an ad page needs — anything else is redirected to the real shop, so the subdomain never becomes a second storefront competing with the first in search results.

Three consequences worth naming:

**Cost.** At this shop's volume everything sits inside free tiers. The client pays for a domain.

**Latency.** Worker and database both run at the edge, close to the people using them.

**One repository.** Storefront, dashboard and API are one TypeScript codebase. A type describing a product is written once. When a field changes, the compiler finds every place that has to change with it.

---

## 3. The storefront

The shop opens on an editorial hero the owner writes from the dashboard, with the bag count carried in the browser so a refresh never empties it.

![Storefront home](images/01-storefront-home-hero.webp)

Categories are database rows, not markup — added, renamed and reordered from the dashboard.

![Categories](images/02-storefront-categories.webp)

The product grid carries discount badges. The percentage is set on the product record and the sale price is computed server-side, so a badge can never advertise a discount the checkout does not honour.

![Product grid with discount badges](images/03-storefront-product-grid.webp)

The product page is where the buying decision happens: per-size pricing, live price, quantity, and the two ways to commit.

![Product detail](images/04-storefront-product-detail.webp)

Photography opens in a full-screen viewer that animates out of the thumbnail it came from — the image scales from the exact frame it occupied on the page rather than fading in from nothing, which keeps the customer oriented about what they just tapped.

![Full-screen image viewer](images/05-storefront-image-viewer.webp)

Each product carries its own FAQ, written in the dashboard, in Bangla or English.

![Product FAQ](images/06-storefront-product-faq.webp)

The bag is a drawer. Quantity steppers are 44px targets drawn with real characters rather than an icon font, so a blocked or slow script never leaves a customer with a blank square to press.

![Bag drawer](images/07-storefront-bag-drawer.webp)

---

## 4. Pricing is a server-side decision

This is the part of the system with the least room for opinion, so it has the most tests behind it.

The shop supports four things that change a price, and they interact:

1. **Per-size pricing.** A 50g jar and a 100g jar are one product with two prices and two stock counts.
2. **Per-product offers.** A percentage set on the product, with an optional label and end date.
3. **Bulk pricing.** Buy more, pay less per unit, in tiers the owner defines.
4. **Coupons and automatic offers.** Percentage, fixed amount, or free delivery — optionally limited to chosen products, with a minimum basket and a usage limit.

![Bulk pricing in the product editor](images/28-admin-bulk-pricing-and-offer.webp)

Every one of these is resolved on the server, from the product record, at the moment the order is placed. The browser sends SKUs and quantities. It does not send prices, and if it sends them anyway they are ignored — there is a test that places an order claiming a ৳1 unit price for a ৳500 product and asserts the shop charges ৳500.

The same engine prices the preview the customer sees before committing, so the summary and the order cannot disagree.

![Checkout summary with coupon](images/09-storefront-checkout-summary.webp)

---

## 5. Checkout, delivery and payment

Delivery is charged by zone — inside Dhaka or outside — and both rates are settings, not constants in a file. The checkout recalculates as soon as it knows the district.

![Checkout](images/08-storefront-checkout.webp)

Payment methods are switched on and off from the dashboard. Cash on delivery is the default because that is how most of Bangladesh buys; bKash advance is available, with the shop's number and instructions coming from settings.

The courier partner is fixed by the shop rather than offered to the customer as a choice — a small decision that removes a support conversation that has no upside.

Orders can be looked up afterwards by order code, invoice number or phone, with no account required.

![Order tracking](images/10-storefront-order-tracking.webp)

---

## 6. Pages built to be advertised

This is the feature the project was really commissioned for.

An ad landing page is a single page carrying the whole argument for one product — the offer, the proof, the objection handling, the repeated calls to action — and **the order form at the bottom of it**. The customer never leaves.

![Ad landing page](images/11-landing-page-hero.webp)

Two things it deliberately does not do:

**It does not print a price.** The Worker injects the product; the page then confirms the price and the delivery against the shop's own pricing API before the customer commits. Change the price in the dashboard and the ad page changes with it.

**It does not promise free delivery in words.** The free delivery is a real offer record scoped to that product. The banner only appears when the server is genuinely waiving the charge, so the page cannot promise something the order will then contradict.

![Order form on the ad page](images/12-landing-page-order-form.webp)

If the product goes out of stock, the form is replaced by a phone number. A paid click landing on a form the shop cannot fulfil is worse than one landing on the truth.

---

## 7. Campaign Studio — the owner builds their own ad pages

One hand-built landing page is a deliverable. The ability to make more of them without a developer is a product.

Campaign Studio takes a name, a picture, selling points typed one per line, and a tick against the products the ad sells. It generates the link to paste into Meta Ads Manager.

![Campaign Studio](images/34-admin-campaign-studio.webp)

What comes out is not a different, lesser page. It is the same format, running the same code — same layout, same order form, same pricing confirmation, same pixel behaviour.

![A campaign page built in the dashboard](images/13-campaign-page-built-in-studio.webp)

Tick one product and it is a single-product ad. Tick several and the customer chooses, with the summary repricing as they do. Tick none and the page still takes an order, offering a few featured products rather than the whole catalogue — a landing page offering two dozen choices sells none of them.

---

## 8. Counting a sale exactly once

Meta is told about a purchase twice: once by the pixel in the customer's browser, and once by the Conversions API from the Worker. This is deliberate — the browser event can be blocked, the server event cannot — but both describe the same sale.

Both carry the order code as the event ID. Meta collapses the pair into one conversion.

Without that, every purchase is counted twice, every reported cost per purchase is half the real number, and the ad spend decisions made from those numbers are wrong in the direction that costs money.

Google Tag Manager, GA4 and the Meta Pixel are all configured from the dashboard. The Conversions API token stays a Worker secret: it is never written to the database and never rendered into a page.

![Tracking and analytics](images/35-admin-tracking-and-analytics.webp)

---

## 9. Built for the phone

Most of this shop's traffic is a phone, arriving from an ad, often on a connection that is not fast.

![Mobile home](images/14-mobile-home.webp)
![Mobile product](images/15-mobile-product.webp)

The bag drawer was rebuilt for the phone specifically: it takes the whole screen while it is open, and the checkout button stays clear of the bottom tab bar. An earlier version had the tab bar painted over the button — visible, but not tappable, which is the worst kind of broken. There is now a test that fails if anything is painted on top of that button's own centre point.

![Mobile bag drawer](images/16-mobile-bag-drawer.webp)
![Mobile checkout](images/17-mobile-checkout.webp)

The ad pages get the same treatment, because that is where the ad money lands.

![Mobile landing page](images/18-mobile-landing-page.webp)
![Mobile order form](images/19-mobile-landing-order-form.webp)

---

## 10. The dashboard

Sixteen screens, grouped by the job being done rather than by database table.

![Dashboard KPIs](images/22-admin-dashboard-kpis.webp)

Revenue, gross profit, orders, average order value, stock on hand, stock at cost and unrealised profit — every figure computed from the order and product tables. Nothing is typed in.

Delivery charge is deliberately kept apart from product revenue: money collected on behalf of a courier is not the shop's income, and a dashboard that blends the two flatters the margin.

![Finance composition and courier mapping](images/23-admin-finance-and-courier.webp)

Shop health says what needs attention today. The trend panel draws revenue and completed orders over the chosen period.

![Shop health and performance trend](images/24-admin-health-and-trend.webp)

Customer demographics answer a question this owner actually asks: where are the customers? District share is computed from orders placed, not guessed.

![Customer demographics](images/25-admin-customer-demographics.webp)

The product list shows cost and margin beside price and stock, so the owner can see what each line actually earns rather than what it sells for.

![Products with margin](images/26-admin-products-and-margin.webp)

The product editor is Bangla and English throughout.

![Product editor](images/27-admin-product-editor.webp)

Every stock change is recorded with a reason and a note, so a count that looks wrong can be traced to who changed it and why.

![Inventory](images/29-admin-inventory.webp)

The order list carries invoice number, customer, total, payment, courier state and status, with the status colour-coded.

![Orders](images/30-admin-orders.webp)

Tapping the invoice copies the customer's name, phone and full address in one action — exactly the fields a courier booking form asks for, which was previously three separate selections and three chances to paste the wrong thing.

![Copy customer details](images/31-admin-order-copy-details.webp)

There is a till for in-store sales, moving the same stock as the website.

![POS](images/32-admin-pos.webp)

Barcodes are generated and saved onto products in CODE128, EAN-13, UPC or ITF-14, and an invoice can be scanned to pull up the client and what they bought.

![Barcode generator](images/33-admin-barcode-generator.webp)

Content, banners and offers are the owner's.

![Content CMS](images/39-admin-content-cms.webp)
![Marketing and banners](images/40-admin-marketing-banners.webp)

Settings hold the numbers everything else reads.

![Settings](images/38-admin-settings.webp)

One screen deserves specific mention, because of what it refuses to do. The traffic panel shows GA4 data — and when the service account is not connected, it says exactly that. It does not render a plausible-looking chart of numbers nobody measured.

![Traffic and SEO](images/41-admin-traffic-seo.webp)

Reviews only reach a product page if the reviewer actually bought the product.

![Reviews](images/42-admin-reviews.webp)

---

## 11. Staff who can run the shop but not reprice it

The shop needed staff logins. The first implementation had a role column and not much behind it: a staff account could reach 62 of the 66 dashboard endpoints. It could change the delivery charges, invent a ninety-percent coupon, or read the courier API keys.

"Limited access" has to mean the server refuses, not that the dashboard hides the button.

![Staff accounts](images/36-admin-staff-accounts.webp)

Anything that moves money, holds a credential, or reconfigures the shop is now the owner's alone — delivery charges and payment methods, creating or editing a discount, the courier and analytics credentials, the business data exports. Everything needed to actually run the shop stays with staff: orders, stock, products, returns, reviews, customers and the till.

The rule is one list in one place rather than a check scattered through sixty-odd handlers, so what staff may do can be read at a glance and cannot drift as routes are added. The dashboard hides those controls too — but the server is the authority, and every test for this is made with a staff token straight against the API, because a hidden button is not a permission.

Support can issue a customer a temporary password without ever seeing the old one.

![Customer support](images/37-admin-customer-support.webp)

---

## 12. The test suite, and the bugs it caught

The project has 418 automated checks across 15 behaviour suites. They boot the real Worker against a throwaway database, drive a real browser, and gate every deploy: if a check fails, nothing ships.

They are written to assert what a person would notice. Two habits proved their worth repeatedly:

**Measure the thing, not a proxy.** The image viewer test reads the *first painted frame*, so an implementation with no animation cannot pass it. An earlier version checked only the settled position and passed while the feature was missing entirely.

**Prove a control is usable, not merely present.** Checking an element's centre point with `elementFromPoint` catches a button that is on screen but painted underneath something else.

This is what the suite found. Every one of these was live or about to be:

**A customer data leak.** The order lookup endpoint had no authentication and matched on a sequential invoice number. Walking `INV-000001`, `INV-000002`, … returned every customer's name, phone number, email and home address, to anybody. On a Bangladeshi shop that is precisely the material used for fake-COD calls and harassment. It now answers only the dashboard or the customer who placed the order, and says "not found" rather than "not allowed", so it cannot even be used to confirm which invoice numbers exist.

**A login nobody could lock.** The dashboard login counted nothing. Failures are now counted over a fifteen-minute window, per username so one account cannot be ground down, and per caller so an attacker cannot spray one guess each across many usernames. A correct password clears that account's failures, so a few typos never strand the owner.

**Campaign pages that had been rendering empty for months.** The server injected its data into a `<script type="application/json">` block escaped the way surrounding markup is escaped. A script element is raw text — the browser never decodes HTML entities inside it — so `JSON.parse` threw, the page fell back to an empty object, and every campaign rendered with no products, no title and no tracking. Nothing failed loudly. It was found by a test that parses the block rather than checking it exists.

**Product creation was broken.** An `INSERT` named 28 columns and supplied 27 values, so every new product failed with "Something went wrong". Nothing had covered the path the owner actually uses.

**A free-delivery offer that applied to the entire shop.** Free delivery skipped the "is any of this in the basket?" test, which is right for a shop-wide offer and wrong for one scoped to a product. Seeding the combo's own free-delivery offer would have made delivery free on every order the shop took.

**An ad page quoting a price it would not charge.** The campaign page quoted the Dhaka delivery rate while an order from outside Dhaka is charged the outside-Dhaka rate — a customer shown ৳790 could be billed ৳850. The page cannot know which rate applies until the address is typed, so it now names both and holds off calling the total final until an offer actually waives the charge.

The suite also had to be made trustworthy itself. Moving it into CI exposed that it had never really been passing on its own: three suites depended on data that existed only because months of manual use had left it there, and one suite clobbered the delivery charges and only restored them if it reached the end. Every suite now seeds what it asserts on.

---

## 13. Security

- Order lookup is authenticated, and answers "not found" rather than distinguishing between missing and forbidden.
- The dashboard login is throttled per username and per caller address.
- Staff permissions are enforced server-side, from a single list.
- The Meta Conversions API token, courier keys and admin credentials are Worker secrets — never in the database, never rendered into a page.
- Prices, discounts and delivery charges are computed server-side; browser-supplied prices are ignored.
- Campaign copy written by the owner is escaped before it reaches the page.

---

## 14. Deployment

Every push runs the same pipeline: build and typecheck, then the 418 behaviour checks, then — only if both pass — a deploy that applies pending database migrations and publishes the Worker.

The gate is not decorative. It has held back a release more than once during this project, each time for a real defect, and the deploy that follows a green run is the same artefact the tests ran against.

The storefront is published separately to GitHub Pages, and the ad-page proxy is deployed to the domain's Cloudflare account by a manually triggered workflow that requires a typed confirmation phrase — the same pattern used for the launch data reset, so a destructive operation always takes a deliberate act, and always takes a backup first.

---

## 15. Documentation in Bangla

The people running this shop day to day read Bangla. The entire dashboard is documented in Bangla, screen by screen, including how to build an ad campaign and what each button does.

![Bangla guide](images/43-admin-bangla-guide.webp)

The dashboard itself is bilingual throughout — field labels, alerts and the morning checklist are written in both languages, because the owner and the staff do not necessarily read the same one comfortably.

---

## 16. What was delivered

A shop that can be advertised:

- **Storefront** — catalogue, categories, product pages with per-size pricing, full-screen photography, per-product FAQs, verified reviews, bag, checkout, order tracking, customer accounts and a journal.
- **Ad landing pages** — pages an ad click can buy from, priced by the server, with GA4 and a de-duplicated Meta Pixel and Conversions API.
- **Campaign Studio** — the owner builds more of those pages themselves, in the same format, without a developer.
- **Pricing engine** — per-size prices, per-product offers, bulk tiers, coupons and automatic offers, all resolved server-side.
- **Dashboard** — sixteen screens covering revenue and margin, orders, inventory with an audited stock ledger, a till, barcodes, customers, returns, reviews, content, banners, analytics and settings.
- **Roles** — staff who can run the shop without being able to reprice it.
- **418 automated checks** gating every deploy, and a CI/CD pipeline that will not ship a red build.
- **Bangla documentation** for every screen.

---

### Full-page captures

| | |
|---|---|
| [Home](images-fullpage/L01-storefront-home-full-page.webp) | [Product](images-fullpage/L02-product-full-page.webp) |
| [Ad landing page](images-fullpage/L03-landing-page-full-page.webp) | [Campaign page](images-fullpage/L04-campaign-full-page.webp) |
| [Checkout](images-fullpage/L05-checkout-full-page.webp) | [Mobile home](images-fullpage/L06-mobile-home-full-page.webp) |
| [Mobile landing page](images-fullpage/L07-mobile-landing-full-page.webp) | [Mobile product](images-fullpage/L08-mobile-product-full-page.webp) |
| [Dashboard](images-fullpage/L09-admin-dashboard-full-page.webp) | [Product editor](images-fullpage/L10-admin-product-editor-full-page.webp) |
| [Orders](images-fullpage/L11-admin-orders-full-page.webp) | [Bangla guide](images-fullpage/L12-admin-bangla-guide-full-page.webp) |
