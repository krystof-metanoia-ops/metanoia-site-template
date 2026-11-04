// Metanoia one-page site template: the only JavaScript the site needs. No libraries.
// Everything here is progressive: without JS the menu links still work, bios stay reachable
// only through the dialog (the button does nothing), and the carousel still scrolls by touch.
document.addEventListener("DOMContentLoaded", () => {
  // Mobile menu.
  const bar = document.querySelector(".topbar");
  const toggle = document.querySelector(".menu-toggle");
  toggle?.addEventListener("click", () => {
    const open = bar.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", () => bar?.classList.remove("open")));

  // People bios in native <dialog>s; a click on the backdrop closes too.
  document.querySelectorAll("[data-dialog]").forEach((btn) => {
    const dlg = document.getElementById(btn.dataset.dialog);
    btn.addEventListener("click", () => dlg?.showModal());
  });
  document.querySelectorAll("dialog.bio").forEach((dlg) => {
    dlg.querySelector(".bio__close")?.addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  });

  // Carousel dots: one per page of slides, synced to the scroll position.
  document.querySelectorAll(".carousel").forEach((c) => {
    const track = c.querySelector(".carousel__track");
    const dots = c.querySelector(".carousel__dots");
    if (!track || !dots) return;
    const pages = () => Math.max(1, Math.ceil(track.scrollWidth / track.clientWidth - 0.05));
    const render = () => {
      dots.innerHTML = "";
      for (let i = 0; i < pages(); i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `Slide page ${i + 1}`);
        b.addEventListener("click", () => track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" }));
        dots.appendChild(b);
      }
      sync();
    };
    const sync = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      [...dots.children].forEach((d, j) => d.setAttribute("aria-current", String(i === j)));
    };
    track.addEventListener("scroll", () => requestAnimationFrame(sync), { passive: true });
    window.addEventListener("resize", render);
    render();
  });
});

// Portfolio filter (opt-in, carousel layout "grid" + filter: true; 2026-10-29). Without JS every
// card stays visible, so the filter is a convenience, never a gate.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".pgrid__filter").forEach((bar) => {
    const cards = bar.parentElement.querySelectorAll(".pcard");
    bar.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      bar.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      const cat = chip.dataset.cat;
      cards.forEach((card) => { card.hidden = Boolean(cat) && card.dataset.cat !== cat; });
    });
  });
});

// Motion (opt-in via theme.motion → <body data-motion>; 2026-10-29). Sections fade up once as they enter
// the viewport, and an eyebrow marked data-type types itself once. Respects reduced-motion; the "js" class
// is added here, so without JavaScript nothing is ever hidden.
document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  if (!body.hasAttribute("data-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  body.classList.add("js");
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }), { threshold: 0, rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".sec, .strip").forEach((el) => io.observe(el));
  document.querySelectorAll("[data-type]").forEach((el) => {
    const text = el.dataset.type; let i = 0;
    el.textContent = ""; el.classList.add("typing");
    const tick = () => { el.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(tick, 55); else setTimeout(() => el.classList.remove("typing"), 1200); };
    setTimeout(tick, 400);
  });
});

// Raise bar (opt-in via site.raise_bar; 2026-10-29): a small "Now raising" pill with one CTA. It shows
// only between the hero and the contact section, so it never covers the first screen or the form.
document.addEventListener("DOMContentLoaded", () => {
  const bar = document.querySelector(".raise-bar");
  const hero = document.querySelector("main > section");
  const contact = document.getElementById("contact");
  if (!bar || !hero) return;
  bar.hidden = false; bar.classList.add("is-hiding");
  let pastHero = false, atContact = false;
  const update = () => bar.classList.toggle("is-hiding", !pastHero || atContact);
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; update(); }).observe(hero);
  if (contact) new IntersectionObserver(([e]) => { atContact = e.isIntersecting; update(); }, { threshold: 0.05 }).observe(contact);
});

// Campaign parameter (opt-in, 2026-10-29): a hidden form field with data-from-param="c" is filled from
// ?c=<id> in the page address, so a cold-email link can say which contact or campaign the visitor came
// from. It travels only inside the form submission: no cookies, no tracking scripts.
document.addEventListener("DOMContentLoaded", () => {
  const q = new URLSearchParams(location.search);
  document.querySelectorAll("input[data-from-param]").forEach((i) => { const v = q.get(i.dataset.fromParam); if (v) i.value = v.slice(0, 120); });
});

// Signature moments (opt-in via theme.signature; 2026-10-29). The hero photo opens once the image has
// loaded. One orb follows the scroll: each section has a resting spot (side gutters, alternating), and the
// orb glides between them, ending large and soft behind the contact form. rAF + transform only.
document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  if (!body.hasAttribute("data-signature")) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heroImg = document.querySelector(".hero-split__media img");
  const opened = () => requestAnimationFrame(() => body.classList.add("is-loaded"));
  if (!heroImg || heroImg.complete) opened(); else { heroImg.addEventListener("load", opened, { once: true }); setTimeout(opened, 2500); }
  if (reduce) return;
  const orb = document.createElement("div"); orb.className = "orb"; orb.setAttribute("aria-hidden", "true");
  body.prepend(orb);
  const secs = [...document.querySelectorAll("main > section")];
  // Resting spot per section, as fractions of the viewport (x, y), plus scale and opacity.
  // Alternates right/left so the orb weaves down the page; the last stop is the contact section.
  const contactIdx = secs.findIndex((s) => s.id === "contact");
  const spot = (i, el) => {
    // the contact section and everything after it share one resting spot, so the orb settles there
    if (el.id === "contact" || (contactIdx > -1 && i > contactIdx)) return { x: 0.5, y: 0.5, s: 2.4, o: 0.1 };
    if (i === 0) return { x: 0.9, y: 0.22, s: 1, o: 1 };
    // between the hero and the form the orb is pale (0.3), so text that passes over it stays readable
    return i % 2 ? { x: 0.06, y: 0.55, s: 0.55 + (i % 3) * 0.15, o: 0.3 } : { x: 0.95, y: 0.4, s: 0.7 + (i % 2) * 0.2, o: 0.3 };
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  let cur = null;
  const frame = () => {
    const vh = innerHeight, vw = innerWidth, mid = vh * 0.5;
    let i = secs.findIndex((s) => s.getBoundingClientRect().bottom > mid);
    if (i < 0) i = secs.length - 1;
    const r = secs[i].getBoundingClientRect();
    const t = ease(Math.min(1, Math.max(0, (mid - r.top) / Math.max(1, r.height))));
    const a = spot(i, secs[i]), b = spot(Math.min(i + 1, secs.length - 1), secs[Math.min(i + 1, secs.length - 1)]);
    // within a section the orb rests for the first half, then glides toward the next section's spot
    const k = Math.max(0, (t - 0.5) * 2);
    const target = { x: lerp(a.x, b.x, k) * vw, y: lerp(a.y, b.y, k) * vh, s: lerp(a.s, b.s, k), o: lerp(a.o, b.o, k) };
    cur = cur ? { x: lerp(cur.x, target.x, 0.12), y: lerp(cur.y, target.y, 0.12), s: lerp(cur.s, target.s, 0.12), o: lerp(cur.o, target.o, 0.12) } : target;
    orb.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) scale(${cur.s})`;
    // on phones the gutters are narrow, so the orb fades back to keep text over it readable
    orb.style.opacity = vw < 820 ? cur.o * 0.35 : cur.o;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
});

// Hero dots, airy skin (3 Nov 2026, Maria's v9 feedback: "keep the circles clear of headlines, text and
// buttons at every screen width"). The old CSS keyframes moved each dot by fixed pixels, so at some widths
// a dot had to cross the text, and no keyframe can know where the text wraps. So the path is computed here:
// each dot drifts on a slow curve (lava-lamp, not bouncing: Krystof, 30 Oct) and a step that would bring it
// within CLEAR px of a text line or button is never taken; it turns instead. Clearance holds by construction.
// Without JavaScript the dots stay hidden (see CSS), so a page without this code can't show an overlap.
// Static under reduced motion. Hero only; the loop stops while the hero is off screen.
document.addEventListener("DOMContentLoaded", () => {
  const decor = document.querySelector(".skin-airy .hero-split > .decor");
  if (!decor) return;
  const hero = decor.parentElement;
  const textBox = hero.querySelector(".hero-split__text");
  const photo = hero.querySelector(".hero-split__media img");
  const moving = document.body.hasAttribute("data-motion") && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CLEAR = 16;   // px between a dot's edge and any text or button
  const SPEED = 13;   // px per second: the speed of the old keyframes (about 130 px in 8.5 s, 30 Oct)
  const LOOK = 44;    // px ahead at which a dot starts to curve away, so it rarely has to stop and turn
  let obstacles = [], W = 0, H = 0;

  // Line-tight boxes for the headline and paragraphs, so the free space after a short last line counts.
  // The eyebrow gets its whole block: it types itself in, so its text box grows after we measure.
  const measure = () => {
    const o = hero.getBoundingClientRect();
    const box = (r) => ({ l: r.left - o.left, t: r.top - o.top, r: r.right - o.left, b: r.bottom - o.top });
    const list = [];
    [...textBox.children].forEach((el) => {
      if (el.matches("[data-type]")) { list.push(box(el.getBoundingClientRect())); return; }
      if (el.classList.contains("btn-row")) { [...el.children].forEach((b) => list.push(box(b.getBoundingClientRect()))); return; }
      const range = document.createRange(); range.selectNodeContents(el);
      [...range.getClientRects()].forEach((r) => { if (r.width && r.height) list.push(box(r)); });
    });
    obstacles = list; W = o.width;
    // Dots may slide halfway behind the top of the photo (it sits above them), never lower: a dot fully
    // behind the photo would just be missing from the page.
    H = photo ? photo.getBoundingClientRect().top - o.top : o.height;
  };
  const hits = (x, y, r) => obstacles.some((b) => {
    const dx = x - Math.max(b.l, Math.min(x, b.r)), dy = y - Math.max(b.t, Math.min(y, b.b));
    return dx * dx + dy * dy < (r + CLEAR) * (r + CLEAR);
  });
  // Krystof, 4 Nov: "I don't like circles that are cut off". So on a desktop the whole dot stays on the page,
  // and only a phone may let a dot hang half off the side. The pale dot never slides behind the photo: a pale
  // circle with a flat edge reads as a bug, while a dark one reads as depth (his two screenshots).
  const out = (x, y, r) => {
    const side = W > 820 ? r : r * 0.5;
    const floor = r > 40 ? H - r : H;
    return x < side || x > W - side || y < r || y > floor;
  };
  const free = (x, y, r) => !out(x, y, r) && !hits(x, y, r);

  const dots = [...decor.children].map((el, i) => ({ el, i, x: 0, y: 0, r: 0, a: i * 2.1 + 0.6, ok: false }));
  // Find a free spot away from the dots already placed, so they start spread out.
  const place = (d, placed) => {
    let best = null, bestScore = -1;
    for (let y = d.r; y <= H; y += 12) for (let x = 0; x <= W; x += 12) {
      if (!free(x, y, d.r)) continue;
      const apart = placed.length ? Math.min(300, ...placed.map((p) => Math.hypot(p.x - x, p.y - y))) : x / 10;
      const score = apart;
      if (score > bestScore) { bestScore = score; best = [x, y]; }
    }
    // No free spot at this width: the dot stays hidden rather than touch the text.
    d.ok = Boolean(best);
    if (best) [d.x, d.y] = best;
    d.el.style.visibility = d.ok ? "visible" : "hidden";
  };
  const draw = (d) => { d.el.style.transform = `translate3d(${d.x - d.r}px,${d.y - d.r}px,0)`; };
  const layout = (first) => {
    measure();
    const placed = [];
    dots.forEach((d) => {
      d.r = d.el.offsetWidth / 2;
      // On a resize a dot keeps its place unless the new text wrap reached it.
      if (first || !d.ok || !free(d.x, d.y, d.r)) place(d, placed);
      if (d.ok) { placed.push(d); draw(d); }
    });
  };

  decor.classList.add("is-live");
  layout(true);
  new ResizeObserver(() => layout(false)).observe(hero);
  // Web fonts change where the text wraps.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout(false));
  if (!moving) return;

  let last = 0, on = false, measured = 0;
  const step = (now) => {
    if (!on) return;
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    // Measure again once a second. The test on 3 Nov found a dot 6 px from the eyebrow: the text had moved
    // (the eyebrow types itself in, a late web font rewraps) without a fresh measurement. The two hooks above
    // aren't enough on their own. A few rectangles a second cost nothing against that.
    if (now - measured > 1000) { measured = now; layout(false); }
    dots.forEach((d) => {
      if (!d.ok) return;
      d.a += Math.sin(now / 5200 + d.i * 1.7) * 0.25 * dt; // the slow wander
      const cos = Math.cos(d.a), sin = Math.sin(d.a);
      if (!free(d.x + cos * LOOK, d.y + sin * LOOK, d.r)) d.a += 0.7 * dt;
      const nx = d.x + cos * SPEED * dt, ny = d.y + sin * SPEED * dt;
      if (free(nx, ny, d.r)) { d.x = nx; d.y = ny; draw(d); } else d.a += 1.2 * dt;
    });
    requestAnimationFrame(step);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !on) { on = true; last = performance.now(); requestAnimationFrame(step); }
    else if (!e.isIntersecting) on = false;
  }).observe(hero);
});

// Depth layers, airy skin (4 Nov 2026, Krystof: "do the bubbles in parallax, as another layer, even two layers
// that move at different speeds than the front layer with all the text"). Two fixed layers of circles sit
// between the section backgrounds and the content, so no section edge can cut a circle: that flat cut was the
// complaint. The far layer is pale, large and slow; the near one is darker, smaller and faster. Text stays on
// top, and both colours are light enough to read text across them (see CSS). They stay hidden while the hero
// text is on screen, because the hero has its own dots with their own clearance. Static under reduced motion.
// Scroll only moves two transforms, once per frame.
document.addEventListener("DOMContentLoaded", () => {
  const hero = document.querySelector(".skin-airy .hero-split");
  if (!hero) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Share of the scroll speed: the text moves at 1. At 1 the layer is fixed to the page, so reduced motion
  // uses the same placement code with no movement relative to the text.
  const FAR = still ? 1 : 0.22, NEAR = still ? 1 : 0.55;
  const box = document.createElement("div"); box.className = "bubbles"; box.setAttribute("aria-hidden", "true");
  const far = document.createElement("div"), near = document.createElement("div");
  far.className = "bubbles__layer bubbles__layer--far"; near.className = "bubbles__layer bubbles__layer--near";
  box.append(far, near); document.body.prepend(box);

  const anchors = [...document.querySelectorAll("main > .sec")].filter((s) => !s.classList.contains("hero-split"));
  // Fractions of the free width and the viewport height: the whole circle is on screen when its section is
  // centred.
  const place = () => {
    const vw = innerWidth, vh = innerHeight;
    far.textContent = ""; near.textContent = "";
    anchors.forEach((sec, i) => {
      const r = sec.getBoundingClientRect(), mid = r.top + scrollY + r.height / 2;
      const add = (layer, k, size, fx, fy) => {
        const b = document.createElement("span");
        b.style.cssText = `width:${size}px;height:${size}px;left:${(vw - size) * fx}px;top:${fy * vh + (mid - vh / 2) * k - size / 2}px`;
        layer.append(b);
      };
      // Far and near take turns: one circle of each per section looked busy on the first draft (4 Nov), since
      // a slow layer packs its circles closer together on screen than the sections they belong to.
      const left = i % 4 < 2;
      if (i % 2 === 0) add(far, FAR, Math.min(vw * 0.62, 420), left ? 0.05 : 0.95, 0.45);
      else add(near, NEAR, Math.min(vw * 0.3, 180), left ? 0.97 : 0.03, 0.62);
    });
  };
  let ticking = false;
  const move = () => {
    ticking = false;
    const s = scrollY;
    far.style.transform = `translate3d(0,${-s * FAR}px,0)`;
    near.style.transform = `translate3d(0,${-s * NEAR}px,0)`;
    const textEnd = hero.querySelector(".hero-split__text").getBoundingClientRect().bottom;
    box.style.opacity = Math.min(1, Math.max(0, (80 - textEnd) / 160));
  };
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(move); } };
  place(); move();
  addEventListener("scroll", queue, { passive: true });
  // Section heights change with the text wrap, web fonts and late images.
  new ResizeObserver(() => { place(); queue(); }).observe(document.querySelector("main"));
});
