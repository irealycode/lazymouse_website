/* The desktop notch, as the app draws it. A port, not a redrawing:
 *   - the markup and the nine icons are desktop/src/notch.ts (`startNotch`, `icons`),
 *   - the outline is desktop/src/notchShape.ts (`notchPath`, top edge),
 *   - the opening is the same critically damped spring (`reveal`, frequency 24) driving the same
 *     custom properties (`paintReveal`),
 *   - the styles are desktop/src/notch.css, with `#notch` written `.lmn` (new.css).
 * Only what needs the computer is left out: dragging along the edges, the pages, the real microphone.
 *
 * `LMNotch(host, options)` puts one at the top centre of `host` (which must be positioned) and returns
 * { el, open(on), listen(on), pinned() }. Hovering opens it, leaving closes it, the pin keeps it open,
 * and holding the button listens, as in the app. Plain JS.
 */
(() => {
  "use strict";
  const icons = {
    mic: '<rect x="7.25" y="2.5" width="5.5" height="9.5" rx="2.75"/><path d="M4.5 9.75a5.5 5.5 0 0 0 11 0M10 15.25v2.25"/>',
    notes: '<rect x="3.5" y="5" width="13" height="11.5" rx="2.6"/><path d="M7.6 3.4h4.8v3.2H7.6zM7 10.4h6M7 13.2h3.6"/>',
    files: '<path d="M2.9 6.3c0-1 .8-1.8 1.8-1.8h2.9c.5 0 1 .2 1.3.6l.8 1h5.6c1 0 1.8.8 1.8 1.8v6.3c0 1-.8 1.8-1.8 1.8H4.7c-1 0-1.8-.8-1.8-1.8Z"/><path d="M10 9.2v4M8.2 11.5l1.8 1.8 1.8-1.8"/>',
    jobs: '<rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.8"/><path d="m6.3 8 2.4 2-2.4 2M10.8 12.2h3"/>',
    phone: '<rect x="5.75" y="2.5" width="8.5" height="15" rx="2.5"/><path d="M8.9 5.1h2.2"/>',
    settings: '<circle cx="10" cy="10" r="6.6" stroke-width="2.4" stroke-linecap="butt" stroke-dasharray="2.59 2.59" stroke-dashoffset="1.3"/><circle cx="10" cy="10" r="5.2"/><circle cx="10" cy="10" r="1.9"/>',
    pin: '<path d="m11.9 3 5.1 5.1-1.6.5-2.4 2.4.2 3.3-1.2 1.2-7.5-7.5 1.2-1.2 3.3.2 2.4-2.4ZM7.4 12.6l-4 4"/>',
    chevron: '<path d="m7.75 5 5 5-5 5"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 20 20" aria-hidden="true">${icons[name]}</svg>`;

  // ghostLook.ts `ghostSvg`: the body with its eyes cut out of it, so what it sits on shows through.
  const BODY = "M78.76 0.14C78.76 2.72 78.76 5.28 78.76 7.9C78.76 10.51 78.76 13.12 78.76 15.81C78.76 18.5 78.76 21.21 78.76 24.04C78.76 26.87 78.76 29.74 78.76 32.78C78.76 35.81 78.76 38.92 78.76 42.26C78.76 45.59 78.76 49.03 78.76 52.79C78.76 56.55 79.67 61.36 78.76 64.81C77.85 68.25 76.44 72.07 73.3 73.45C70.16 74.84 63.05 71.75 59.91 73.11C56.78 74.47 56.28 78.48 54.48 81.61C52.67 84.73 51.44 89.25 49.08 91.84C46.71 94.44 43.55 96.34 40.29 97.19C37.02 98.03 33.2 98.18 29.48 96.9C25.76 95.63 21.38 90.96 17.95 89.56C14.52 88.16 11.85 88.34 8.9 88.51C5.95 88.69 3.24 89.34 0.22 90.59C-2.79 91.84 -5.84 94.21 -9.19 96.01C-12.53 97.82 -16.39 100.74 -19.85 101.42C-23.32 102.11 -26.9 101.37 -30 100.12C-33.11 98.86 -35.91 96.26 -38.47 93.88C-41.04 91.49 -43.05 88.2 -45.4 85.79C-47.75 83.38 -49.17 80.24 -52.57 79.42C-55.97 78.6 -62.11 81.54 -65.8 80.86C-69.49 80.18 -72.66 78.03 -74.73 75.34C-76.8 72.65 -77.62 68.49 -78.22 64.73C-78.82 60.97 -78.3 56.53 -78.31 52.79C-78.33 49.04 -78.31 45.59 -78.31 42.26C-78.31 38.92 -78.31 35.81 -78.31 32.78C-78.31 29.74 -78.31 26.87 -78.31 24.04C-78.31 21.21 -78.31 18.5 -78.31 15.81C-78.31 13.12 -78.31 10.51 -78.31 7.9C-78.31 5.28 -78.31 2.72 -78.31 0.14C-78.31 -2.45 -78.35 -5.02 -78.31 -7.63C-78.26 -10.23 -78.21 -12.85 -78.04 -15.49C-77.87 -18.12 -77.62 -20.78 -77.27 -23.45C-76.92 -26.12 -76.47 -28.81 -75.92 -31.51C-75.38 -34.22 -74.8 -36.97 -74.01 -39.68C-73.21 -42.38 -72.19 -45.01 -71.17 -47.73C-70.16 -50.45 -69.2 -53.3 -67.92 -55.98C-66.64 -58.65 -65.1 -61.24 -63.47 -63.78C-61.84 -66.32 -60.06 -68.82 -58.14 -71.22C-56.21 -73.62 -54.15 -75.98 -51.93 -78.18C-49.71 -80.39 -47.36 -82.57 -44.83 -84.45C-42.3 -86.32 -39.54 -87.92 -36.74 -89.42C-33.95 -90.91 -31.03 -92.26 -28.06 -93.41C-25.08 -94.56 -22 -95.53 -18.9 -96.31C-15.79 -97.1 -12.61 -97.71 -9.42 -98.13C-6.23 -98.56 -2.99 -98.9 0.22 -98.87C3.44 -98.84 6.66 -98.36 9.85 -97.93C13.04 -97.5 16.24 -97.06 19.34 -96.29C22.44 -95.51 25.52 -94.48 28.46 -93.25C31.4 -92.02 34.22 -90.46 36.98 -88.91C39.74 -87.35 42.53 -85.85 45.02 -83.95C47.51 -82.05 49.73 -79.7 51.92 -77.49C54.11 -75.29 56.24 -73.06 58.15 -70.69C60.07 -68.32 61.83 -65.82 63.44 -63.29C65.04 -60.76 66.45 -58.11 67.77 -55.49C69.1 -52.87 70.35 -50.25 71.39 -47.58C72.44 -44.91 73.26 -42.15 74.04 -39.45C74.82 -36.75 75.5 -34.07 76.07 -31.39C76.65 -28.71 77.14 -26.04 77.48 -23.38C77.82 -20.72 77.9 -18.04 78.11 -15.41C78.32 -12.78 78.63 -10.21 78.74 -7.62C78.85 -5.03 78.76 -2.45 78.76 0.14Z";
  const EYE = "M-10.5 -11.5A10.5 10.5 0 0 1 0 -22L0 -22A10.5 10.5 0 0 1 10.5 -11.5L10.5 11.5A10.5 10.5 0 0 1 0 22L0 22A10.5 10.5 0 0 1 -10.5 11.5Z";
  let drawn = 0;
  const ghostSvg = () => {
    const id = `lmn-mask-${drawn++}`;
    return `<svg viewBox="-86 -106 172 215" aria-hidden="true"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-158" y="-158" width="316" height="316"><path d="${BODY}" fill="#fff"/><path d="${EYE}" fill="#000" transform="matrix(0.96 -0.08 0.05 0.99 -21.39 -9.01)"/><path d="${EYE}" fill="#000" transform="matrix(0.96 -0.01 0.05 0.99 23.94 -11.23)"/></mask></defs><rect x="-158" y="-158" width="316" height="316" fill="#fb6a22" mask="url(#${id})"/></svg>`;
  };

  // notchShape.ts `notchPath`, for the top edge and no lift: concave shoulders at the screen edge,
  // rounded far corners.
  function notchPath(rect, edge = "top") {
    const w = edge === "right" ? rect.height : rect.width, h = edge === "right" ? rect.width : rect.height;
    const r = Math.min(23, h * 0.42, w * 0.18);
    const s = Math.min(10, w * 0.08, h * 0.25);
    const p = (u, v) => `${(rect.x + (edge === "right" ? rect.width - v : u)).toFixed(2)} ${(rect.y + (edge === "right" ? u : v)).toFixed(2)}`;
    return `M${p(0, 0)} L${p(w, 0)} Q${p(w - s, 0)} ${p(w - s, s)} L${p(w - s, h - r)} Q${p(w - s, h)} ${p(w - s - r, h)} L${p(s + r, h)} Q${p(s, h)} ${p(s, h - r)} L${p(s, s)} Q${p(s, 0)} ${p(0, 0)} Z`;
  }

  const W = 368, H = 260, TRIGGER = { x: 116, y: 0, w: 136, h: 32 }, FREQUENCY = 24;
  const unit = (n) => Math.max(0, Math.min(1, n));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  window.LMNotch = function LMNotch(host, options = {}) {
    const o = Object.assign({ note: "Launch checklist", device: "iPhone", connected: true, job: true, interactive: true }, options);
    const edge = options.edge === "right" ? "right" : "top";
    const trigger = edge === "right" ? { x: W - 32, y: (H - 92) / 2, w: 32, h: 92 } : TRIGGER;
    const root = document.createElement("section");
    root.className = "lmn" + (o.connected ? " connected" : "");
    root.setAttribute("aria-label", "The lazymouse notch");
    for (const [key, value] of Object.entries(trigger)) root.style.setProperty(`--trigger-${key}`, `${value}px`);
    const pages = ["notes", "files", "jobs", "phone"];
    root.innerHTML = `<span class="notch-emblem notch-brand-icon" aria-hidden="true">${ghostSvg()}</span><button class="notch-handle" type="button" aria-label="Open lazymouse" aria-expanded="false"></button><svg class="notch-rim" aria-hidden="true"><path/></svg><div class="notch-card"><header class="notch-head"><span class="notch-brand-icon">${ghostSvg()}</span><strong>lazymouse</strong><button class="notch-pin" type="button" aria-label="Keep the panel open" title="Keep the panel open" aria-pressed="false">${icon("pin")}</button><button class="notch-settings" type="button" aria-label="Settings" title="Settings">${icon("settings")}</button></header><button class="notch-voice" type="button"><span class="notch-orb">${icon("mic")}</span><b class="notch-voice-label">Hold to talk</b><span class="notch-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></button><p class="notch-voice-hint">or hold <kbd>Ctrl</kbd><kbd>Alt</kbd> anywhere</p><nav class="notch-utilities" aria-label="Pages">${pages.map((p) => `<button type="button" data-page="${p}"${p === "jobs" && o.job ? ' class="active-job"' : ""}>${icon(p)}<span>${p[0].toUpperCase() + p.slice(1)}</span></button>`).join("")}</nav><div class="notch-notes"><button class="notch-note" type="button"><span class="notch-note-icon">${icon("notes")}</span><span><strong></strong><small>Show</small></span><span class="notch-arrow">${icon("chevron")}</span></button></div><footer class="notch-device"><i></i><span class="notch-device-name"></span><span class="notch-device-state"></span></footer></div>`;
    root.querySelector(".notch-note strong").textContent = o.note;
    root.querySelector(".notch-device-name").textContent = o.device;
    root.querySelector(".notch-device-state").textContent = o.connected ? "Connected" : "Not connected";
    host.append(root);
    const rim = root.querySelector(".notch-rim path"), handle = root.querySelector(".notch-handle");
    const pin = root.querySelector(".notch-pin"), voice = root.querySelector(".notch-voice"), label = root.querySelector(".notch-voice-label");

    // notch.ts `paintReveal`, along the top edge.
    const reveal = { value: 0, velocity: 0, target: 0, frame: 0, time: 0 };
    function paint() {
      const p = unit(reveal.value), { x, y, w, h } = trigger;
      const panel = { x: x * (1 - p), y: y * (1 - p), width: w + (W - w) * p, height: h + (H - h) * p };
      const shape = notchPath(panel, edge);
      root.style.setProperty("--notch-shape", `path("${shape}")`);
      rim.setAttribute("d", shape);
      root.style.setProperty("--handle-shape", `path("${notchPath({ x: 0, y: 0, width: w, height: h }, edge)}")`);
      root.style.setProperty("--ghost-x", (x + w / 2) * (1 - p) + 32.5 * p + "px");
      root.style.setProperty("--ghost-y", (y + h / 2) * (1 - p) + 31 * p + "px");
      root.style.setProperty("--ghost-size", 20 + 2 * p + "px");
      root.style.setProperty("--notch-content", String(unit((p - 0.22) / 0.78)));
      root.style.setProperty("--handle-opacity", String(1 - Math.min(1, p * 4)));
      root.classList.toggle("present", p > 0.001 || reveal.target === 1);
      // Closed, only the handle takes the pointer, as in the app (the window is click-through elsewhere).
      root.classList.toggle("is-open", p > 0.5);
    }
    const settle = () => { reveal.value = reveal.target; reveal.velocity = 0; paint(); };
    function frame(now) {
      let dt = Math.min((now - reveal.time) / 1000, 0.035);
      reveal.time = now;
      while (dt > 0) {
        const step = Math.min(dt, 1 / 120);
        reveal.velocity += (FREQUENCY * FREQUENCY * (reveal.target - reveal.value) - 2 * FREQUENCY * reveal.velocity) * step;
        reveal.value += reveal.velocity * step;
        dt -= step;
      }
      paint();
      if (Math.abs(reveal.value - reveal.target) < 0.003 && Math.abs(reveal.velocity) < 0.02) { settle(); reveal.frame = 0; }
      else reveal.frame = requestAnimationFrame(frame);
    }
    function open(on) {
      reveal.target = on ? 1 : 0;
      handle.setAttribute("aria-expanded", String(!!on));
      if (reduced.matches) { cancelAnimationFrame(reveal.frame); reveal.frame = 0; settle(); return; }
      paint();
      if (!reveal.frame) { reveal.time = performance.now(); reveal.frame = requestAnimationFrame(frame); }
    }
    function listen(on) {
      root.classList.toggle("listening", !!on);
      label.textContent = on ? "Listening…" : "Hold to talk";
    }

    let pinned = false, leaving = 0, held = false;
    const setPinned = (on) => {
      pinned = on;
      pin.setAttribute("aria-pressed", String(on));
      const text = on ? "Let the panel close" : "Keep the panel open";
      pin.setAttribute("aria-label", text); pin.title = text;
    };
    if (o.interactive) {
      // Hover opens; leaving closes a moment later (notch.rs waits before closing), unless pinned or held.
      root.addEventListener("pointerenter", () => { clearTimeout(leaving); open(true); });
      root.addEventListener("pointerleave", () => { clearTimeout(leaving); leaving = setTimeout(() => { if (!pinned && !held) open(false); }, 350); });
      handle.addEventListener("click", () => { setPinned(!pinned); open(true); });
      pin.addEventListener("click", () => setPinned(!pinned));
      const down = (e) => { if (e.type === "pointerdown" && e.button !== 0) return; e.preventDefault(); held = true; listen(true); };
      const up = () => { if (!held) return; held = false; listen(false); };
      voice.addEventListener("pointerdown", (e) => { voice.setPointerCapture(e.pointerId); down(e); });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) voice.addEventListener(type, up);
      voice.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat && !held) down(e); });
      voice.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); up(); } });
      root.addEventListener("keydown", (e) => { if (e.key === "Escape") { up(); setPinned(false); open(false); } });
      root.addEventListener("focusin", () => open(true));
    } else {
      root.setAttribute("aria-hidden", "true");
      root.querySelectorAll("button").forEach((b) => { b.tabIndex = -1; });
      root.style.pointerEvents = "none";
    }
    settle();
    return { el: root, open, listen, pinned: () => pinned, setPinned, isOpen: () => reveal.target === 1 };
  };
})();
