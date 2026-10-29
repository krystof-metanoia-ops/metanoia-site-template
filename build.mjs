#!/usr/bin/env node
// Metanoia one-page site template: renders a client's site.json + images into a static site.
//
// Why this shape (Krystof, 2026-10-22): each client owns a repo with ONLY their content
// (site.json + images/ + netlify.toml). Netlify clones this template at build time, so a push
// here rebuilds every client site with no merges in the client repos, and the client's own
// agent (e.g. the client's ChatGPT) edits content without ever touching code. A failed build leaves the
// last good deploy live, so a bad template push can't take a site offline.
//
// Usage:  node build.mjs --content <client repo dir> [--out <dir>]   (default out: <content>/dist)
// No dependencies on purpose: Netlify's Node runs it as is, and there is nothing to npm install.

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const content = arg("--content", process.cwd());
const out = arg("--out", join(content, "dist"));
// --relative (2026-10-29, for previews opened straight from disk via file://): rewrite the root-absolute
// asset and link paths to relative ones. Netlify builds never pass it, so deployed output is unchanged.
const relative = process.argv.includes("--relative");
const rel = (html, up = "") => !relative ? html : html
  .replace(/(src|href|action)="\/(theme|images)\//g, `$1="${up}$2/`)
  .replace(/href="\/#/g, `href="${up}index.html#`)
  .replace(/href="\/"/g, `href="${up}index.html"`)
  .replace(/action="\/thank-you\/"/g, `action="${up}thank-you/index.html"`);

const site = JSON.parse(readFileSync(join(content, "site.json"), "utf8"));
const S = site.site, T = site.theme ?? {};

// ---- escaping: every string from site.json is escaped. The ONE markup allowed in text is
// **bold** (used for a lead-in phrase), so the client's agent can't inject HTML by accident.
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rich = (s = "") => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\{\{(.+?)\}\}/g, '<span class="ph">$1</span>').replace(/\n/g, "<br>");
const paras = (x) => (Array.isArray(x) ? x : x ? [x] : []).map((p) => `<p>${rich(p)}</p>`).join("");

// ---- opt-in additions (2026-10-29, built to match Kidron's "HOME2" design; Krystof's call to extend
// the template rather than hand-code one client page). RULE: every option below is opt-in. When a
// site.json doesn't use it, the renderers must emit byte-identical HTML to before, so existing client
// sites don't change on their next build. The regression check is: build an old site.json with the old
// and the new template and diff the HTML (see README).
//   ==word==  in a heading highlights it (<em>, accent-coloured), like HOME2's "Why <em>Kidron</em>".
const head = (t = "") => rich(t).replace(/==(.+?)==/g, "<em>$1</em>");
const title = (t = "") => esc(t).replace(/==(.+?)==/g, "<em>$1</em>");
const list = (x) => (Array.isArray(x) ? x : x ? [x] : []);
// tone: "dark" | "light" | "accent" — the alternating full-width backgrounds of the bold skin.
const tone = (s) => (s.tone ? ` tone tone--${esc(s.tone)}` : "");
// The heading block every new layout shares: small uppercase eyebrow, h2, optional intro line(s).
const secHead = (s) => `
    <div class="sec__head">
      ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ""}
      ${s.title ? `<h2>${title(s.title)}</h2>` : ""}
      ${list(s.intro).map((p, i) => `<p class="sec__intro${i === 0 && list(s.intro).length > 1 ? " sec__intro--lead" : ""}">${rich(p)}</p>`).join("")}
    </div>`;
const outro = (s) => (s.outro ? `<p class="sec__outro">${rich(s.outro)}</p>` : "");
const btns = (...bs) => bs.filter(Boolean).map((b, i) => `<a class="btn${i ? " btn--ghost" : ""}" href="${esc(b.href)}"${/^https?:/.test(b.href) ? ' target="_blank" rel="noopener"' : ""}>${esc(b.label)}</a>`).join("");

// ---- sections. Each renderer takes one entry of site.json "sections" and returns HTML.
const R = {
  hero: (s) => s.layout === "split" ? `
<section class="hero-split${tone(s)}" id="${esc(s.id)}">
  ${s.decor ? `<div class="decor" aria-hidden="true"><span></span><span></span><span></span></div>` : ""}
  <div class="hero-split__text">
    ${s.eyebrow ? `<p class="hero-split__eyebrow"${s.type_eyebrow ? ` data-type="${esc(s.eyebrow)}"` : ""}>${esc(s.eyebrow)}</p>` : ""}
    <h1>${head(s.heading)}</h1>
    ${paras(s.text)}
    <div class="btn-row">${btns(s.cta, s.cta2)}</div>
    ${s.tagline ? `<p class="hero-split__tagline">${esc(s.tagline)}</p>` : ""}
  </div>
  <div class="hero-split__media"><img src="${esc(s.image)}" alt="${esc(s.image_alt ?? "")}" fetchpriority="high"></div>
</section>` : `
<section class="hero" id="${esc(s.id)}">
  <img class="hero__bg" src="${esc(s.background)}" alt="${esc(s.background_alt ?? "")}" fetchpriority="high">
  <div class="wrap hero__inner">
    <h1>${rich(s.heading)}</h1>
    ${s.cta ? `<a class="btn" href="${esc(s.cta.href)}">${esc(s.cta.label)}</a>` : ""}
  </div>
</section>`,

  statement: (s) => `
<section class="statement" id="${esc(s.id)}">
  <div class="wrap"><p class="statement__box">${rich(s.text)}</p></div>
</section>`,

  // layout "tiles": HOME2's numbered approach cards (dark) and partner tiles (light); item "num" optional.
  cards: (s) => s.layout === "tiles" ? `
<section class="sec tiles${tone(s)}" id="${esc(s.id)}">
  <div class="wrap">${secHead(s)}
    <div class="tiles__grid tiles__grid--${s.items.length === 5 ? 5 : Math.min(s.items.length, 4)}">
      ${s.items.map((c) => `
      <article class="tile">
        ${c.num ? `<p class="tile__num">${esc(c.num)}</p>` : ""}
        ${c.tag ? `<p class="eyebrow">${esc(c.tag)}</p>` : ""}
        <h3>${head(c.title)}</h3>
        ${paras(c.text)}
      </article>`).join("")}
    </div>${outro(s)}
  </div>
</section>` : `
<section class="cards" id="${esc(s.id)}">
  <div class="wrap">
    <h2>${esc(s.title)}</h2>
    <div class="cards__grid">
      ${s.items.map((c) => `
      <article class="card">
        <div class="card__head"><h3>${rich(c.title)}</h3>${c.icon ? `<img class="card__icon" src="${esc(c.icon)}" alt="" loading="lazy">` : ""}</div>
        <p>${rich(c.text)}</p>
      </article>`).join("")}
    </div>
  </div>
</section>`,

  // People: a card per person; the full bio opens in a native <dialog> (no library).
  // layout "cards": bios shown in full on the card (no dialog), photo in a ringed circle.
  people: (s) => s.layout === "cards" ? `
<section class="sec gp${tone(s)}" id="${esc(s.id)}">
  <div class="wrap">${secHead(s)}
    <div class="gp__grid">
      ${s.items.map((p) => `
      <article class="gp__card">
        <div class="gp__top">
          ${p.photo ? `<img class="gp__photo" src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : ""}
          <div>
            ${p.location ? `<p class="eyebrow">${esc(p.location)}</p>` : ""}
            <h3>${esc(p.name)}</h3>
            <p class="gp__role">${[p.credentials, p.role].filter(Boolean).map(esc).join(" · ")}</p>
          </div>
        </div>
        <div class="gp__bio">${paras(p.bio)}</div>
      </article>`).join("")}
    </div>${outro(s)}
  </div>
</section>` : `
<section class="people" id="${esc(s.id)}">
  <div class="wrap">
    <div class="people__panel">
      <h2>${esc(s.title)}</h2>
      <div class="people__grid">
        ${s.items.map((p, i) => `
        <button class="person" type="button" data-dialog="person-${i}" aria-haspopup="dialog">
          <span class="person__photo">
            <img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">
            ${p.photo_hover ? `<img class="person__hover" src="${esc(p.photo_hover)}" alt="" loading="lazy">` : ""}
          </span>
          <span class="person__name">${esc(p.name)}</span>
          <span class="person__meta">${[p.credentials, p.role, p.location].filter(Boolean).map(esc).join("<br>")}</span>
        </button>
        <dialog class="bio" id="person-${i}" aria-label="${esc(p.name)}">
          <button class="bio__close" type="button" aria-label="Close">×</button>
          <img src="${esc(p.photo_hover ?? p.photo)}" alt="" loading="lazy">
          <h3>${esc(p.name)}</h3>
          <p class="person__meta">${[p.credentials, p.role, p.location].filter(Boolean).map(esc).join(" · ")}</p>
          ${paras(p.bio)}
        </dialog>`).join("")}
      </div>
    </div>
  </div>
</section>`,

  // Carousel: CSS scroll-snap does the sliding; scripts.js only adds the dots and buttons.
  // layout "grid": HOME2's portfolio cards (category, name, headline, text, investors, "View ↗").
  // filter: true adds category buttons above the grid (scripts.js does the filtering; without JS all show).
  carousel: (s) => s.layout === "grid" ? `
<section class="sec pgrid${tone(s)}" id="${esc(s.id)}">
  <div class="wrap">${secHead(s)}
    ${s.filter ? `<div class="pgrid__filter" role="group" aria-label="Filter by area"><button type="button" class="chip" aria-pressed="true" data-cat="">All</button>${[...new Set(s.items.map((c) => c.category).filter(Boolean))].map((c) => `<button type="button" class="chip" aria-pressed="false" data-cat="${esc(c)}">${esc(c)}${s.filter_counts ? ` <span class="chip__n">${s.items.filter((i) => i.category === c).length}</span>` : ""}</button>`).join("")}</div>` : ""}
    <div class="pgrid__grid">
      ${s.items.map((c) => `
      <article class="pcard" data-cat="${esc(c.category ?? "")}">
        ${c.category ? `<p class="eyebrow">${esc(c.category)}</p>` : ""}
        ${c.logo ? `<img class="pcard__logo" src="${esc(c.logo)}" alt="${esc(c.logo_alt ?? c.name ?? "")}" loading="lazy">` : ""}
        ${c.name ? `<h3>${esc(c.name)}</h3>` : ""}
        ${c.area ? `<p class="pcard__title">${esc(c.area)}</p>` : ""}
        <div class="pcard__body">${paras(c.text)}</div>
        <div class="pcard__foot"><span>${esc(c.investors ?? "")}</span>${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener">${esc(c.link_label ?? "View ↗")}</a>` : ""}</div>
      </article>`).join("")}
    </div>${outro(s)}
  </div>
</section>` : `
<section class="carousel" id="${esc(s.id)}">
  <div class="wrap">
    <h2>${esc(s.title)}</h2>
    <div class="carousel__track" tabindex="0">
      ${s.items.map((c) => `
      <article class="slide">
        ${c.tag ? `<span class="slide__tag">${rich(c.tag)}</span>` : ""}
        <img class="slide__logo" src="${esc(c.logo)}" alt="${esc(c.logo_alt ?? "")}" loading="lazy">
        ${c.area ? `<p class="slide__area"><strong>Area:</strong> ${esc(c.area)}</p>` : ""}
        ${paras(c.text)}
        ${c.investors ? `<p class="slide__investors">${rich(c.investors.replace(/^([^:]+:)/, "**$1**"))}</p>` : ""}
        ${c.link ? `<a class="btn btn--small" href="${esc(c.link)}" target="_blank" rel="noopener">View website</a>` : ""}
      </article>`).join("")}
    </div>
    <div class="carousel__dots" aria-hidden="true"></div>
  </div>
</section>`,

  // Contact: a Netlify Forms form (data-netlify). Netlify finds it in the built HTML, stores
  // submissions and emails them to whoever is set under Forms → notifications. The honeypot field
  // replaces the WordPress spam plugin. "action" sends the visitor to the thank-you page.
  // layout "plain": no panel; heading, intro, buttons and email centred on the section's tone, form below.
  contact: (s) => s.layout === "plain" ? `
<section class="sec contact-plain${tone(s)}" id="${esc(s.id)}">
  <div class="wrap">${secHead({ ...s, intro: undefined })}
    ${s.intro ? `<p class="sec__intro">${rich(s.intro)}</p>` : ""}
    ${s.email ? `<p class="contact-plain__email"><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ""}
    ${form(s)}
  </div>
</section>` : `
<section class="contact" id="${esc(s.id)}">
  <div class="wrap">
    <div class="contact__panel">
      <h2>${esc(s.title)}</h2>
      ${s.intro ? `<p>${rich(s.intro).replace(esc(s.email ?? "\u0000"), `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`)}</p>` : ""}
      <form name="${esc(s.form.name)}" method="POST" action="/thank-you/" data-netlify="true" netlify-honeypot="company_website">
        <input type="hidden" name="form-name" value="${esc(s.form.name)}">
        <p class="hp"><label>Leave this empty <input name="company_website" tabindex="-1" autocomplete="off"></label></p>
        ${s.form.fields.map((f) => `
        <label class="field"><span>${esc(f.label)}</span>
          ${f.type === "textarea"
            ? `<textarea name="${esc(f.name)}" rows="5" placeholder="${esc(f.label)}" ${f.required ? "required" : ""}></textarea>`
            : `<input name="${esc(f.name)}" type="${esc(f.type)}" placeholder="${esc(f.label)}" ${f.required ? "required" : ""} autocomplete="${f.type === "email" ? "email" : f.name === "name" ? "name" : "off"}">`}
        </label>`).join("")}
        <button class="btn" type="submit">${esc(s.form.submit)}</button>
      </form>
    </div>
  </div>
</section>`,

  // ---- new section types (opt-in, 2026-10-29) ----
  // strip: a band of short labelled items (HOME2's magenta "pillars strip").
  strip: (s) => `
<section class="strip${tone(s)}"${s.id ? ` id="${esc(s.id)}"` : ""}>${s.title ? `
  <div class="wrap"><p class="strip__title">${esc(s.title)}</p></div>` : ""}
  <div class="wrap strip__inner">
    ${s.items.map((i) => `<div class="strip__item"><strong>${esc(i.title)}</strong>${i.text ? `<span>${esc(i.text)}</span>` : ""}</div>`).join("")}
  </div>
</section>`,

  // text: two columns. Left: eyebrow, heading, paragraphs, region badges. Right: body paragraphs and a
  // quote line, or bullets, or "aside" cards. Optional "stats" row underneath. Covers HOME2's
  // "Why now", "Why Kidron" and "Fund I validation" sections with one shape.
  text: (s) => `
<section class="sec textsec${tone(s)}"${s.id ? ` id="${esc(s.id)}"` : ""}>
  <div class="wrap">
    ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ""}
    <div class="textsec__grid">
      <div class="textsec__main">
        ${s.title ? `<h2>${title(s.title)}</h2>` : ""}
        ${s.lead ? `<p class="textsec__lead">${rich(s.lead)}</p>` : ""}
        ${paras(s.left)}
        ${s.regions ? `<div class="regions">${s.regions.map((r) => `<div class="region"><strong>${esc(r.code)}</strong><span>${esc(r.label)}</span></div>`).join("")}</div>` : ""}
      </div>
      <div class="textsec__side">
        ${paras(s.text)}
        ${s.quote ? `<p class="textsec__quote">${rich(s.quote)}</p>` : ""}
        ${s.bullets ? `<ul class="bullets">${s.bullets.map((b) => `<li>${rich(b)}</li>`).join("")}</ul>` : ""}
        ${s.aside ? s.aside.map((c) => `<div class="aside-card">${c.tag ? `<p class="eyebrow">${esc(c.tag)}</p>` : ""}<h3>${head(c.title)}</h3>${paras(c.text)}</div>`).join("") : ""}
      </div>
    </div>
    ${s.stats ? `<div class="stats">${s.stats.map((st) => `<div class="stat"><strong>${esc(st.value)}</strong><span>${esc(st.label)}</span></div>`).join("")}</div>` : ""}
    ${outro(s)}
  </div>
</section>`,

  // compare (opt-in, 2026-10-29): two columns joined by an arrow, e.g. "Fund I → Fund II". The arrow line
  // draws itself once when the section enters the viewport (theme.motion); static without motion.
  compare: (s) => `
<section class="sec compare${tone(s)}"${s.id ? ` id="${esc(s.id)}"` : ""}>
  <div class="wrap">${secHead(s)}
    <div class="compare__grid">
      ${s.columns.map((c, i) => `${i ? `<div class="compare__arrow" aria-hidden="true"><span></span></div>` : ""}
      <div class="compare__col">
        ${c.label ? `<p class="eyebrow">${esc(c.label)}</p>` : ""}
        <h3>${head(c.title)}</h3>
        <ul class="bullets">${list(c.points).map((b) => `<li>${rich(b)}</li>`).join("")}</ul>
      </div>`).join("")}
    </div>${outro(s)}
  </div>
</section>`,

  // faq (opt-in): questions as native <details>, so answers open without JavaScript.
  faq: (s) => `
<section class="sec faq${tone(s)}"${s.id ? ` id="${esc(s.id)}"` : ""}>
  <div class="wrap">${secHead(s)}
    <div class="faq__list">
      ${s.items.map((q) => `<details class="faq__item"><summary>${esc(q.q)}</summary><div>${paras(q.a)}</div></details>`).join("")}
    </div>${outro(s)}
  </div>
</section>`,

  // quote: one large line, optional eyebrow/heading above it (HOME2's magenta pre-footer).
  quote: (s) => `
<section class="quote${tone(s)}"${s.id ? ` id="${esc(s.id)}"` : ""}>
  <div class="wrap">
    ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ""}
    ${s.title ? `<h2>${title(s.title)}</h2>` : ""}
    <p class="quote__text">${rich(s.text)}</p>
  </div>
</section>`,

  // notice: small print (legal / compliance), full width, above the footer.
  notice: (s) => `
<section class="notice${tone(s)}"${s.id ? ` id="${esc(s.id)}"` : ""}>
  <div class="wrap"><p>${rich(s.text)}</p></div>
</section>`,
};

function form(s) {
  return `<form name="${esc(s.form.name)}" method="POST" action="/thank-you/" data-netlify="true" netlify-honeypot="company_website">
        <input type="hidden" name="form-name" value="${esc(s.form.name)}">
        <p class="hp"><label>Leave this empty <input name="company_website" tabindex="-1" autocomplete="off"></label></p>
        ${s.form.fields.map((f) => f.type === "hidden" ? `
        <input type="hidden" name="${esc(f.name)}" value=""${f.from_param ? ` data-from-param="${esc(f.from_param)}"` : ""}>` : f.type === "checkbox" ? `
        <label class="field field--check"><input name="${esc(f.name)}" type="checkbox" value="yes" ${f.required ? "required" : ""}> <em>${rich(f.label)}</em></label>` : f.type === "select" ? `
        <label class="field"><span>${esc(f.label)}</span>
          <select name="${esc(f.name)}" ${f.required ? "required" : ""}><option value="">${esc(f.label)}</option>${(f.options ?? []).map((o) => `<option>${esc(o)}</option>`).join("")}</select>
        </label>` : `
        <label class="field"><span>${esc(f.label)}</span>
          ${f.type === "textarea"
            ? `<textarea name="${esc(f.name)}" rows="5" placeholder="${esc(f.label)}" ${f.required ? "required" : ""}></textarea>`
            : `<input name="${esc(f.name)}" type="${esc(f.type)}" placeholder="${esc(f.label)}" ${f.required ? "required" : ""} autocomplete="${f.type === "email" ? "email" : f.name === "name" ? "name" : "off"}">`}
        </label>`).join("")}
        <button class="btn" type="submit">${esc(s.form.submit)}</button>
      </form>`;
}

const nav = site.sections.filter((s) => s.nav).map((s) => `<a href="#${esc(s.id)}">${esc(s.nav)}</a>`).join("");
// Theme colours and font come from site.json, so one stylesheet serves every client.
const vars = `:root{--ink:${T.ink ?? "#070548"};--accent:${T.accent ?? "#E90055"};--accent-dark:${T.accent_dark ?? "#C00153"};--secondary:${T.secondary ?? "#2C2981"};--surface:${T.surface ?? "#E9E9E9"};--muted:${T.muted ?? "#464646"};--font:"${T.font ?? "Outfit"}",system-ui,sans-serif${T.font_label ? `;--font-label:"${T.font_label}",ui-monospace,monospace` : ""}}`;
// font_axis (opt-in, 2026-10-29): the weight range to load, e.g. "100..900" for an ultra-light display style.
// font_label (opt-in): a second Google font for small labels (exposed as --font-label). Defaults keep old output.
const fam = (f, axis) => `family=${encodeURIComponent(f)}:wght@${axis}`;
const font = T.font ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${fam(T.font, T.font_axis ?? "300..700")}${T.font_label ? `&${fam(T.font_label, "400..600")}` : ""}&display=swap" rel="stylesheet">` : "";

const page = (title, main, { canonical = S.url, robots = "index,follow" } = {}) => `<!doctype html>
<html lang="${esc(S.lang ?? "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(S.description)}">
<meta name="robots" content="${robots}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:title" content="${esc(S.title)}"><meta property="og:description" content="${esc(S.description)}"><meta property="og:type" content="website">${S.og_image ? `<meta property="og:image" content="${esc(new URL(S.og_image, S.url).href)}"><meta name="twitter:card" content="summary_large_image">` : ""}
${S.favicon ? `<link rel="icon" href="/${esc(S.favicon)}" sizes="32x32">` : ""}${S.favicon_large ? `<link rel="icon" href="/${esc(S.favicon_large)}" sizes="192x192">` : ""}${S.apple_touch_icon ? `<link rel="apple-touch-icon" href="/${esc(S.apple_touch_icon)}">` : ""}
${font}
<style>${vars}</style>
<link rel="stylesheet" href="/theme/styles.css">
<script src="/theme/scripts.js" defer></script>
</head>
<body${T.skin ? ` class="${list(T.skin).map((k) => `skin-${esc(k)}`).join(" ")}"` : ""}${T.motion ? " data-motion" : ""}>
<header class="topbar">
  <div class="wrap topbar__inner">
    <a class="logo" href="/#top"><img src="/${esc(S.logo)}" alt="${esc(S.title)}"></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu"><span></span><span></span><span></span></button>
    <nav id="nav" class="nav">${nav.replace(/href="#/g, 'href="/#')}</nav>${S.header_cta ? `<a class="btn header-cta" href="${esc(S.header_cta.href)}">${esc(S.header_cta.label)}</a>` : ""}
  </div>
</header>
<main>${main}</main>${S.raise_bar ? `
<div class="raise-bar" hidden><p>${rich(S.raise_bar.text)}</p>${S.raise_bar.cta ? `<a class="btn" href="${esc(S.raise_bar.cta.href)}">${esc(S.raise_bar.cta.label)}</a>` : ""}</div>` : ""}
<footer class="footer">
  <div class="wrap footer__inner">
    <a class="logo" href="/#top"><img src="/${esc(S.logo)}" alt="${esc(S.title)}"></a>
    <nav class="nav nav--footer">${nav.replace(/href="#/g, 'href="/#')}</nav>
    ${S.footer_text || S.social ? `<div class="footer__meta">${list(S.footer_text).map((t) => `<span>${esc(t)}</span>`).join("")}${list(S.social).map((l) => `<a href="${esc(l.href)}"${/^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : ""}>${esc(l.label)}</a>`).join("")}</div>` : ""}${S.credit ? `<a class="credit" href="${esc(S.credit.href)}" target="_blank" rel="noopener">${esc(S.credit.text)}</a>` : ""}
  </div>
</footer>
</body>
</html>
`;

// ---- write
mkdirSync(out, { recursive: true });
const main = site.sections.map((s) => {
  if (!R[s.type]) throw new Error(`site.json: unknown section type "${s.type}" (known: ${Object.keys(R).join(", ")})`);
  return R[s.type](s);
}).join("\n");
// Relative asset paths in site.json ("images/x.png") are served from the site root.
writeFileSync(join(out, "index.html"), rel(page(S.title, main).replace(/(src|href)="images\//g, '$1="/images/')));

const contact = site.sections.find((s) => s.type === "contact");
if (contact) {
  const ty = contact.form.thank_you ?? { title: "Thank you", text: "We received your message." };
  mkdirSync(join(out, "thank-you"), { recursive: true });
  writeFileSync(join(out, "thank-you", "index.html"),
    rel(page(`${ty.title} — ${S.title}`, `<section class="thanks"><div class="wrap"><h1>${esc(ty.title)}</h1><p>${rich(ty.text)}</p><a class="btn" href="/">Back to the homepage</a></div></section>`,
      { canonical: null, robots: "noindex" }), "../"));
}

cpSync(join(here, "theme"), join(out, "theme"), { recursive: true });
if (existsSync(join(content, "images"))) cpSync(join(content, "images"), join(out, "images"), { recursive: true });
// Extra files the client may need at the site root (e.g. an email-policy page), copied verbatim.
if (existsSync(join(content, "static"))) cpSync(join(content, "static"), out, { recursive: true });
console.log(`built ${S.title} → ${out}`);
