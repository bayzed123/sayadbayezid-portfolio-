# Smartgen Developer Docs

Welcome to the official developer documentation for **Smartgen NexusLeads**, a secure B2B lead discovery and enrichment platform built for research teams, agencies, and product builders. NexusLeads discovers public business candidates, enriches publicly available contact details, generates optional outreach drafts, and lets an authenticated user review and push selected rows to Google Sheets.

> NexusLeads is designed around a review-first workflow: discovery is automated, but export remains controlled by the account owner.

## What you can build

The platform exposes a Cloudflare Worker API at `https://nexusleads-api.mahmudajenny6.workers.dev`. The live NexusLeads dashboard is available at [https://leads.sayadbayezid.com/](https://leads.sayadbayezid.com/). A web dashboard consumes the same API, but the service is intentionally usable from other clients such as internal tools, agency portals, command-line scripts, or a native mobile application.

| Capability | What it does | Primary endpoint |
| --- | --- | --- |
| Account access | Creates sessions and returns the current user | `/api/auth/signup`, `/api/auth/login`, `/api/auth/me` |
| Lead discovery | Finds public business candidates using keyword, location, or an interpreted prompt | `/api/discover` |
| Enrichment | Verifies and enriches public details in controlled batches | `/api/enrich` |
| Outreach drafts | Produces optional email and WhatsApp drafts from defined skills | `/api/enrich` |
| Google Sheets export | Writes only the rows selected by the user | `/api/export` |
| BYOK | Stores user-provided provider credentials as encrypted ciphertext | `/api/account/credentials` |
| Usage and pricing | Reports plan usage and planning estimates | `/api/usage`, `/api/pricing` |

## Design principles

NexusLeads separates **discovery**, **verification**, and **export** so that each stage can be observed and retried without silently pushing data to a customer-owned spreadsheet. Credentials are never returned in plaintext after storage. The API returns connection metadata only, such as whether a user-provided key is present.

The service also distinguishes three user-facing operating modes. A free account uses the platform's free daily allowance. A paid account without a configured personal provider key uses the managed Pro path. A paid account with a valid user-provided key uses BYOK capacity for the configured provider. The dashboard displays the active mode beside the live pipeline.

## Quick links

Start with the [Quick Start](getting-started/quick-start.md) if you want to make your first authenticated request. Read [Architecture](platform/architecture.md) to understand the Worker, D1, KV, and provider boundaries. For integration work, continue to [Authentication](api/authentication.md), [Lead Discovery](api/discovery.md), and [Enrichment and Export](api/data-pipeline.md).

## Important security note

Do not place provider credentials in Markdown, frontend JavaScript, committed YAML, issue comments, screenshots, or request examples. Use Cloudflare Worker bindings for platform secrets, GitHub Actions secrets for deployment automation, and the authenticated BYOK endpoint for user-owned keys.

> This repository documents the public contract and operational behavior of NexusLeads. Provider quotas, pricing, and third-party API behavior can change; always validate the provider's current terms before production rollout.

## Powered by SmartGen Docs

This site follows the SmartGen Docs structure and configuration model. SmartGen Docs is a Markdown-centric static documentation generator created for the SmartGen Platform. See the [SmartGen Docs project](https://docs.smartgentools.com/) for the documentation engine, configuration conventions, and deployment model.

## References

[1]: https://docs.smartgentools.com/ "SmartGen Docs official documentation"
[2]: https://developers.cloudflare.com/workers/ "Cloudflare Workers documentation"
[3]: https://developers.google.com/sheets/api "Google Sheets API documentation"
# Quick Start

This guide demonstrates the supported integration path without exposing any provider credential. Replace the example email, password, and spreadsheet identifier with values supplied by your own application at runtime.

## 1. Create an account

```bash
curl -sS -X POST \
  https://nexusleads-api.mahmudajenny6.workers.dev/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"developer@example.com","password":"use-a-runtime-secret"}'
```

The response contains a session token when account creation succeeds. Treat the token as sensitive application state and never write it to logs.

## 2. Confirm the session

```bash
curl -sS \
  https://nexusleads-api.mahmudajenny6.workers.dev/api/auth/me \
  -H 'Authorization: Bearer YOUR_RUNTIME_SESSION_TOKEN'
```

The response identifies the authenticated user and includes the paid flag used by the dashboard. It does not return password material or decrypted BYOK credentials.

## 3. Discover candidates

```bash
curl -sS -X POST \
  https://nexusleads-api.mahmudajenny6.workers.dev/api/discover \
  -H 'Authorization: Bearer YOUR_RUNTIME_SESSION_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "keyword":"independent dental clinics",
    "location":"Austin, Texas",
    "max_results":40,
    "client_id":"your-application-instance-id"
  }'
```

The dashboard also supports an interpreted research prompt. Use either a structured keyword and location or a prompt such as `Find independent dental clinics in Austin with a public phone number and public email`. Do not send both unless your client explicitly defines which input has priority.

## 4. Enrich and draft

Use the candidate records from discovery as the input to `/api/enrich`. Request only the fields your workflow needs. Outreach drafting is optional and should be treated as a draft-generation feature; the platform does not send messages automatically.

```json
{
  "leads": [
    {
      "place_id": "provider-place-id",
      "name": "Example Dental Clinic",
      "address": "Austin, TX"
    }
  ],
  "generate_outreach": true,
  "draft_type": "professional_introduction",
  "marketing_style": "concise, consultative, evidence-based"
}
```

## 5. Export a reviewed batch

The account owner should select rows in the client and send a bounded batch. The web dashboard exposes 50, 100, and 200-row choices; the Worker processes exports in API-safe chunks.

```bash
curl -sS -X POST \
  https://nexusleads-api.mahmudajenny6.workers.dev/api/export \
  -H 'Authorization: Bearer YOUR_RUNTIME_SESSION_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "sheet_id":"YOUR_RUNTIME_SHEET_ID_OR_URL",
    "leads":[
      {"name":"Example Dental Clinic","email":"hello@example.com","phone":"+1 555 0100"}
    ],
    "leads_sheet_tab":"Leads",
    "outreach_sheet_tab":"Outreach"
  }'
```

Export requests mutate a Google Sheet. Your application should show a review step and an explicit confirmation before calling this endpoint.

## 6. Log out

```bash
curl -sS -X POST \
  https://nexusleads-api.mahmudajenny6.workers.dev/api/auth/logout \
  -H 'Authorization: Bearer YOUR_RUNTIME_SESSION_TOKEN'
```

## Common first-run issues

A `401` response normally means the token is missing, expired, or malformed. A `403` response from BYOK endpoints means the account is not enabled for paid BYOK. A successful request with a `sheets` failure usually means the spreadsheet has not been shared with the configured service account or the target tab cannot be created.
# Local Development

This repository uses SmartGen Docs as its source-of-truth documentation engine. Markdown lives under `docs/`, the navigation and theme are defined in `smartgen.yml`, and the generated static output is written to `site/`.

## Prerequisites

SmartGen Docs requires Python 3.8 or newer. Install the documentation generator in an isolated environment when possible:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install smartgen-docs
```

## Serve locally

```bash
smartgen-docs serve
```

Open the local URL printed by the command, usually `http://localhost:8000`. The server watches the Markdown and configuration files so navigation and content can be reviewed before deployment.

## Build locally

```bash
smartgen-docs build
```

The generated site should appear under `site/`. Review the build output for broken navigation or missing assets before committing a documentation change.

## Content conventions

Use sentence-case headings, short paragraphs, tables for structured comparisons, and fenced code blocks with language identifiers. Keep runtime credentials and personal customer data out of examples. Use placeholders that are visibly non-runnable, such as `YOUR_RUNTIME_SESSION_TOKEN`.

## Validate before commit

```bash
python3 - <<'PY'
from pathlib import Path
assert Path('smartgen.yml').exists()
assert Path('docs/index.md').exists()
assert 'ADMIN_SECRET' in Path('docs/guides/paid-activation.md').read_text()
print('Documentation source checks passed.')
PY
smartgen-docs build
```

The repository workflow performs the same build in a clean Ubuntu runner before publishing GitHub Pages.
# Deployment

The repository is designed for static deployment. The included GitHub Actions workflow builds SmartGen Docs on every push to `main` and publishes the generated `site/` directory to a `gh-pages` branch.

## GitHub Pages

The workflow can publish the branch without a pre-existing Pages configuration. A repository owner must complete this one-time setting:

1. Open the repository's **Settings → Pages**.
2. Choose **Deploy from a branch**.
3. Select the `gh-pages` branch and the `/ (root)` folder, then save.
4. Push a documentation change to `main` or run the workflow manually.
5. Wait for the `Build and deploy SmartGen Docs` workflow to finish.
6. Open the repository Pages URL shown by GitHub.

The workflow's build and branch-publish jobs can be verified independently from the Actions tab. The generated artifact is not committed to `main`; it is published to `gh-pages` by the workflow.

The configured `site_url` is the project Pages URL. If a custom domain is later assigned, update `site_url`, canonical metadata, and any absolute links in `smartgen.yml` in the same change.

## Custom hosting

The generated `site/` directory contains static HTML, CSS, JavaScript, and assets. It can be uploaded to a static host or served from a CDN. Keep the source Markdown and `smartgen.yml` in Git, and regenerate rather than hand-editing generated HTML.

## Preview safety

The documentation site is public by design, but it must never contain runtime secrets, private customer identifiers, service-account JSON, or live bearer tokens. Examples are placeholders and should remain placeholders in generated output.

## Rollback

A rollback is a normal Git revert to the last known-good documentation commit. The workflow rebuilds the site from that commit. Do not manually edit the Pages artifact to conceal a source issue; fix the source and redeploy.
# BYOK Configuration

BYOK means **Bring Your Own Key**. NexusLeads allows an eligible paid account to supply provider credentials so that provider billing and quota remain associated with the user's provider account.

## Eligibility and mode mapping

A registered account is first activated as paid by an administrator after payment confirmation. The user can then open API Configuration. The account is **BOYOK** only after a user-provided Google Maps key has been encrypted and saved successfully. Before that, a paid account remains in managed **PRO** mode.

| State | Status shown |
| --- | --- |
| Free account with no paid activation | `FREE` |
| Paid account with no personal Maps key | `PRO` |
| Paid account with encrypted personal Maps key | `BOYOK` |

## Safe configuration flow

1. The user signs in.
2. The dashboard refreshes `/api/auth/me` and `/api/usage` before opening the configuration modal.
3. The UI calls `GET /api/account/credentials` and renders only configured/blank state.
4. The user enters a key into a secure input and submits once.
5. The Worker encrypts the value with AES-GCM and stores ciphertext in D1.
6. The UI clears the input, refreshes status, and shows `Securely Configured` with masked metadata.
7. The next eligible discovery request resolves the user-owned provider credential inside the Worker.

## Key restrictions

Google Maps keys should be restricted to the required APIs and appropriate application or server restrictions at the provider. Gemini keys should be limited to the intended API products and rotated if exposed. Service-account JSON should be supplied only through the authenticated configuration flow and should never be pasted into an issue, chat, or public file.

## Clear and rotate

Use `DELETE /api/account/credentials` when the user wants to remove BYOK. To rotate a key, clear the old configuration or replace it through the save endpoint, then verify the returned configured state. Clearing the key returns a paid account to managed Pro; it does not downgrade the account to Free.

## Error behavior

A configuration failure should preserve the blank or previous safe status, show a concise error, and avoid echoing the submitted key. Provider validation failures should be treated as configuration errors, not as a reason to expose provider response bodies directly to the user.
# Google Sheets Setup

NexusLeads can write selected leads to a customer-owned spreadsheet. The spreadsheet remains under the customer's Google account; NexusLeads only requests the access needed to append or update the configured tabs.

## Recommended setup

1. Create or select a Google Spreadsheet in the customer's account.
2. Share the spreadsheet with the configured service-account email as **Editor**, unless the account is using an approved alternative access path.
3. Paste the Sheet URL or ID into the dashboard.
4. Run **Check Sheet Access** before the first export.
5. Keep the `Leads` and `Outreach` tabs available, or allow the Worker to create them according to its current implementation.

## Leads tab

The standard headers are:

| Name | Category | Phone | Email | Address | Website | Rating | Verification | Source | Collected At | Facebook | Instagram | Twitter/X | LinkedIn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

The Worker normalizes missing values rather than requiring every public field to be present.

## Outreach tab

When draft generation is enabled, the platform writes a separate Outreach row with fields such as draft type, subject, message, WhatsApp draft, personalization note, sender email, support CTA, and sender website.

## Privacy guidance

Do not put API keys, passwords, session tokens, or service-account private keys in the spreadsheet. Treat a lead sheet as customer data and configure sharing using the minimum access required. If a spreadsheet is shared incorrectly, remove access in Google Drive first, then run the access check again.

## Export review checklist

Before clicking a push button, confirm the target spreadsheet, selected-row count, active account mode, and batch size. The dashboard's `Clear Dashboard` action removes local workspace rows but does not delete Sheet data. Deleting Sheet rows must be performed intentionally in Google Sheets or through a separately approved data-management feature.
# GitHub Paid Activation

Paid activation is intentionally manual. Payment is confirmed outside the API, then an operator enables the already-registered account through a protected GitHub Actions workflow.

## Required repository secret

Create a repository or environment secret named exactly:

```text
ADMIN_SECRET
```

Its value must match the protected Worker-side admin binding. Do not place the value in this documentation, workflow YAML, issue comments, or command output. The workflow should reference it as `${{ secrets.ADMIN_SECRET }}`.

## Activation procedure

1. Confirm that the customer has completed the selected payment process.
2. Confirm that the customer has already registered in NexusLeads using the same email address.
3. Open **Actions** in the application repository.
4. Select **Enable Paid User for BYOK**.
5. Choose **Run workflow** and enter the registered email address.
6. Review the workflow result without exposing the secret.
7. Ask the customer to refresh or reopen API Configuration.
8. Verify that `/api/auth/me` reports paid status and that `/api/usage` reports the expected mode.

The Worker matches the normalized email against the D1 users table. It should not create a new account during activation. A missing match should fail the workflow clearly.

## Why the workflow can fail

| Symptom | Likely cause | Safe check |
| --- | --- | --- |
| `ADMIN_SECRET` is empty | Secret was not created in the repository/environment available to the workflow | Check the secret name and workflow environment, not the value in logs |
| `401 Unauthorized admin secret` | Worker binding and GitHub secret do not match | Rotate and update both sides through protected settings |
| `User not found` | Email has not registered or differs after normalization | Ask the user to register and repeat the exact account email |
| `403` from the dashboard | Account is not paid or session is stale | Refresh the session and inspect `/api/auth/me` |
| Paid but PRO | Payment activation succeeded, but no personal Maps key is configured | Save a key through BYOK and refresh `/api/usage` |

## Secret hygiene

GitHub masks secrets in ordinary logs, but masking is not a substitute for careful workflow design. Never echo the secret, include it in a URL, write it to an artifact, or pass it as a command-line argument where process listings could expose it. Use a request header sourced directly from the secret expression.
# Architecture

NexusLeads is a multi-page web client backed by a Cloudflare Worker. The Worker is the policy boundary for authentication, account access, usage accounting, provider calls, credential encryption, and Google Sheets export.

## System components

| Component | Responsibility | Data it may handle |
| --- | --- | --- |
| Web dashboard | Authentication UI, search controls, local lead workspace, row selection, CSV download, export confirmation | Session token in browser storage, locally saved lead rows, masked status metadata |
| Cloudflare Worker | JSON API, authorization, input validation, provider orchestration, usage reservation, export coordination | Account records, session tokens, encrypted BYOK ciphertext, provider responses |
| D1 | Durable account and credential metadata | Users, sessions, encrypted credential fields, paid flag, timestamps |
| KV | Daily usage counters and short-lived reservations | Hashed client identity, daily usage, reservation state |
| Provider adapters | Google Places discovery, Firecrawl/public-page enrichment, Gemini draft generation, Google Sheets writes | Runtime request data and provider responses |
| GitHub Actions | Manual paid-account activation and documentation deployment | Workflow inputs and repository secrets only |

## Request flow

```text
Client
  │ HTTPS + JSON + Bearer session
  ▼
Cloudflare Worker
  ├─ authenticate and authorize
  ├─ read account mode from D1
  ├─ resolve platform or user-owned provider configuration
  ├─ reserve/settle free-tier usage when applicable
  ├─ call provider adapters
  └─ return normalized JSON
       │
       ├── D1: account/session/ciphertext metadata
       ├── KV: daily usage and reservations
       ├── Places: public business discovery
       ├── Firecrawl: public-page enrichment
       ├── Gemini: optional outreach drafts
       └── Sheets: explicit, selected-row export
```

## Boundary rules

The frontend never receives platform secrets or decrypted provider keys. The Worker selects a platform binding or decrypted user-owned key only at request time. The D1 database stores encrypted credential ciphertext, not plaintext keys. The export path requires an authenticated request and a spreadsheet identifier supplied by the user.

The web client intentionally keeps the lead workspace locally so that selection state can survive a refresh without creating a second server-side lead database. A client that needs cross-device or team-wide workspace state should add a separate product-level storage design rather than assuming the browser workspace is shared.

## Provider fallbacks

The Worker can be configured with platform provider bindings. BYOK changes the provider credential source for the eligible account; it does not remove the need for provider quota, API restrictions, or account-level billing. Provider failures are returned as normalized errors where possible, while individual enrichment failures may be preserved on the affected lead record.

## Deployment model

The application frontend is hosted as static files through GitHub Pages. The API is deployed separately as a Cloudflare Worker with D1 and KV bindings. Documentation in this repository is built by SmartGen Docs and deployed as a static site through GitHub Actions.
# Lead Lifecycle

A NexusLeads record moves through a deliberately observable lifecycle. Each stage adds information without silently exporting the record.

## Stages

| Stage | Input | Output | User control |
| --- | --- | --- | --- |
| Discover | Keyword, location, or research prompt | Public business candidates | Choose the query and result limit |
| Enrich | Candidate records | Public phone, email, address, website, rating, category, and social links when available | Choose verified-only filtering and draft generation |
| Review | Enriched rows | Selected and unselected workspace records | Check or uncheck individual rows, select all, or clear all |
| Export | Selected rows and sheet target | Leads and optional Outreach sheet rows | Confirm the push and batch size |
| Persist | Browser workspace state | Account-scoped local workspace | Clear dashboard data without deleting the Sheet |

## Deduplication and accumulation

The web dashboard merges incoming results into the existing local workspace rather than replacing the previous search. It uses a provider place identifier when available and falls back to a normalized business name and address pair. This supports a workflow where a user runs multiple searches, accumulates a review set, and then selects a 50-, 100-, or 200-row batch.

## Selection semantics

Selection is explicit. A new lead is unselected by default. The select-all checkbox changes the current workspace selection, while the separate Uncheck control clears selection without deleting records. A successful export marks the pushed rows as synced and clears their selection so that a later push does not duplicate an accidental click.

## Auto-push semantics

Auto-push is opt-in. When disabled, discovery and enrichment never call the export path. When enabled, the dashboard can sync newly completed results according to the configured workflow, but the user can still use the manual selection controls for a controlled review process. Client implementations should preserve this distinction and should not treat a successful search as permission to write to a spreadsheet.

## Data quality

The platform works with publicly available business details and reports missing fields as missing. A missing email is not converted into a guessed address. A missing phone number is not fabricated from a location. Outreach drafts should use only facts present in the lead record or clearly marked as a generic suggestion.
# Plans and Modes

The dashboard exposes one of three active operating modes. The mode is derived from account eligibility and actual provider configuration, not from a cosmetic label.

| Mode | Account condition | Provider source | Dashboard label |
| --- | --- | --- | --- |
| **FREE** | Account is not marked paid | Platform bindings, subject to the daily free allowance | `Now you use our FREE Tier` |
| **PRO** | Account is marked paid, but no personal Google Maps BYOK key is configured | Managed platform capacity | `Now you use our PRO Status` |
| **BOYOK** | Account is marked paid and a user-provided Google Maps key is stored | User-owned encrypted key | `Now you use your BOYOK` |

The product uses the term **BYOK** in API and documentation identifiers. The dashboard badge uses **BOYOK** to match the requested user-facing label.

## Paid activation

Payment is confirmed outside the API. An administrator manually enables the registered account through the repository's `Enable Paid User for BYOK` workflow. The workflow accepts an email address, calls the protected Worker admin endpoint, and changes the matching D1 user record. It must not create an account for an email that has not already registered.

## BYOK eligibility

Paid status alone unlocks access to the credential configuration surface. The account becomes BOYOK only after the user saves a valid provider key. The credential status endpoint returns presence metadata and masked identifiers; it never returns the original key. A user can clear stored credentials and return to the paid managed Pro path.

## Usage behavior

Free usage is counted against the daily free allowance. Paid mode and BYOK behavior depend on the current Worker configuration and provider capacity. A client should always call `/api/usage` before displaying quota messaging and should use the response from the current request rather than caching a previous badge indefinitely.

## UI mapping guidance

A client should display the short `FREE`, `PRO`, or `BOYOK` badge next to the live pipeline, and may display the longer label near account controls. The mapping should be computed from the server's account status and credential presence, never from a local checkbox or an email address.
# Security

NexusLeads treats authentication, provider credentials, and export authorization as separate controls. A valid account session is required for private account data and for data mutations such as BYOK saves and Google Sheets export.

## Credential protection

User-provided Google Maps, Gemini, and Google Service Account material is sent over HTTPS to the authenticated Worker. The Worker encrypts credential values with AES-GCM using a 32-byte Cloudflare secret binding before writing ciphertext to D1. Status responses expose only booleans and safe metadata such as a masked suffix. Decryption occurs only inside the Worker when a permitted provider call requires it.

Platform provider keys are separate Cloudflare bindings and are not embedded in frontend assets. GitHub Actions receives secrets through repository or environment secret references. Documentation examples intentionally use placeholders such as `YOUR_RUNTIME_SESSION_TOKEN` and `YOUR_RUNTIME_SHEET_ID_OR_URL`.

## Authentication rules

Sessions are bearer tokens. Clients should store them in a protected runtime location, avoid logging request headers, and clear them on logout. Every authenticated request should use HTTPS and should handle `401 Unauthorized` by returning the user to a login flow rather than retrying indefinitely.

## BYOK rules

Only a paid, registered account may save, inspect metadata for, or clear personal credentials. A key is considered configured only when the corresponding encrypted field exists in D1. An empty frontend input does not mean that a key is configured. After a successful save, the client should clear the input value and display a masked, secure-configuration confirmation.

## Export rules

The `/api/export` endpoint is a data mutation. A production client should require an explicit user action, show the number of rows being pushed, and report partial provider or Sheets failures clearly. The API does not infer consent from a discovery request.

## Operational checklist

| Control | Safe practice |
| --- | --- |
| GitHub secrets | Store `ADMIN_SECRET`, Cloudflare deployment credentials, signing material, and provider keys only as secrets |
| Worker bindings | Use secret bindings for provider keys and the credential-encryption key |
| Logs | Do not print tokens, API keys, service-account JSON, or complete request bodies |
| CORS | Keep allowed origins limited to the production frontend and approved development origins |
| Access | Protect admin endpoints with a separate admin secret and never expose it to the browser |
| Deletion | Provide a clear-all path that removes local workspace data and a separate credential-clear path |
| Reviews | Treat third-party provider responses as untrusted data and validate before display or export |

## Incident response

If a secret is exposed, revoke or rotate it at the issuing provider, replace the Cloudflare binding or GitHub secret, review recent workflow and Worker logs, and invalidate affected sessions if required. Do not attempt to conceal the exposure by editing documentation history; preserve an internal incident record and rotate first.

# Contributing

Documentation changes should be proposed through a focused branch or pull request. Explain the user problem, identify the affected API or workflow, and keep examples free of secrets and real customer data.

## Content changes

Use Markdown under `docs/`, update `smartgen.yml` when adding or renaming a page, and keep navigation labels concise. Prefer a short explanatory paragraph followed by a table or example where that improves clarity.

## API changes

When a Worker route changes, update the endpoint inventory, request and response examples, error behavior, data model, and changelog together. Confirm that examples use placeholders and that the documented authorization matches the implementation.

## Validation

Run:

```bash
smartgen-docs build
```

Then review the generated site for broken links, missing assets, incorrect code fences, and mobile navigation problems. The repository workflow performs a clean build before deployment.

## Review expectations

A reviewer should check factual alignment with the current Worker, secret hygiene, security language, and whether a proposed workflow accidentally turns a review-first operation into an automatic data mutation. Keep changes reversible and document migration or rotation steps when configuration names change.
# Account and BYOK

These endpoints operate on the authenticated account. BYOK endpoints additionally require the account to be enabled as paid by the administrator workflow.

## Read credential status

`GET /api/account/credentials`

The response contains safe presence metadata, for example:

```json
{
  "success": true,
  "credentials": {
    "google_maps": {"configured": true, "masked": "••••A1b2"},
    "gemini": {"configured": false},
    "google_service_account": {"configured": false}
  }
}
```

The exact masked representation may change. Clients must treat `configured` as the authoritative boolean and must not infer state from whether an input field contains text.

## Save credentials

`POST /api/account/credentials`

```json
{
  "google_maps_api_key": "runtime-secret",
  "gemini_api_key": "runtime-secret",
  "google_service_account_json": "runtime-json-or-empty"
}
```

Only non-empty fields are saved or replaced. The Worker encrypts values before writing them to D1. A client should clear its input controls after a successful response and refresh the safe status endpoint.

## Clear credentials

`DELETE /api/account/credentials`

This removes the account's encrypted credential fields. It does not delete the account, local lead workspace, or target Google Sheet. After clearing, a paid user returns to the managed Pro mode until another provider key is successfully configured.

## Sheet access check

`POST /api/account/sheet-check`

```json
{
  "sheet_id": "YOUR_RUNTIME_SHEET_ID_OR_URL"
}
```

The endpoint verifies that the configured service account can access the target spreadsheet. It should be used before a first export and after a spreadsheet owner changes sharing permissions.

## Privacy contract

The API never returns a decrypted API key or the full service-account JSON. A frontend should show a blank input after save, a masked configured state, and a clear success or error message. Never display an actual key in a toast, browser URL, console log, analytics event, or screenshot.
# Authentication

NexusLeads uses account credentials to create bearer sessions. The API never returns a password hash and does not accept provider secrets as part of signup or login.

## Signup

`POST /api/auth/signup`

```json
{
  "email": "developer@example.com",
  "password": "runtime-supplied-password"
}
```

The service normalizes the email and rejects invalid or duplicate accounts. Store the returned session token in a protected runtime location. Do not include it in analytics events, URLs, screenshots, or client-side error reports.

## Login

`POST /api/auth/login`

```json
{
  "email": "developer@example.com",
  "password": "runtime-supplied-password"
}
```

A successful login returns the authenticated user and a session token. If login fails, the client should show a generic authentication error and avoid revealing whether an email address exists.

## Current user

`GET /api/auth/me`

```bash
curl -sS \
  https://nexusleads-api.mahmudajenny6.workers.dev/api/auth/me \
  -H 'Authorization: Bearer YOUR_RUNTIME_SESSION_TOKEN'
```

The current-user response is the source of truth for account identity and paid eligibility. The response may include `is_paid`; it must never include decrypted credentials.

## Logout

`POST /api/auth/logout`

The Worker invalidates the current bearer session. Clients should clear local token state whether or not the server returns a successful response.

## Session handling rules

| Situation | Client action |
| --- | --- |
| `401` from a private endpoint | Clear token and route to login |
| User clicks logout | Call logout, then clear token locally |
| User is activated for paid BYOK | Refresh `/api/auth/me` and `/api/usage` before changing UI mode |
| Browser tab is reopened | Restore token only from the chosen protected storage mechanism, then validate with `/api/auth/me` |
| Token appears in an error or analytics payload | Treat as a security incident and rotate/invalidate it |

## CORS and origins

The production frontend origin should be allow-listed by the Worker. A development client should use an approved development origin or a local proxy rather than weakening production CORS to `*`.
# Enrichment and Export

NexusLeads keeps provider enrichment separate from export. This lets a client review fields, generate optional drafts, select specific rows, and push a bounded batch only after explicit confirmation.

## Enrichment

`POST /api/enrich`

```json
{
  "leads": [
    {
      "place_id": "provider-place-id",
      "name": "Example Business",
      "address": "Austin, TX",
      "website": "https://example.com"
    }
  ],
  "verified_only": true,
  "generate_outreach": true,
  "draft_type": "proposal",
  "marketing_style": "professional, concise, consultative"
}
```

Enrichment may add public phone, email, social profiles, website metadata, category, rating, verification information, and optional outreach drafts. `verified_only` is a client preference that filters for the platform's supported public phone-and-email requirement; it does not turn missing data into a guess.

## Outreach skills

The current Worker exposes skills including `general`, `proposal`, `marketing`, `offering`, `partnership`, `website`, `seo`, `developer`, `real_estate`, `freelancer`, and `follow_up`. A client should send the stable key when available and display the returned draft type to the user.

Drafts are not delivery actions. They are editable suggestions with sender and support context configured by the platform. A client must not silently send them to a lead.

## Export

`POST /api/export`

```json
{
  "sheet_id": "YOUR_RUNTIME_SHEET_ID_OR_URL",
  "leads": [
    {
      "name": "Example Business",
      "category": "service",
      "phone": "+1 555 0100",
      "email": "hello@example.com",
      "address": "Austin, TX",
      "website": "https://example.com",
      "rating": 4.6,
      "verification": "public phone and email",
      "source": "google_places"
    }
  ],
  "leads_sheet_tab": "Leads",
  "outreach_sheet_tab": "Outreach"
}
```

The Worker writes lead fields to the Leads tab and outreach fields to the Outreach tab when drafts are present. The dashboard sends selected rows only and limits a manual push to 50, 100, or 200 rows. The Worker chunks larger requests into safer provider operations where configured.

## Export result handling

A client should inspect the response for both top-level success and nested Sheets status. The UI should display a clear `Synced` state only after the API confirms success. If the response is ambiguous because of a network timeout, do not automatically repeat the same batch without checking the Sheet.

## CSV fallback

The web dashboard can download selected or all local workspace rows as CSV. CSV export is local and does not change the Google Sheet. It is the recommended fallback when the user wants a file without changing external data.
# Lead Discovery

`POST /api/discover` starts the candidate discovery phase. It accepts a structured keyword and location or an interpreted research prompt. The Worker normalizes provider results into a stable lead shape for later enrichment and review.

## Structured request

```json
{
  "keyword": "freelance web developers",
  "location": "Dhaka, Bangladesh",
  "max_results": 50,
  "client_id": "your-application-instance-id"
}
```

## Prompt request

```json
{
  "prompt": "Find newly launched businesses in Dhaka that may need a website, with public phone and email when available",
  "max_results": 40,
  "client_id": "your-application-instance-id"
}
```

`max_results` is constrained by the product's configured limits. A client should honor the returned count rather than assume that the requested number is always available.

## Candidate response shape

A candidate can contain fields such as:

```json
{
  "place_id": "provider-place-id",
  "name": "Example Business",
  "category": "service",
  "address": "Dhaka, Bangladesh",
  "website": "https://example.com",
  "rating": 4.6,
  "source": "google_places"
}
```

Discovery results are public-business candidates, not guaranteed contacts. A missing website, phone, or email should be preserved as missing and handled in the client UI.

## Credit reservation

The free path may reserve credits before provider work begins and return a reservation identifier. When a client receives a reservation identifier, it should send the actual number of usable leads to the settlement flow supported by the current Worker implementation. If a request fails before producing leads, the client should follow the response contract and avoid assuming that all reserved credits were consumed.

Paid and BYOK behavior is evaluated from the authenticated account and current credential status. Do not attempt to bypass the limit by changing `client_id` values; anonymous identifiers are hashed and are not a substitute for account authorization.

## Safe client behavior

A discovery button should show progress, preserve previous workspace rows, and make it clear that no spreadsheet mutation has happened. The web dashboard merges new results with the saved local workspace and de-duplicates by provider identifier when present.

## Provider limitations

The service depends on provider quotas, public data availability, location quality, and network responses. A successful discovery call means candidates were returned; it does not guarantee that every candidate will have a phone number, email address, or valid website.
# Errors

NexusLeads uses standard HTTP status categories and a JSON error object. A client should show a useful message without echoing secrets or complete provider responses.

## Status codes

| Status | Meaning | Recommended action |
| --- | --- | --- |
| `400` | Invalid JSON or missing required field | Validate the request and show the missing field |
| `401` | Missing, expired, or invalid bearer session | Re-authenticate and retry once after user action |
| `403` | Authenticated but not permitted, such as unpaid BYOK access | Explain the account requirement; do not retry in a loop |
| `404` | Unknown route or user/resource not found | Check the path or account identifier |
| `409` | Account or state conflict, such as duplicate signup | Refresh account state and ask the user to choose another action |
| `429` | Provider or platform limit reached | Show quota information and wait according to the response |
| `500` | Unexpected Worker or provider failure | Preserve the workspace, capture a request timestamp, and retry cautiously |
| `503` | Required binding or provider is not configured | Treat as an operator/deployment issue |

## Error shape

```json
{
  "success": false,
  "error": "Daily free limit reached."
}
```

Some responses may include a nested provider or Sheets explanation. Display a concise version in the UI and keep the raw response out of public logs.

## Common fixes

### `Unauthorized admin secret`

This response belongs to the protected paid-activation workflow. Verify that the GitHub repository secret is named exactly `ADMIN_SECRET`, that it is available to the workflow environment, and that the Worker has the matching admin binding. Never print the secret while debugging.

### BYOK shows Paid but not BOYOK

Paid status unlocks the configuration surface; it does not mean a personal key has been stored. Call `GET /api/account/credentials` and `GET /api/usage`. If `byok.maps` is false, save a valid key through the authenticated endpoint and refresh the status.

### Google Sheets export failed

Confirm that the spreadsheet is shared with the configured service account as Editor, that the supplied value is a valid Sheet ID or URL, and that the intended `Leads` and `Outreach` tabs can be created or written. Use `/api/account/sheet-check` before retrying.

### Daily free limit reached

Use the values returned by `/api/usage`. Do not change a client identifier to evade quotas. A paid account may use managed Pro or personal BYOK depending on the current configuration; the API response is authoritative.
# Usage and Pricing

## Usage

`GET /api/usage` returns the authenticated account's current plan and provider configuration state. A typical response is conceptually similar to:

```json
{
  "success": true,
  "plan": "free",
  "credits": {
    "used": 12,
    "limit": 100,
    "remaining": 88,
    "reset_utc": "00:00 UTC"
  },
  "byok": {
    "maps": false,
    "gemini": false,
    "service_account": false
  }
}
```

The exact fields can expand. Clients should ignore unknown fields and use the server response as the source of truth for the live badge.

## Pricing estimate

`GET /api/pricing` returns a planning estimate based on the Worker configuration. It is not an invoice and does not replace current provider pricing pages. The estimate may include assumptions for Google Places requests, public-page enrichment, Gemini token usage, Cloudflare service capacity, and the selected product markup model.

| Usage concept | Meaning |
| --- | --- |
| `freeDailyLeads` | The configured free daily lead allowance |
| `google_places` | Planning estimate for discovery requests |
| `firecrawl` | Planning estimate for public-page enrichment capacity |
| `gemini` | Planning estimate for optional draft generation |
| `paid_tier` | Product planning figures, not a billing statement |

Provider prices and quotas change. Before publishing a commercial plan, verify the current pricing pages for Google Maps Platform, Firecrawl, Gemini, Cloudflare Workers, and Google Sheets.

## Mode selection

A client should compute the visible mode from the authenticated user and usage response:

```js
function modeFor(user, usage) {
  if (!user) return "SIGNED_OUT";
  if (!user.is_paid) return "FREE";
  if (usage?.byok?.maps) return "BOYOK";
  return "PRO";
}
```

This mapping keeps the user-facing badge aligned with the actual account state. It also prevents a stale local badge from suggesting BYOK is active when the encrypted credential was cleared.

## Quota messaging

When the free allowance is exhausted, explain the current used and limit values and present the available next step. Do not claim that BYOK is active unless the usage response confirms the user's configured key. Do not expose provider billing details that the API did not return.
