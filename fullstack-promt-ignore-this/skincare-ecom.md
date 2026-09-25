# [Your Brand Name] — Skincare & Beauty E-commerce (A–Z Build Prompt)

> Replace `[Your Brand Name]` and `[Your Location]` throughout before using. Example name directions: "Glowna", "Pure Skin Co.", "Dermalayer".

Create a comprehensive, detailed, end-to-end (A–Z) plan and specification — and, where possible, a working implementation — for a full-stack e-commerce website with a fully-featured admin dashboard, for:

- **Brand name:** [Your Brand Name]
- **Business type:** Skincare & beauty retail (cleansers, toners, serums, moisturizers, sunscreen, masks, optionally makeup)
- **Location:** [Your Location], Bangladesh
- **Primary market:** Bangladesh, beauty-conscious and ingredient-aware shoppers, mobile-first, Bangla + English speaking

The system must be built on **Cloudflare** for hosting/runtime (Workers, D1, KV, R2), with source code hosted on **GitHub** and deployed via GitHub Actions — one Cloudflare Worker (Hono + TypeScript) serving both the static storefront/admin app and all `/api/*` routes. The admin dashboard must support full CRUD for every resource below, with validation, confirmation prompts, and success/failure feedback.

The deliverable must include the following:

## 1. Brand, Market & Business Requirements
- Define the brand identity, a short tagline, and a "clean beauty" logo concept direction.
- Target customer: beauty-conscious shoppers who read ingredient lists and care about skin type/concern match, not just price.
- All customer-facing and admin UI text bilingual (Bangla + English) with a language toggle, plain language throughout.
- Business model: Cash on Delivery as default, plus mobile financial services and card payment.
- Feature [Your Location] on the Contact/About page, footer, and structured data.
- Team is small and non-technical — every admin workflow must be operable with no coding knowledge, large touch targets, plain-language labels.
- **Regulatory note:** do not present any product as treating, curing, or preventing a medical condition; keep all claims cosmetic ("brightens," "hydrates," "reduces the look of") rather than medical.

## 2. Public Website — Description & Layout
- **Visual style:** clean, clinical-yet-warm minimalism. Soft sage-green/blush-pink/ivory palette on a white base, generous white space, soft rounded sans-serif typography, subtle botanical/dot-pattern accents — a "clean beauty" look, not a loud one.
- Site map: Home, Shop (category & subcategory), Product Detail, Cart, Checkout, Account (Login/Register, Orders, Wishlist, Addresses), About/Contact, Search Results, optional "Skin Journal" blog.
- **Homepage:** hero banner, category tiles (Cleansers, Serums, Moisturizers, Sunscreen, Masks), new arrivals, best sellers, an ingredient-spotlight block, customer reviews with skin-type tags, newsletter signup, footer with location and policies.
- **Product listing:** filters by category, skin type (oily/dry/combination/sensitive/acne-prone), concern (brightening/anti-aging/hydration/acne), and price; sort by price/newest/popularity/rating.
- **Product detail page:** image gallery, full ingredient list (INCI-style) with 2–3 "hero ingredients" called out, skin-type/concern tags, size/volume selector, price, stock status, Add to Cart/Buy Now, "how to use" steps, patch-test reminder note, customer reviews (optionally with a skin-type filter on reviews), related/upsell products.
- **Optional skin quiz:** a short questionnaire (skin type, main concern, budget) that suggests 3–4 matching products.
- **Cart & checkout:** guest checkout, Bangladesh address form with tiered delivery fee, payment method selection (COD, bKash, Nagad, Rocket, card via SSLCommerz), order summary and confirmation with SMS/WhatsApp notification.
- **Account area:** order history with tracking, wishlist, saved addresses, a simple "my routine" list of previously purchased products.

## 3. Admin Dashboard — Description & Layout
- **Visual style:** soft, clean, minimal — white/cream background, sage-green and blush-pink accents, rounded cards, soft shadows (a lighter, airier soft-UI than a typical dark admin theme).
- **Three-pane layout:**
  - **Left sidebar** (collapsible): Dashboard, Products, Categories, Orders, Customers, Coupons, Reviews, Inventory/Batches, Reports/Analytics, Staff & Roles, System Settings, Help Center.
  - **Center panel:** dashboard home with a monthly sales chart, KPI cards (today's orders, revenue, pending COD, low-stock alerts, batches nearing expiry), recent-orders table, top-selling products.
  - **Right sidebar:** search, admin profile dropdown, notifications (new order, low stock, batch expiring soon, new review), staff online status.
- **CRUD modules:**
  - **Products** — name, bilingual description, category, price, discount, size/volume variants, full ingredient list, skin-type/concern tags, images, status, SEO slug, auto-generated SKU (see Section 5); bulk CSV import/export.
  - **Categories & Subcategories** — nested, drag-to-reorder.
  - **Orders** — line items with SKUs, customer, address, payment method/status, delivery pipeline (Pending → Confirmed → Packed → Shipped [courier + tracking] → Delivered → Returned/Cancelled), **auto-generated invoice number and a printable PDF invoice** (see Section 5), refund handling.
  - **Customers** — profile, order history, block/unblock.
  - **Coupons/Discounts** — percentage/flat, minimum order, expiry, usage limits.
  - **Reviews** — approve/reject/reply, optional skin-type tag on each review.
  - **Inventory & Batches** — per-SKU stock, **batch number and expiry date per stock intake**, low-stock and near-expiry alerts, adjustment log.
  - **Staff & Roles** — Super Admin, Manager, Order Processor, Read-only Viewer.
  - **Reports/Analytics** — sales by category/product/date range, best sellers, CSV export.
  - **System Settings** — store info, delivery zones & rates, payment-gateway keys, notification templates.
  - **Activity/Audit Log.**
- **CRUD interaction requirements:** modal/slide-over create-edit forms; inline bilingual validation; confirmation dialog before delete (soft-delete/trash); toast success/failure notifications; role-based hiding of restricted actions; search/filter/pagination on every list.

## 4. Full-Stack Architecture
One Cloudflare Worker (Hono + TypeScript) serves the storefront/admin assets and all `/api/*` routes, backed by D1, KV, and R2. GitHub is the source of truth and CI/CD pipeline (GitHub Actions deploys on push to `main`); Cloudflare is the runtime. Provide a Mermaid architecture diagram showing browsers → Worker → D1/KV/R2, outbound calls to payment/courier/notification providers, and the GitHub → Actions → Cloudflare deploy path.

## 5. Data Models
Provide schema tables for: `products`, `product_variants`, `categories`, `orders`, `order_items`, `customers`, `addresses`, `reviews`, `coupons`, `admins`, `inventory_batches`, `delivery_zones`.

**SKU & Invoice Numbering (required):**
- Every product variant gets an auto-generated, unique **SKU** on creation, editable if needed, following a pattern such as `SKN-[CategoryCode]-[SizeML]-[Sequence]` (e.g. `SKN-SRM-30ML-0042`). Enforce uniqueness at the database level.
- Every confirmed order gets an auto-generated, unique, sequential **invoice number**, e.g. `INV-SKN-YYYYMMDD-####`, generated at order confirmation. Provide a downloadable/printable PDF invoice per order with itemized SKUs, quantities, unit prices, discounts, delivery fee, and total.
- Each `inventory_batches` row tracks a batch/lot number and expiry date tied to a SKU, so stock can be sold oldest-batch-first and flagged before it expires.

Include one worked example: an **Order** model as a TypeScript interface, including `sku` on each line item and an `invoiceNumber` field on the order.

## 6. Payments, Delivery & Third-Party Integrations
- Payments: COD, bKash, Nagad, Rocket, card via SSLCommerz (or similar).
- Delivery: Steadfast as primary courier, Pathao Courier and RedX as alternatives; tracking-ID sync and status webhooks.
- Live delivery-fee calculation by Division/District/Upazila.
- SMS/WhatsApp order-confirmation and status-update notifications.
- Optional: Cloudflare Workers AI for a bilingual product-description generator from an ingredient/benefit list, or a simple skin-quiz-to-product matcher.

## 7. Security & Compliance
Align with the NIST Cybersecurity Framework (Govern, Identify, Protect, Detect, Respond, Recover), scoped for retail e-commerce: password hashing, HTTPS/HSTS, RBAC on every admin action, secrets in Wrangler secrets, PCI-scope minimization via hosted payment redirects, admin audit logging, rate-limiting on auth/checkout, an incident-response outline, and a D1 backup/restore procedure. Additionally, keep all product copy reviewed against the no-medical-claims rule in Section 1.

## 8. Testing Strategy
Unit/integration tests for Worker routes (Vitest + Miniflare or `@cloudflare/vitest-pool-workers`); Playwright E2E for the checkout flow; JSON fixtures for product-list, create-order, and admin-login endpoints; TypeScript build check required before deploy.

## 9. Dashboard Development Plan
Lightweight stack (vanilla JS/HTML/CSS or Alpine.js/htmx), a small charting library (Chart.js) for analytics, full usability on tablet/large phone, and defined loading/empty/error states for every view.

## 10. File & Folder Structure
```
[your-brand-slug]/
├── worker/
│   ├── src/
│   │   ├── routes/          (products, orders, customers, auth, admin)
│   │   ├── lib/              (payment, courier, sms integrations, sku + invoice generators)
│   │   └── index.ts
│   ├── migrations/
│   └── wrangler.toml
├── public/
├── admin/
├── tests/
├── .github/workflows/
└── docs/
```

## 11. Development Environment & Deployment Setup
Node.js version, `wrangler` CLI install/login, `wrangler d1 create`, KV namespace, R2 bucket, sample `wrangler.toml` and `.dev.vars`, GitHub branch strategy, a GitHub Actions workflow that tests/builds/migrates/deploys on push to `main`, and custom-domain setup via Cloudflare DNS.

## 12. SEO, Performance & Marketing
Meta tags, Open Graph/Twitter cards, sitemap.xml, robots.txt, `Product` JSON-LD for listings, Core Web Vitals targets for mobile, WhatsApp click-to-chat, Facebook/Instagram Shop feed.

## 13. Suggested Product Categories & Content Plan
Cleansers, Toners, Serums & Treatments, Moisturizers, Sunscreen, Masks & Exfoliants, Lip Care, Makeup (optional) — adjustable starting points.

## 14. Phased Roadmap
- **Phase 1 (MVP):** catalog, cart, COD checkout, basic admin CRUD for products/orders/categories, SKU + invoice generation live.
- **Phase 2:** bKash/Nagad/SSLCommerz, Steadfast API, coupons, reviews, batch/expiry tracking, reports.
- **Phase 3:** skin quiz, AI-assisted descriptions, loyalty program, PWA/offline support.

## 15. Development & Delivery Conventions
Output complete, untruncated files (never diffs); validate with a TypeScript/build check before presenting code as finished; keep all copy bilingual and plain-language with large touch targets; start from a clean checkout before editing existing code.

## 16. Acceptance Checklist
- [ ] Bilingual storefront and admin, working language toggle
- [ ] Guest checkout with Division/District/Upazila address and live delivery-fee calculation
- [ ] COD works end-to-end; at least one MFS integration functional or clearly stubbed
- [ ] Every product has a unique, correctly-formatted SKU generated automatically
- [ ] Every order gets a unique, sequential invoice number and a downloadable PDF invoice
- [ ] Full CRUD on products (with ingredients/tags), categories, orders, customers, coupons, reviews
- [ ] Batch/expiry tracking works and surfaces a near-expiry alert
- [ ] No product copy makes a medical claim
- [ ] Admin usable on tablet/large phone
- [ ] No secrets committed to the repository

## Output Format
Single structured document: labeled sections matching the numbering above; Mermaid diagrams where applicable; tables for every data model; TypeScript/JSON code snippets embedded contextually; the folder structure as an indented tree; a short glossary for any Bangla UI terms used.

## Notes
- Treat COD plus MFS as the primary payment reality; card payments are secondary.
- The SKU and invoice-numbering system is a hard requirement, not optional.
- The no-medical-claims rule from Section 1 applies to every piece of product copy generated for this project.
- Flag any assumption (palette details, exact delivery-fee tiers, exact category list) as adjustable and confirm with the requester before finalizing.