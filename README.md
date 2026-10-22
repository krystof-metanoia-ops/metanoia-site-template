# Metanoia one-page site template

Renders a client's `site.json` and `images/` into a static one-page site: header, hero, statement, card grid, people with bio pop-ups, a carousel, and a contact form that uses Netlify Forms. There are no dependencies.

Each client repo holds only its content and a `netlify.toml`. That file clones this repo's **`stable`** branch at build time and runs:

    node .template/build.mjs --content . --out dist

- Work on `main`. Merge into `stable` when a change is ready for every client site.
- A push to `stable` reaches each site on its next build. To make that build happen immediately, have this repo call the site's Netlify build hook.

Section types: `hero`, `statement`, `cards`, `people`, `carousel`, `contact`. See a client's `site.json` for the fields each one takes.
