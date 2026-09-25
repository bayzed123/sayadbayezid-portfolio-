# [Your Brand Name] — Men's Fashion & Traditional Wear E-commerce (A–Z Build Prompt)

> Replace `[Your Brand Name]` and `[Your Location]` throughout before using. Example name directions: "Purush", "Panjabi House", "Charcoal & Co.". Pairs naturally alongside a women's store like Lk's Attire as a household's two shopfronts.

Create a comprehensive, detailed, end-to-end (A–Z) plan and specification — and, where possible, a working implementation — for a full-stack e-commerce website with a fully-featured admin dashboard, for:

- **Brand name:** [Your Brand Name]
- **Business type:** Men's clothing retail (panjabi & fatua, formal wear, casual western wear, footwear, accessories)
- **Location:** [Your Location], Bangladesh
- **Primary market:** Bangladesh, men shopping for everyday, office, and festive/wedding-season wear, mobile-first, Bangla + English speaking

The system must be built on **Cloudflare** for hosting/runtime (Workers, D1, KV, R2), with source code hosted on **GitHub** and deployed via GitHub Actions — one Cloudflare Worker (Hono + TypeScript) serving both the static storefront/admin app and all `/api/*` routes. The admin dashboard must support full CRUD for every resource below, with validation, confirmation prompts, and success/failure feedback.

The deliverable must include the following:

## 1. Brand, Market & Business Requirements
- Define the brand identity, a short tagline, and a structured, masculine logo concept direction.
- Target customer: men buying everyday and office wear, plus festive/wedding-season panjabi and formalwear.
- All customer-facing and admin UI text bilingual (Bangla + English) with a language toggle, plain language throughout.
- Business model: Cash on Delivery as default, plus mobile financial services and card payment.
- Feature [Your Location] on the Contact/About page, footer, and structured data.
- Team is small and non-technical — every admin workflow must be operable with no coding knowledge, large touch targets, plain-language labels.

## 2. Public Website — Description & Layout
- **Visual style:** structured and editorial. Deep charcoal/navy background with a copper, mustard, or deep-maroon accent, a strong grid layout, bold sans-serif headlines, full-body catalog/lookbook-style photography emphasis, minimal ornamentation.
- Site map: Home, Shop (category & subcategory), Product Detail, Cart, Checkout, Account (Login/Register, Orders, Wishlist, Addresses), About/Contact, Search Results.
- **Homepage:** hero banner, category tiles (Panjabi & Fatua, Formal, Casual, Footwear, Accessories), an occasion-based collection banner (Eid, Wedding/Groom, Office), best sellers, customer reviews, newsletter signup, footer with location and policies.
- **Product listing:** filters by category, size, color, fit (slim/regular/relaxed), price, and occasion; sort by price/newest/popularity/rating.
- **Product detail page:** image gallery (including a full-length lookbook shot), size chart with a **fit guide** (slim/regular/relaxed explained), fabric and care instructions, color variant selector, price, stock status, Add to Cart/Buy Now, a **"complete the outfit"** cross-sell (e.g. panjabi + pajama + slippers), customer reviews, related products.
- **Occasion collections:** a dedicated landing section for seasonal collections (e.g. Eid Panjabi, Wedding/Groom).
- **Cart & checkout:** guest checkout, Bangladesh address form with tiered delivery fee, payment method selection (COD, bKash, Nagad, Rocket, card via SSLCommerz), order summary and confirmation with SMS/WhatsApp notification.
- **Account area:** order history with tracking, wishlist, saved addresses.

## 3. Admin Dashboard — Description & Layout
- **Visual style:** structured dark theme — charcoal/navy background, copper or maroon accents on active states and key stats, strong grid-aligned cards, bold numerals for KPIs.
- **Three-pane layout:**
  - **Left sidebar** (collapsible): Dashboard, Products, Categories, Collections (occasion-based), Orders, Customers, Coupons, Inventory, Reviews, Reports/Analytics, Staff & Roles, System Settings, Help Center.
  - **Center panel:** dashboard home with a monthly sales chart, KPI cards (today's orders, revenue, pending COD, low-stock alerts, new customers), recent-orders table, top-selling products.
  - **Right sidebar:** search, admin profile dropdown, notifications (new order, low stock, new review), staff online status.
- **CRUD modules:**
  - **Products** — name, bilingual description, category, price, discount, size/color/fit variants, per-variant stock, images, fabric/care info, occasion tags, images, status, SEO slug, auto-generated SKU (see Section 5); bulk CSV import/export.
  - **Categories & Subcategories** — nested, drag-to-reorder.
  - **Collections** — occasion-based groupings (Eid, Wedding, Office) with scheduling (start/end date) for seasonal campaigns.
  - **Orders** — line items with SKUs, customer, address, payment method/status, delivery pipeline (Pending → Confirmed → Packed → Shipped [courier + tracking] → Delivered → Returned/Cancelled), **auto-generated invoice number and a printable PDF invoice** (see Section 5), refund handling.
  - **Customers** — profile, order history, block/unblock.
  - **Coupons/Discounts** — percentage/flat, minimum order, expiry, usage limits.
  - **Reviews** — approve/reject/reply.
  - **Inventory** — per-SKU stock, low-stock alerts, adjustment log.
  - **Staff & Roles** — Super Admin, Manager, Order Processor, Read-only Viewer.
  - **Reports/Analytics** — sales by category/product/date range, best sellers, CSV export.
  - **System Settings** — store info, delivery zones & rates, payment-gateway keys, notification templates.
  - **Activity/Audit Log.**
- **CRUD interaction requirements:** modal/slide-over create-edit forms; inline bilingual validation; confirmation dialog before delete (soft-delete/trash); toast success/failure notifications; role-based hiding of restricted actions; search/filter/pagination on every list.

## 4. Full-Stack Architecture
One Cloudflare Worker (Hono + TypeScript) serves the storefront/admin assets and all `/api/*` routes, backed by D1, KV, and R2. GitHub is the source of truth and CI/CD pipeline (GitHub Actions deploys on push to `main`); Cloudflare is the runtime. Provide a Mermaid architecture diagram showing browsers → Worker → D1/KV/R2, outbound calls to payment/courier/notification providers, and the GitHub → Actions → Cloudflare deploy path.

## 5. Data Models
Provide schema tables for: `products`, `product_variants`, `categories`, `collections`, `orders`, `order_items`, `customers`, `addresses`, `reviews`, `coupons`, `admins`, `inventory_log`, `delivery_zones`.

**SKU & Invoice Numbering (required):**
- Every product variant gets an auto-generated, unique **SKU** on creation, editable if needed, following a pattern such as `MEN-[CategoryCode]-[Size]-[ColorCode]-[Sequence]` (e.g. `MEN-PNJ-XL-WHT-0021`). Enforce uniqueness at the database level.
- Every confirmed order gets an auto-generated, unique, sequential **invoice number**, e.g. `INV-MEN-YYYYMMDD-####`, generated at order confirmation. Provide a downloadable/printable PDF invoice per order with itemized SKUs, quantities, unit prices, discounts, delivery fee, and total.

Include one worked example: an **Order** model as a TypeScript interface, including `sku` on each line item and an `invoiceNumber` field on the order.

## 6. Payments, Delivery & Third-Party Integrations
- Payments: COD, bKash, Nagad, Rocket, card via SSLCommerz (or similar).
- Delivery: Steadfast as primary courier, Pathao Courier and RedX as alternatives; tracking-ID sync and status webhooks.
- Live delivery-fee calculation by Division/District/Upazila.
- SMS/WhatsApp order-confirmation and status-update notifications.
- Optional: Cloudflare Workers AI for an auto-generated bilingual product description from fabric/fit attributes, or an "outfit builder" recommender.

## 7. Security & Compliance
Align with the NIST Cybersecurity Framework (Govern, Identify, Protect, Detect, Respond, Recover), scoped for retail e-commerce: password hashing, HTTPS/HSTS, RBAC on every admin action, secrets in Wrangler secrets, PCI-scope minimization via hosted payment redirects, admin audit logging, rate-limiting on auth/checkout, an incident-response outline, and a D1 backup/restore procedure.

## 8. Testing Strategy
Unit/integration tests for Worker routes (Vitest + Miniflare or `@cloudflare/vitest-pool-workers`); Playwright E2E for the checkout flow; JSON fixtures for product-list, create-order, and admin-login endpoints; TypeScript build check required before deploy.

## 9. Dashboard Development Plan
Lightweight stack (vanilla JS/HTML/CSS or Alpine.js/htmx), a small charting library (Chart.js) for analytics, full usability on tablet/large phone, and defined loading/empty/error states for every view.

## 10. File & Folder Structure
```
[your-brand-slug]/
├── worker/
│   ├── src/
│   │   ├── routes/          (products, orders, customers, auth, admin, collections)
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
Panjabi & Fatua, Formal Shirts & Pants, Casual Wear, Polo & T-Shirts, Footwear, Accessories (belts, wallets, watches) — adjustable starting points.

## 14. Phased Roadmap
- **Phase 1 (MVP):** catalog, cart, COD checkout, basic admin CRUD for products/orders/categories, SKU + invoice generation live.
- **Phase 2:** bKash/Nagad/SSLCommerz, Steadfast API, coupons, reviews, occasion collections, reports.
- **Phase 3:** outfit-builder recommender, AI-assisted descriptions, loyalty program, PWA/offline support.

## 15. Development & Delivery Conventions
Output complete, untruncated files (never diffs); validate with a TypeScript/build check before presenting code as finished; keep all copy bilingual and plain-language with large touch targets; start from a clean checkout before editing existing code.

## 16. Acceptance Checklist
- [ ] Bilingual storefront and admin, working language toggle
- [ ] Guest checkout with Division/District/Upazila address and live delivery-fee calculation
- [ ] COD works end-to-end; at least one MFS integration functional or clearly stubbed
- [ ] Every product has a unique, correctly-formatted SKU generated automatically
- [ ] Every order gets a unique, sequential invoice number and a downloadable PDF invoice
- [ ] Full CRUD on products (with size/fit/color), categories, collections, orders, customers, coupons
- [ ] "Complete the outfit" cross-sell shows sensible matches
- [ ] Admin usable on tablet/large phone
- [ ] No secrets committed to the repository

## Output Format
Single structured document: labeled sections matching the numbering above; Mermaid diagrams where applicable; tables for every data model; TypeScript/JSON code snippets embedded contextually; the folder structure as an indented tree; a short glossary for any Bangla UI terms used.

## Notes
- Treat COD plus MFS as the primary payment reality; card payments are secondary.
- The SKU and invoice-numbering system is a hard requirement, not optional.
- Flag any assumption (palette details, exact delivery-fee tiers, exact category list) as adjustable and confirm with the requester before finalizing.