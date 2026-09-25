# [Your Brand Name] — Gadget & Tech Accessories E-commerce (A–Z Build Prompt)

> Replace `[Your Brand Name]` and `[Your Location]` throughout before using. Example name directions: "GadgetNest", "ByteBox", "CircuitHub".

Create a comprehensive, detailed, end-to-end (A–Z) plan and specification — and, where possible, a working implementation — for a full-stack e-commerce website with a fully-featured admin dashboard, for:

- **Brand name:** [Your Brand Name]
- **Business type:** Gadgets & tech accessories retail (phone cases, chargers, earbuds/headphones, smartwatches, power banks, cables, small electronics, gaming accessories)
- **Location:** [Your Location], Bangladesh
- **Primary market:** Bangladesh, tech-savvy students and young professionals, mobile-first, Bangla + English speaking

The system must be built on **Cloudflare** for hosting/runtime (Workers, D1, KV, R2), with source code hosted on **GitHub** and deployed via GitHub Actions — one Cloudflare Worker (Hono + TypeScript) serving both the static storefront/admin app and all `/api/*` routes. The admin dashboard must support full CRUD for every resource below, with validation, confirmation prompts, and success/failure feedback.

The deliverable must include the following:

## 1. Brand, Market & Business Requirements
- Define the brand identity, a short tagline, and a tech-forward logo concept direction.
- Target customer: students and young professionals buying phone/laptop accessories, audio gear, and small smart-home gadgets, price- and spec-conscious.
- All customer-facing and admin UI text bilingual (Bangla + English) with a language toggle, plain language throughout.
- Business model: Cash on Delivery as default, plus mobile financial services and card payment.
- Feature [Your Location] on the Contact/About page, footer, and structured data.
- Team is small and non-technical — every admin workflow must be operable with no coding knowledge, large touch targets, plain-language labels.

## 2. Public Website — Description & Layout
- **Visual style:** dark-mode-first, tech-forward. Deep charcoal/near-black background (`#0D0E12`-ish), electric-blue/neon-cyan accent, sharp geometric edges (not heavily rounded), a subtle glassmorphism/frosted-glass effect on cards, a monospace or technical-feeling accent font for spec sheets and prices.
- Site map: Home, Shop (category & subcategory), Product Detail, Cart, Checkout, Account (Login/Register, Orders, Wishlist, Addresses), About/Contact, Search Results.
- **Homepage:** hero banner featuring a flagship deal, category tiles (Audio, Wearables, Power, Mobile Accessories, Gaming, Smart Home), new arrivals, best sellers, a "Deal of the Day" countdown block, customer reviews, newsletter signup, footer with location and policies.
- **Product listing:** filters by category, brand, price range, and compatibility (e.g. "Works with iPhone"); sort by price/newest/popularity/rating.
- **Product detail page:** image gallery, full spec table (battery capacity, ports, wattage, connectivity, etc.), "Compatible with" tags, warranty period badge, stock status, quantity selector, Add to Cart/Buy Now, customer Q&A/reviews, related/upsell products, a **spec-comparison tool** letting a shopper add 2–3 products to a side-by-side comparison table.
- **Cart & checkout:** guest checkout, Bangladesh address form (Division/District/Upazila) with tiered delivery fee, payment method selection (COD, bKash, Nagad, Rocket, card via a gateway such as SSLCommerz), order summary and confirmation with SMS/WhatsApp notification.
- **Bundle/combo deals:** ability to feature a bundle (e.g. earbuds + protective case) as a single purchasable listing linked to its component products.
- **Account area:** order history with tracking, wishlist, saved addresses, warranty-claim submission form tied to a past order.

## 3. Admin Dashboard — Description & Layout
- **Visual style:** dark theme matching the storefront — near-black background, electric-blue/cyan accents on buttons and active nav states, sharp-edged cards with a soft neon glow on hover, monospace numerals for stats.
- **Three-pane layout:**
  - **Left sidebar** (collapsible, dark background): Dashboard, Products, Categories, Orders, Customers, Coupons, Warranty Claims, Inventory, Reports/Analytics, Staff & Roles, System Settings, Help Center.
  - **Center panel:** dashboard home with a monthly sales chart, KPI cards (today's orders, revenue, pending COD, low-stock alerts, open warranty claims), a recent-orders table, top-selling products.
  - **Right sidebar:** search, admin profile dropdown, notifications (new order, low stock, new warranty claim), staff online status.
- **CRUD modules:**
  - **Products** — name, bilingual description, category, brand, price, discount, full spec sheet (key-value fields), color/storage variants, per-variant stock, images, compatible-devices tags, warranty period (months), status, SEO slug, auto-generated SKU (see Section 5); bulk CSV import/export.
  - **Categories & Subcategories** — nested, drag-to-reorder.
  - **Orders** — line items with SKUs, customer, address, payment method/status, delivery pipeline (Pending → Confirmed → Packed → Shipped [courier + tracking] → Delivered → Returned/Cancelled), **auto-generated invoice number and a printable PDF invoice** (see Section 5), refund handling.
  - **Customers** — profile, order history, block/unblock.
  - **Coupons/Discounts** — percentage/flat, minimum order, expiry, usage limits.
  - **Warranty Claims** — linked to an order + product, claim status (Submitted → Under Review → Approved/Rejected → Resolved), notes.
  - **Inventory** — per-SKU stock, low-stock alerts, adjustment log, and (optional) per-unit serial-number log for higher-value electronics.
  - **Staff & Roles** — Super Admin, Manager, Order Processor, Read-only Viewer.
  - **Reports/Analytics** — sales by category/product/date range, best sellers, CSV export.
  - **System Settings** — store info, delivery zones & rates, payment-gateway keys, notification templates.
  - **Activity/Audit Log.**
- **CRUD interaction requirements:** modal/slide-over create-edit forms; inline bilingual validation; confirmation dialog before delete (soft-delete/trash); toast success/failure notifications; role-based hiding of restricted actions; search/filter/pagination on every list.

## 4. Full-Stack Architecture
One Cloudflare Worker (Hono + TypeScript) serves the storefront/admin assets and all `/api/*` routes, backed by D1 (relational data), KV (sessions/cache), and R2 (product images). GitHub is the source of truth and CI/CD pipeline (GitHub Actions deploys on push to `main`); Cloudflare is the runtime. Provide a Mermaid architecture diagram showing browsers → Worker → D1/KV/R2, plus outbound calls to payment, courier, and notification providers, and the GitHub → Actions → Cloudflare deploy path.

## 5. Data Models
Provide schema tables for: `products`, `product_variants`, `categories`, `orders`, `order_items`, `customers`, `addresses`, `reviews`, `coupons`, `admins`, `inventory_log`, `warranty_claims`, `delivery_zones`.

**SKU & Invoice Numbering (required):**
- Every product variant gets an auto-generated, unique **SKU** on creation, editable if needed, following a pattern such as `GAD-[CategoryCode]-[BrandCode]-[ColorCode]-[Sequence]` (e.g. `GAD-EB-JBL-BLK-0007`). Enforce uniqueness at the database level.
- Every confirmed order gets an auto-generated, unique, sequential **invoice number**, e.g. `INV-GAD-YYYYMMDD-####`, generated at order confirmation and never reused. Provide a downloadable/printable PDF invoice per order showing itemized SKUs, quantities, unit prices, discounts, delivery fee, and total, plus the buyer's address and the store's details.

Include one worked example: an **Order** model as a TypeScript interface, including `sku` on each line item and an `invoiceNumber` field on the order.

## 6. Payments, Delivery & Third-Party Integrations
- Payments: COD, bKash, Nagad, Rocket, card via SSLCommerz (or similar).
- Delivery: Steadfast as primary courier, Pathao Courier and RedX as alternatives; tracking-ID sync and status webhooks.
- Live delivery-fee calculation by Division/District/Upazila.
- SMS/WhatsApp order and warranty-claim status notifications.
- Optional: Cloudflare Workers AI for a spec-based product recommender ("need something under 2000৳ with fast charging?") or an auto-generated bilingual spec summary from raw spec input.

## 7. Security & Compliance
Align with the NIST Cybersecurity Framework (Govern, Identify, Protect, Detect, Respond, Recover), scoped for retail e-commerce: password hashing, HTTPS/HSTS, RBAC on every admin action, secrets in Wrangler secrets (never in code), PCI-scope minimization via hosted payment redirects, admin audit logging, rate-limiting on auth/checkout, an incident-response outline, and a D1 backup/restore procedure.

## 8. Testing Strategy
Unit/integration tests for Worker routes (Vitest + Miniflare or `@cloudflare/vitest-pool-workers`); Playwright E2E for the checkout flow; JSON fixtures for product-list, create-order, and admin-login endpoints; TypeScript build check required before deploy.

## 9. Dashboard Development Plan
Lightweight stack (vanilla JS/HTML/CSS or Alpine.js/htmx), a small charting library (Chart.js) for analytics, full usability on tablet/large phone, and defined loading/empty/error states for every view.

## 10. File & Folder Structure
```
[your-brand-slug]/
├── worker/
│   ├── src/
│   │   ├── routes/          (products, orders, customers, auth, admin, warranty)
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
Mobile Accessories (cases, screen protectors), Audio (earbuds, headphones, speakers), Wearables (smartwatches, fitness bands), Power (power banks, chargers, cables), Gaming Accessories, Smart Home Gadgets, Computer Accessories — adjustable starting points.

## 14. Phased Roadmap
- **Phase 1 (MVP):** catalog, cart, COD checkout, basic admin CRUD for products/orders/categories, SKU + invoice generation live.
- **Phase 2:** bKash/Nagad/SSLCommerz, Steadfast API, coupons, warranty-claim workflow, reviews, reports.
- **Phase 3:** spec-comparison tool, bundle/combo builder, AI recommender, PWA/offline support.

## 15. Development & Delivery Conventions
Output complete, untruncated files (never diffs); validate with a TypeScript/build check before presenting code as finished; keep all copy bilingual and plain-language with large touch targets; start from a clean checkout before editing existing code.

## 16. Acceptance Checklist
- [ ] Bilingual storefront and admin, working language toggle
- [ ] Guest checkout with Division/District/Upazila address and live delivery-fee calculation
- [ ] COD works end-to-end; at least one MFS integration functional or clearly stubbed
- [ ] Every product has a unique, correctly-formatted SKU generated automatically
- [ ] Every order gets a unique, sequential invoice number and a downloadable PDF invoice
- [ ] Full CRUD on products (with variants/specs), categories, orders, customers, coupons, warranty claims
- [ ] Spec-comparison tool works for at least 2 products at once
- [ ] Admin usable on tablet/large phone
- [ ] Basic SEO in place
- [ ] No secrets committed to the repository

## Output Format
Single structured document: labeled sections matching the numbering above; Mermaid diagrams where applicable; tables for every data model; TypeScript/JSON code snippets embedded contextually; the folder structure as an indented tree; a short glossary for any Bangla UI terms used.

## Notes
- Treat COD plus MFS as the primary payment reality; card payments are secondary.
- The SKU and invoice-numbering system is a hard requirement, not optional — every product and every order must be traceable by it.
- Flag any assumption (palette details, exact delivery-fee tiers, exact category list) as adjustable and confirm with the requester before finalizing.