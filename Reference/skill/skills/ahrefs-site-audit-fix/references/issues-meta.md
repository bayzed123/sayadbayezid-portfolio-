| External 3XX redirect | Notice | per-page | pageRating, url, traffic, httpCode, contentType, depth, redirect, incomingAllLinks | issues-links.md |
| External 4XX | Notice | per-page | pageRating, url, traffic, httpCode, contentType, depth, incomingAllLinks | issues-links.md |
| External 5XX | Notice | per-page | pageRating, url, traffic, httpCode, contentType, depth, incomingAllLinks | issues-links.md |
| External time out | Notice | per-page | pageRating, url, traffic, httpCode, contentType, depth, incomingAllLinks | issues-links.md |

## Redirects (10 issues)

| Issue Name | Level | Strategy | Columns | Guide |
|------------|-------|----------|---------|-------|
| Broken redirect | Error | per-page | pageRating, url, traffic, httpCode, redirect, incomingAllLinks, incomingRedirect, origin | issues-redirects.md |
| Redirect chain too long | Error | per-page | pageRating, url, traffic, httpCode, redirectChainUrls, nrRedirectChainUrls, redirect, incomingAllLinks, incomingRedirect, origin | issues-redirects.md |
| Redirect loop | Error | per-page | pageRating, url, traffic, httpCode, redirectChainUrls, nrRedirectChainUrls, isRedirectLoop, redirect, incomingRedirect, incomingAllLinks, origin | issues-redirects.md |
| 302 redirect | Warning | per-page | pageRating, url, traffic, httpCode, redirect, redirectChainUrls, isRedirectLoop, incomingAllLinks, incomingRedirect, origin | issues-redirects.md |
| 3XX redirect | Warning | per-page | pageRating, url, traffic, httpCode, redirect, redirectChainUrls, isRedirectLoop, incomingAllLinks, incomingRedirect, origin | issues-redirects.md |
| HTTPS to HTTP redirect | Warning | per-page | pageRating, url, traffic, httpCode, redirect, redirectChainUrls, isRedirectLoop, incomingAllLinks, incomingRedirect, origin | issues-redirects.md |
| HTTP to HTTPS redirect | Notice | per-page | pageRating, url, traffic, httpCode, redirectChainUrls, isRedirectLoop, incomingAllLinks, incomingRedirect, origin | issues-redirects.md |
| Meta refresh redirect | Notice | per-page | pageRating, url, traffic, httpCode, metaRefresh, redirectChainUrls, isRedirectLoop, incomingAllLinks, incomingRedirect, origin | issues-redirects.md |
| Redirect chain | Notice | per-page | pageRating, url, traffic, httpCode, redirectChainUrls, nrRedirectChainUrls, redirect, incomingAllLinks, incomingRedirect, origin | issues-redirects.md |
| Redirect target changed | Notice | investigate | pageRating, url, httpCode, redirectChainUrls, isRedirectLoop, incomingAllLinks, origin | issues-redirects.md |

## Localization (13 issues)

| Issue Name | Level | Strategy | Columns | Guide |
|------------|-------|----------|---------|-------|
| HTML lang attribute invalid | Error | template | pageRating, url, traffic, compliant, htmlLang, selfHreflang, htmlLangCodeIsValid, selfHreflangCodeIsValid, incomingAllLinks | issues-localization.md |
| Hreflang and HTML lang mismatch | Error | template | pageRating, url, traffic, compliant, htmlLang, selfHreflang, htmlLangCodeIsValid, selfHreflangCodeIsValid, incomingAllLinks | issues-localization.md |
--
| 3XX redirect in sitemap | Error | config | pageRating, url, traffic, httpCode, contentType, isInSitemap, redirect, found_in_sitemaps, incomingAllLinks | issues-sitemaps.md |
| 4XX page in sitemap | Error | config | pageRating, url, traffic, httpCode, contentType, isInSitemap, found_in_sitemaps, incomingAllLinks | issues-sitemaps.md |
| 5XX page in sitemap | Error | config | pageRating, url, traffic, httpCode, contentType, isInSitemap, found_in_sitemaps, incomingAllLinks | issues-sitemaps.md |
| Noindex page in sitemap | Error | config | pageRating, url, traffic, httpCode, contentType, isInSitemap, pageIsNoindex, metaRobots, httpHeaderRobots, found_in_sitemaps, incomingAllLinks | issues-sitemaps.md |
| Non-canonical page in sitemap | Error | config | pageRating, url, traffic, httpCode, contentType, isInSitemap, canonical, found_in_sitemaps, incomingAllLinks | issues-sitemaps.md |
| Page from sitemap timed out | Error | per-page | pageRating, url, traffic, httpCode, contentType, isInSitemap, found_in_sitemaps, incomingAllLinks | issues-sitemaps.md |
| Sitemap has syntax error | Error | config | pageRating, url, httpCode, contentType, sitemap_error, origin | issues-sitemaps.md |
| Sitemap is not accessible | Error | config | pageRating, url, httpCode, contentType, sitemap_error, origin | issues-sitemaps.md |
| Sitemap larger 50MB | Error | config | pageRating, url, httpCode, contentType, sitemap_is_index, sitemap_error, origin | issues-sitemaps.md |
| Sitemap with over 50K URLs | Error | config | pageRating, url, httpCode, contentType, sitemap_nr_urls, sitemap_is_index, sitemap_error, origin | issues-sitemaps.md |
| Sitemap in the wrong format | Warning | config | pageRating, url, httpCode, contentType, sitemap_error, origin | issues-sitemaps.md |
| Sitemap includes URLs out of its scope | Warning | config | pageRating, url, httpCode, contentType, sitemap_nr_urls, sitemap_is_index, sitemap_error, origin | issues-sitemaps.md |
| Indexable page not in sitemap | Notice | config | pageRating, url, traffic, httpCode, contentType, compliant, incomingAllLinks, isInSitemap, origin | issues-sitemaps.md |
