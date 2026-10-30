# Primalore

Verified survival knowledge in a dystopian wrapper. Static site (Astro) at https://primalore.app, content stored as Markdown in this repository.

## How it works

- Content lives in `src/content/<category>/<slug>.md` with front-matter defined in `src/content.config.ts`.
- `npm run validate` enforces the risk rules (sources, expert review, species cards, news dates). It runs on every pull request.
- `format` (`article`, `step-by-step`, `video`) picks the guide layout; `video` also needs an https `video_url`.
- The interface follows the approved design: tokens live in `src/styles/global.css` (dark by default, light by system setting or the toggle in the header).
- Only `review_status: published` content appears on the site.
- High and critical content cannot reach `expert-approved` or `published` without `reviewed_by` and at least two sources (critical: two independent publishers).
- Each AI draft will arrive as a pull request. Merging it is publishing it.

## Commands

```
npm install
npm run dev        # local site
npm run validate   # content checks only
npm run build      # validate + build + search index
```

## Roadmap

See the Faz 1 document: levels, content types, risk tiers and the schema this repository implements. Next: source inventory (Faz 2), design system (Faz 3), daily pipeline (Faz 5).
