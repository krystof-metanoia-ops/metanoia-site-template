# Metanoia one-page site template

Renders a client's `site.json` and `images/` into a static one-page site: header, hero, statement, card grid, people with bio pop-ups, a carousel, and a contact form that uses Netlify Forms. There are no dependencies.

Each client repo holds only its content and a `netlify.toml`. That file clones this repo's **`stable`** branch at build time and runs:

    node .template/build.mjs --content . --out dist

- Work on `main`. Merge into `stable` when a change is ready for every client site.
- A push to `stable` reaches each site on its next build. To make that build happen immediately, have this repo call the site's Netlify build hook.

Section types: `hero`, `statement`, `cards`, `people`, `carousel`, `contact`. See a client's `site.json` for the fields each one takes.

## Opt-in options (added 2026-10-29)

All optional. A site.json that uses none of them builds byte-identical HTML to before (checked by building an
old site.json with both versions and diffing).

- `theme.skin: "bold"` — dark header, pill buttons, uppercase nav, footer meta line.
- `site.header_cta {label, href}` · `site.social [{label, href}]` · `site.footer_text [..]` · `site.og_image`.
- Any new layout section: `tone` (`dark` | `light` | `accent`), `eyebrow`, `intro` (string or list), `outro`.
- Headings: `==word==` highlights a word in the accent colour.
- `hero.layout: "split"` (+ `eyebrow`, `text`, `tagline`, `image`, `cta2`) · `cards.layout: "tiles"` (item `num`, `tag`)
  · `people.layout: "cards"` (full bios on the card) · `carousel.layout: "grid"` (+ `filter: true`, item `category`, `name`)
  · `contact.layout: "plain"`.
- New section types: `strip` · `text` (`lead`, `left`, `text`, `quote`, `bullets`, `regions`, `aside`, `stats`) · `quote` · `notice`.
- `--relative` build flag: relative paths, for a preview opened from disk (file://). Never used on Netlify.
- v3 (2026-10-29): `theme.skin` may be a list (`["bold","light"]` = light header/hero/footer on the bold layouts) ·
  tone `white` · hero `decor: true` (soft drifting colour fields) and `type_eyebrow: true` · `theme.motion: true`
  (sections fade up on scroll, typed eyebrow; off under reduced-motion and without JS) · 5 tiles lay out 2 + 3.
