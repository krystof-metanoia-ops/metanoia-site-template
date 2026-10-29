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
    return i % 2 ? { x: 0.06, y: 0.55, s: 0.55 + (i % 3) * 0.15, o: 0.9 } : { x: 0.95, y: 0.4, s: 0.7 + (i % 2) * 0.2, o: 0.9 };
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
