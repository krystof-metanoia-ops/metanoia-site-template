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

const site = JSON.parse(readFileSync(join(content, "site.json"), "utf8"));
const S = site.site, T = site.theme ?? {};

// ---- escaping: every string from site.json is escaped. The ONE markup allowed in text is
// **bold** (used for a lead-in phrase), so the client's agent can't inject HTML by accident.
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rich = (s = "") => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
const paras = (x) => (Array.isArray(x) ? x : x ? [x] : []).map((p) => `<p>${rich(p)}</p>`).join("");

// ---- sections. Each renderer takes one entry of site.json "sections" and returns HTML.
const R = {
  hero: (s) => `
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

  cards: (s) => `
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
  people: (s) => `
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
  carousel: (s) => `
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
  contact: (s) => `
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
};

const nav = site.sections.filter((s) => s.nav).map((s) => `<a href="#${esc(s.id)}">${esc(s.nav)}</a>`).join("");
// Theme colours and font come from site.json, so one stylesheet serves every client.
const vars = `:root{--ink:${T.ink ?? "#070548"};--accent:${T.accent ?? "#E90055"};--accent-dark:${T.accent_dark ?? "#C00153"};--secondary:${T.secondary ?? "#2C2981"};--surface:${T.surface ?? "#E9E9E9"};--muted:${T.muted ?? "#464646"};--font:"${T.font ?? "Outfit"}",system-ui,sans-serif}`;
const font = T.font ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(T.font)}:wght@300..700&display=swap" rel="stylesheet">` : "";

const page = (title, main, { canonical = S.url, robots = "index,follow" } = {}) => `<!doctype html>
<html lang="${esc(S.lang ?? "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(S.description)}">
<meta name="robots" content="${robots}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:title" content="${esc(S.title)}"><meta property="og:description" content="${esc(S.description)}"><meta property="og:type" content="website">
${S.favicon ? `<link rel="icon" href="/${esc(S.favicon)}" sizes="32x32">` : ""}${S.favicon_large ? `<link rel="icon" href="/${esc(S.favicon_large)}" sizes="192x192">` : ""}${S.apple_touch_icon ? `<link rel="apple-touch-icon" href="/${esc(S.apple_touch_icon)}">` : ""}
${font}
<style>${vars}</style>
<link rel="stylesheet" href="/theme/styles.css">
<script src="/theme/scripts.js" defer></script>
</head>
<body>
<header class="topbar">
  <div class="wrap topbar__inner">
    <a class="logo" href="/#top"><img src="/${esc(S.logo)}" alt="${esc(S.title)}"></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu"><span></span><span></span><span></span></button>
    <nav id="nav" class="nav">${nav.replace(/href="#/g, 'href="/#')}</nav>
  </div>
</header>
<main>${main}</main>
<footer class="footer">
  <div class="wrap footer__inner">
    <a class="logo" href="/#top"><img src="/${esc(S.logo)}" alt="${esc(S.title)}"></a>
    <nav class="nav nav--footer">${nav.replace(/href="#/g, 'href="/#')}</nav>
    ${S.credit ? `<a class="credit" href="${esc(S.credit.href)}" target="_blank" rel="noopener">${esc(S.credit.text)}</a>` : ""}
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
writeFileSync(join(out, "index.html"), page(S.title, main).replace(/(src|href)="images\//g, '$1="/images/'));

const contact = site.sections.find((s) => s.type === "contact");
if (contact) {
  const ty = contact.form.thank_you ?? { title: "Thank you", text: "We received your message." };
  mkdirSync(join(out, "thank-you"), { recursive: true });
  writeFileSync(join(out, "thank-you", "index.html"),
    page(`${ty.title} — ${S.title}`, `<section class="thanks"><div class="wrap"><h1>${esc(ty.title)}</h1><p>${rich(ty.text)}</p><a class="btn" href="/">Back to the homepage</a></div></section>`,
      { canonical: null, robots: "noindex" }));
}

cpSync(join(here, "theme"), join(out, "theme"), { recursive: true });
if (existsSync(join(content, "images"))) cpSync(join(content, "images"), join(out, "images"), { recursive: true });
// Extra files the client may need at the site root (e.g. an email-policy page), copied verbatim.
if (existsSync(join(content, "static"))) cpSync(join(content, "static"), out, { recursive: true });
console.log(`built ${S.title} → ${out}`);
