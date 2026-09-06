# sayadbayezid.com

The portfolio and content site for Sayad Md Bayezid Hosan — Connect with
Bayezid. Static HTML, no bundler, deployed to GitHub Pages from `main`.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `services.html`, `projects.html`, … | Hand-written pages |
| `blog-posts/*.md` | Blog sources — front matter + Markdown |
| `content/**` | Case study and news sources |
| `blog/`, `case-studies/`, `news/` | **Generated. Do not edit by hand.** |
| `scripts/build-blog.js` | `blog-posts/*.md` → `blog/` |
| `scripts/build-content.js` | `content/**` → `case-studies/`, `news/` |
| `assets/` | Styles, scripts, images |

Anything under `blog/`, `case-studies/` or `news/` is rebuilt by
`.github/workflows/build-content.yml` on every push that touches a source
file or a generator, and the result is committed back to `main`. A fix
applied to generated HTML will be overwritten on the next push — change the
generator or the Markdown source instead.

## Building locally

```
npm install
npm run build        # blog + case studies + news
```

Both generators are idempotent: running them twice produces no second diff.

## The API is a separate repository

The site talks to a Cloudflare Worker at
`bayezid-agency-api.sayadmdbayezidhosan.workers.dev` for reviews, the contact
form, page ratings and comments, and Meta Conversions API delivery.

That Worker lives in **[bayzed123/bayezid-agency-worker](https://github.com/bayzed123/bayezid-agency-worker)**
and deploys itself from its own `main`. It is not built from this repository.

This repo used to carry a copy of the Worker source in `worker/` and `src/`,
plus a manual "Legacy agency Worker deploy" workflow. Both copies had drifted
well behind the real one while still declaring the same Worker name, so
running that workflow would have replaced the live API with stale code. The
workflow never actually got that far — it failed at type-checking, because
`worker/` had no `package.json` or `tsconfig.json` of its own and so resolved
this repo's, which has neither `@cloudflare/workers-types` nor `wrangler`.
The duplicates and the workflow have been removed. Deploy the API from its
own repository.
