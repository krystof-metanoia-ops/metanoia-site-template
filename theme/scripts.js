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
