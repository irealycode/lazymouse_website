/* What the new parts of the page need: the notches on the drawn screens, the notch's own stage, and
 * the deep search views. The rest of the page is main.js and extras.js, as before. Plain JS. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!window.LMNotch) return;

  // ---- a notch on each drawn screen -------------------------------------------------------
  // On a real screen the closed notch is 136 px of about 1366: here it is scaled with the screen it
  // sits on. The Audacity scene's screen is drawn in its own pixels, so there it is 1 to 1.
  const sized = [];
  const size = () => sized.forEach(([host, scale]) => host.style.setProperty("--ns", String(scale())));
  $$("[data-notch]").forEach((host) => {
    const screen = host.parentElement;
    window.LMNotch(host, { interactive: host.dataset.notch !== "still", edge: host.dataset.edge });
    sized.push([host, () => (screen.classList.contains("plane") ? 1 : Math.max(0.3, screen.clientWidth / 1150))]);
  });

  // ---- the notch's own stage: close up, opened for you once, then yours ---------------------
  const stage = $("#notchStage"), host = $("#notchHost");
  if (stage && host) {
    const notch = window.LMNotch(host);
    sized.push([host, () => { const w = stage.clientWidth; return w / 1440; }]);
    let touched = false, played = false, timers = [];
    const touch = () => { if (touched) return; touched = true; stage.classList.add("touched"); timers.forEach(clearTimeout); notch.listen(false); };
    notch.el.addEventListener("pointerdown", touch);
    notch.el.addEventListener("pointerenter", touch);
    notch.el.addEventListener("keydown", touch);
    const play = () => {
      if (played) return;
      played = true;
      // Kept open, as if pinned, so it is there to look at; the pin lets it close again.
      notch.setPinned(true);
      if (reduced) { notch.open(true); return; }
      timers = [
        setTimeout(() => notch.open(true), 500),
        setTimeout(() => { if (!touched) notch.listen(true); }, 2300),
        setTimeout(() => { if (!touched) notch.listen(false); }, 4600),
      ];
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e], io) => { if (e.isIntersecting) { play(); io.disconnect(); } }, { threshold: 0.45 }).observe(stage);
    } else play();
  }
  size();
  addEventListener("resize", size);
  addEventListener("load", size);

})();
