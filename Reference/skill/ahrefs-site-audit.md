---
name: ahrefs-site-audit
description: Discover, prioritize, and fix SEO issues from Ahrefs Site Audit. Use for site-health checks, health-score improvement, or when user mentions Site Audit.
---

# Ahrefs Site Audit — Discovery & Triage

Use the Ahrefs Connectors framework (`ahrefs_site_audit.*` provider) to discover Site Audit issues, prioritize by impact, and guide the user through fixing them. The shared OAuth secret is `ahrefs_oauth`.

## Prerequisites

- Workspace owner has connected Ahrefs (so `list_connector_secrets(provider="ahrefs")` shows `ahrefs_oauth` with `status: "active"`).
- Site Audit project exists for the user's site (they must have run a crawl in Ahrefs).

## Workflow

### Step 1: Find the Project

`ahrefs_site_audit` has no project-listing connector — projects live in the central registry. Search by the user's domain (server-side substring match on `name` + `target`):

```python
# only_verified=True: Ahrefs only crawls verified targets — unverified
# projects return null/empty across the whole audit stack.
# per_page=25 keeps the response under the 50KB truncation envelope.
invoke_connector(
    "ahrefs_dashboard.list_projects",
    "ahrefs_oauth",
    {"search": "<user's domain>", "only_verified": True, "per_page": 25},
)
```

If the user gave a URL, strip scheme / `www.` / path before searching. Walk `page=2, 3, …` while `pages > 1`. On zero hits try variants (with/without `www.`, root domain vs. subdomain) before reporting "not found".

If `only_verified=True` returns zero but unfiltered finds matches, the user hasn't completed ownership verification. Tell them to verify via TXT record or file upload (Ahrefs → project → Settings → Ownership) and re-run — don't audit anyway, every connector returns empty for unverified projects.

### When no project exists

If the search returns zero hits across all variants (with/without `www.`, root vs. subdomain) — **and** an unfiltered search (`only_verified=False`) also finds nothing — the site has no Site Audit project in Ahrefs at all. Don't report a bare "not found"; guide the user to create one:

1. **Add the site as a project** — Ahrefs → **Dashboard → New project** → enter the domain/URL and choose scope (domain, subdomain, or prefix).
2. **Verify ownership** — via DNS TXT record or HTML file upload (project → Settings → Ownership). Site Audit only crawls verified targets.
3. **Run the first crawl** — project → **Site Audit → Run crawl** (or wait for the scheduled crawl). Audit data is empty until a crawl completes.
4. Once the crawl finishes, re-run this workflow from Step 1.

If a project exists but is **unverified** (matches under `only_verified=False` but not with the filter), skip straight to step 2 — they only need to verify, not recreate.


Pick the record whose `target` matches; if multiple, ask which. Key fields: `id`, `name`, `target`, `is_verified`, `is_frozen`.

For health score, pass both `project_id` AND `target` (both required; `target` is on the `list_projects` row, or fetch it via `ahrefs_dashboard.get_project({project_id})` if you already have an id but no domain to search by):

```python
invoke_connector(
    "ahrefs_site_audit.health_score",
    "ahrefs_oauth",
    {"project_id": project_id, "target": project_target},
)
```

Returns `metrics` (`health_score` 0–100, `crawled` / `redirect` / `broken` / `blocked` page counts), `previous_crawl` (`date` + `delta_*` for each metric — positive = "more now"), `timeframe`, plus `has_data` / `status` / `date` (crawl timestamp — use for freshness checks).

### Step 2: Get Issues

```python
invoke_connector("ahrefs_site_audit.get_project_issues", "ahrefs_oauth", {"project_id": project_id})
```

Key fields per issue: `issue_id`, `name`, `level` (Critical / Warning / Notice), `typ` (category), `kind`, `count`, `is_active`, `is_patchable`, `is_indexable`, `pages_filter_id` (reusable as `filter_id` to scope follow-up queries), `links_filter_id`.

### Step 3: Determine Fix Strategies

Assign a fix strategy to each issue. The four strategy types:

| Strategy | Meaning |
|----------|---------|
| template | Fix shared layout/template — one edit fixes many pages |
| per-page | Fix requires understanding individual page context |
| config | Fix in sitemap, robots.txt, or server configuration |
| investigate | Present data to user, don't auto-fix — requires user decision |

Strategy often follows from the issue name or category (sitemap/robots → config; "organic traffic dropped" → investigate). When unclear, sample affected pages via `export_many` scoped to the issue's `pages_filter_id` (from the Step 2 record):

```python
invoke_connector("ahrefs_site_audit.export_many", "ahrefs_oauth", {
    "project_id": project_id,
    "dataset": "pages",
    "filter_id": pages_filter_id,
    "fields": ["url"],
    "limit": 20,
})
```

Shared URL prefixes → template fix; diverse paths → per-page.

**Finding the page that contains a broken link**: the `links` dataset names the source page — pull `source.url` from the crawl, don't infer the page from its URL (the data names it exactly; guessing fabricates). Scope to the issue you're triaging by its `links_filter_id` from Step 2 (same pattern as the pages query above, and more precise than re-deriving the broken set); for a standalone "find broken links" ask with no issue in hand, filter `target_info.code` in the 4xx/5xx range instead.

```python
invoke_connector("ahrefs_site_audit.export_many", "ahrefs_oauth", {
    "project_id": project_id,
    "dataset": "links",
    "filter_id": links_filter_id,   # the issue's links_filter_id (Step 2); standalone instead:
                                     # filter={"and":[{"field":"target_info.code","op":">=","value":400}]}
    "fields": ["source.url", "target.url", "anchor", "target_info.code"],
    "limit": 100,
})
```

### Step 4: Present Prioritized Report

Produce a single report. Group issues by importance: **Critical** first, then **Warning**, then **Notice** (matches the `level` values returned by `get_project_issues`). Within each group, sort by prioritization score descending.

Score each issue: `importance_weight × page_count × fix_leverage`

| Factor | Values |
|--------|--------|
| importance_weight | Critical=3, Warning=2, Notice=1 |
| fix_leverage | template=3, config=2, per-page=1, investigate=1 |

For each issue include: name, affected page count, detected pattern/fix strategy, score.

**is_indexable pairs**: Some issues in the **Content** and **Links** categories exist in pairs with the same name — one for indexable pages (higher importance), one for non-indexable. Prioritize the indexable variant. This only applies to these two categories.

**Ask the user which issues to tackle** — do not auto-fix everything.

### Step 5: Fix Selected Issues

When the user selects an issue, use the `ahrefs-site-audit-fix` skill. Pass context: issue name, issue_id, affected page count, sample URLs, detected pattern.

When fixing, pull **ALL** affected pages (not just the sample) — subject to API row limits.

After each issue is fixed:
- Update the project's `CLAUDE.md` (create if it doesn't exist) with: tech stack and template structure, edge cases, fix patterns that worked, known false positives.
- Ask the user: fix the next issue? commit/PR the current changes first? review what was changed?

Never batch-fix multiple issues silently — checkpoint with the user between issues. In future sessions, read `CLAUDE.md` first to build on previous knowledge.

## Reference

### Crawl Freshness

Crawl data may be stale — check the `date` field on the project / health score. Some issues may already be fixed on the live site, and JS-heavy sites may have false positives. However, do not dismiss issues without verifying against actual source code first.

### Row Limits

The API caps rows per call by Ahrefs subscription plan. Paginate when an issue affects more pages than the connector returns. Site Audit data connectors use `limit` + `offset` together (e.g. `export_many`, `get_project_issues`); cross-product dashboard connectors use `page` + `per_page` (enum 10/25/50). Most Site Audit connectors don't paginate — `describe_connector(id)` to check, then segment by URL prefix via the filter dict when there's no native pagination.

### Connector Reference

Discover all Site Audit actions:

```python
list_connectors(provider="ahrefs_site_audit")
```

Read the per-concept doc before invoking — the `ahrefs-site-audit-connector` skill (auto-loaded by name) links each `<concept>.md` covering args, filter dict, result fields, worked examples. Typed schemas via `describe_connector(connector_id)`.

Quick map of the actions referenced above:

| Use case | Connector |
|---|---|
| List projects (cross-product registry) | `ahrefs_dashboard.list_projects` |
| Single project by id (returns `target` for `health_score`) | `ahrefs_dashboard.get_project` |
| Project health score (latest crawl + delta vs. previous) | `ahrefs_site_audit.health_score` |
| Issues found by the most recent crawl | `ahrefs_site_audit.get_project_issues` |
| Single issue detail | `ahrefs_site_audit.get_project_issue_by_id` |
| Pages affected by an issue (URL-level) | `ahrefs_site_audit.export_many` with `filter_id=<issue's pages_filter_id>` |
| Page that contains a broken/external link | `ahrefs_site_audit.export_many` links dataset, scoped by the issue's `links_filter_id` (or filter `target_info.code` 4xx/5xx), project `source.url` |
| Issues affecting a single URL | `ahrefs_site_audit.get_url_issues` |
| Per-URL crawl details | `ahrefs_site_audit.get_url_details` |
| Page-level filter helper | `ahrefs_site_audit.get_filter` |
| Crawl history for the project | `ahrefs_site_audit.crawls` |
| Activate / deactivate an issue | `ahrefs_site_audit.activate_issue_for_project` |

(49 total connectors in the group — the table above is the most common subset for the discovery+triage flow this skill covers.)

Args use `extra="forbid"` — fields not declared in the connector's schema produce a hard validation error. If you need a parameter that isn't documented, the connector doesn't expose it; either filter the result client-side or check sister connectors via `list_connectors`.
