# Content system — case studies, news, blog

## What changed on the existing pages (`site-updates/`)
- Nav: added a "Client Login" link before "Start a project," on all 6 pages
- Footer: added a "SmartGen Docs" link (docs.smartgentools.com), on all 6 pages
- `work.html`: the two case studies now use a proper 2×2 card grid instead of
  plain wrapped paragraphs — this is the fix for the "doesn't look clear" feedback
- Just replace your existing files in the site repo with these — same names, same locations.

## The new system (`scripts/` + `content/`)
Drop a folder in `content/case-studies/`, `content/news/`, or `content/blog/`,
each containing a `meta.json` (see the example), run the script, get a page.

```
node scripts/build-content.js
```

This is JavaScript (Node.js) — no Python needed anywhere in this pipeline,
same language as the rest of the site's tooling and SmartGen's own
`build-blog.js`, so there's one toolchain instead of two.

### Adding a new entry
1. Make a folder: `content/case-studies/my-new-project/`
2. Add a `meta.json` inside it (copy `content/case-studies/example-entry/meta.json` as a starting point)
3. For video: put the YouTube video ID in `"youtube"`, or a Google Drive file ID in `"googleDriveVideoId"` — either embeds directly, nothing gets uploaded anywhere
4. For audio: put your SoundCloud track/profile URL in `"soundcloud"` — e.g. `https://m.soundcloud.com/syed-bayzed`
5. For images: drop small image files in the same folder and list their filenames in `"images"`
6. Run `node scripts/build-content.js`
7. It generates `case-studies/my-new-project.html` and refreshes `case-studies.html` (the listing page) — copy the `case-studies/` folder and `case-studies.html` into your site repo

### Automating it (optional)
Add `.github/workflows/build-content.yml` to your **site** repo (the YAML is
commented at the bottom of `scripts/build-content.js`) so pushing a new
`content/` folder regenerates and commits the pages automatically — no need
to run the script yourself each time.

### Note on `work.html` vs the new `case-studies.html`
`work.html` is your existing hand-written page with the SmartGen and
SmartLeadGen write-ups — that stays as-is. `case-studies.html` is a new,
separate listing for whatever you add through this folder system going
forward. Once you've added a few, I can merge them into one page if you'd
rather have a single Work section instead of two.
