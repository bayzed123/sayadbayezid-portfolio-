---
name: ahrefs-site-audit-fix
description: Fix SEO issues from Ahrefs Site Audit in source code (canonical, meta tags, hreflang, broken links, redirects). Use after running ahrefs-site-audit.
---

# Ahrefs Site Audit — Issue Fixer

Fix SEO issues from Ahrefs Site Audit by making actual code changes in the user's website source.

## Core Principles

- **Non-destructive**: Never overwrite or delete existing valid data.
- **Template-first**: Always check if affected pages share a template/layout/include before doing per-page fixes. One template edit can fix hundreds of pages.
- **Case sensitivity**: File paths that work on macOS may break on Linux production servers. Always match exact case of actual filenames.
- **Verify targets**: Before setting canonical/hreflang URLs, verify the target page exists and returns HTTP 200.
- **Safety first**: Any fix can break the website. Make changes reviewable (clear git diffs). When uncertain, flag to the user rather than auto-fixing.

## Understand the Site First

Before fixing any issue, understand how the site is built:

1. **Check `CLAUDE.md`** in the project root — may contain prior analysis
2. **Detect the tech stack** — explore the project structure, config files, and templates. If the setup is ambiguous or unfamiliar, read `references/framework-patterns.md` for detection heuristics and template locations. For CMS sites (WordPress, Shopify), also identify which SEO plugin manages meta fields
3. **Map the template/layout hierarchy** — which files control `<head>`, `<html>`, navigation, footer
4. **Understand i18n/localization** structure (if multilingual)
5. **Document findings** in `CLAUDE.md` for future sessions

**No source code access?** If the project source code or database is not available, switch to spec mode: follow the same workflow (pull pages, analyze, read fix guides) but instead of making code changes, produce a detailed fix spec the user can hand to their developers. For each issue include: affected URLs, what needs to change, exact fix instructions (HTML/config snippets), and priority.

## Fix Workflow

### Step 0: Find the Project and Its Open Issues

Project registry lives on `ahrefs_dashboard`, not `ahrefs_site_audit`:

```python
invoke_connector("ahrefs_dashboard.list_projects", "ahrefs_oauth",
                 {"search": "<user's domain>", "per_page": 50})
# per_page accepts 10/25/50 — `limit` is NOT a valid arg here

invoke_connector("ahrefs_site_audit.get_project_issues", "ahrefs_oauth",
                 {"project_id": project_id})
# Each issue exposes `pages_filter_id` (32-hex MD5) — needed by Step 2.
```

### Step 1: Understand the Issue

Read `references/issues-meta.md` and find the issue by name. This file contains the **required columns** to pull from the API, the fix strategy, and which category reference file has the detailed fix guide. You must use the columns listed there when calling the page explorer.

Then read the category reference file for the detailed fix guide:

- **Indexability + Duplicates** → `references/issues-indexability.md`
- **Content** → `references/issues-content.md`
- **Links + Internal pages + External pages** → `references/issues-links.md`
- **Redirects** → `references/issues-redirects.md`
- **Localization** → `references/issues-localization.md`
- **Social tags** → `references/issues-social.md`
- **Sitemaps** → `references/issues-sitemaps.md`
- **JavaScript + CSS + Images** → `references/issues-resources.md`
- **Usability and performance** → `references/issues-performance.md`
- **Other** → `references/issues-other.md`

**Custom issues**: Users can create custom issues in Site Audit. If the issue name is not in `references/issues-meta.md`, there is no predefined fix guide or column list. Infer the issue's purpose from its name, pull sample pages to understand what data is available, and consult the user on the fix approach.

### Step 2: Pull Affected Pages

Use `export_many` scoped by the issue's `pages_filter_id` from Step 0:

```python
invoke_connector("ahrefs_site_audit.export_many", "ahrefs_oauth", {
    "project_id": project_id,
    "dataset": "pages",
    "filter_id": pages_filter_id,
    "fields": ["url", "traffic", "httpCode", "title"],   # from Step 1's column list
    "limit": 200,
    "sort": [{"field": "traffic", "direction": "desc"}],   # `direction` (not `order`); `asc`/`desc`
})
```

**Field names**: `fields` and `sort.field` use wire names. Mostly camelCase (`httpCode`, `metaDescription`, `linksCountInternal3xx`), some snake_case (`found_in_sitemaps`, `top_keyword`, `ai_content_level`). Copy verbatim from `references/issues-*.md`. Unknown column → `validation_error: unknown field "<name>" in table "pages"`.

The **`compliant`** field is the indexability flag. A page is "indexable" (`compliant=true`) when it returns HTTP 200, has no `noindex` directive, and has no `rel=canonical` pointing to a different URL. Use it to prioritize indexable pages for Content and Links issues.

**Pagination**: `export_many` uses `limit` (max 10000) + `offset`. Page by stepping `offset` until `len(records) < limit`.

### Step 3: Verify the Issue Is Real

Site Audit crawls may not be current. Before changing code, verify the issue actually exists in the current source. Check a few affected pages in actual source code. For JS-heavy sites, Site Audit may report false positives when page rendering fails (e.g., "missing title" when JavaScript populates it). Skip confirmed false positives.

### Step 4: Plan the Fix

Analyze patterns: group URLs by path prefix, identify which use shared templates vs standalone structure. Use `where` filters in `site_audit_page_explorer` to narrow pages into actionable subgroups when needed:

- `{"field": "url", "op": "starts_with", "value": "https://example.com/blog/"}` — focus on one site section
- `{"field": "compliant", "op": "is_true"}` — indexable pages only
- `{"field": "hreflangGroupHash", "op": "=", "value": "<hash>"}` — isolate one hreflang group
- `{"field": "hashContent", "op": "=", "value": "<hash>"}` — find pages with identical content
- `{"field": "traffic", "op": ">", "value": 100}` — prioritize high-value pages
- Combine with `{"and": [...]}`, `{"or": [...]}`

Then decide the approach:
- Template pages → fix the template (covers most pages), then handle exceptions individually
- Unique structures → per-page fixes
- Configuration issues → config fix (sitemap, robots.txt, server config)
- Confirm with user before proceeding if the change is large

### Step 5: Implement and Verify

Apply changes following the issue-specific guide. Then verify:

- **Template fixes**: check source code of at least 3 different pages that use the template
- **Per-page fixes**: verify each changed page
- **Config fixes** (sitemaps): validate XML structure
- **Local dev server available?** Curl/fetch pages and check rendered HTML output
- After template fix, re-check if any pages with the issue are NOT covered by the template — handle those separately
- **Ask the user to verify**: provide a few example page URLs so they can check the fix in a browser

### After the Fix

Update the project's `CLAUDE.md` with insights that help fix future issues: tech stack details, template structure, edge cases discovered, useful patterns, known false positives. Focus on forward-looking knowledge, not a log of what was already fixed.

## Fix Strategy Types

Strategies in `references/issues-meta.md` are recommendations. Always revise based on actual site architecture.

- **Template fix**: Identify the shared layout/include file, make the change once. Always verify all affected pages use this template.
- **Per-page fix**: Requires understanding individual page context. Read each page's content before fixing. For content-dependent issues (e.g., missing titles), analyze actual content to generate appropriate fixes — don't use mechanical shortcuts like "copy H1 to title".
- **Config fix**: Sitemap, robots.txt, server config. Preserve all valid existing data.
- **Investigate**: Some issues are monitoring/notification-oriented (e.g., "Organic traffic dropped", "Pages dropped from Top 10"). Present data to the user, suggest possible causes, wait for their decision, then implement.

## CMS Sites (WordPress, Shopify, etc.)

On CMS-based sites, template/theme fixes work normally (edit PHP/Liquid files), but per-page content (titles, meta descriptions, OG tags, body content) is stored in a database — not in files.

When the issue requires per-page content changes, ask the user which access method is available (direct SQL, CMS API, etc.) before proceeding. Then generate a script with all changes, explain what it does, and let the user review and run it.

## `where` Filter Syntax

The `where` parameter is a dict passed to `site_audit_page_explorer(where=...)`:
```
{"and": [<filter>, ...]}   {"or": [<filter>, ...]}
```
Each leaf filter: `{"field": "<column>", "op": "<operator>", "value": <value>}`

Operators: `=`, `!=`, `>=`, `<=`, `>`, `<`, `starts_with`, `not_starts_with`, `contains`, `not_contains`, `regexp`, `not_regexp`, `is_true`, `is_false`, `exists`, `not_exists`.
