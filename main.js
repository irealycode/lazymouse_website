/* LazyMouse website. Plain JS, no dependencies.
 *
 * Motion rules, the same as the apps': it answers a question or it goes. Every
 * reveal starts from a state that is already visible (a backwards-filled Web
 * Animation, never a pre-hidden class), so a tab that never fires an observer
 * still shows the whole page. Anything that loops pauses off-screen, and under
 * prefers-reduced-motion nothing loops: the demos show one still frame and say
 * what it shows.
 */
(() => {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = false;
  const still = () => reduced.matches || paused;
  const ease = "cubic-bezier(0.25, 1, 0.5, 1)";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /** Runs `fn(visible)` whenever `el` enters or leaves the viewport. */
  function whenVisible(el, fn) {
    if (!("IntersectionObserver" in window)) return fn(true);
    new IntersectionObserver(([e]) => fn(e.isIntersecting), { threshold: 0.05 }).observe(el);
  }

  // ---- reveals ------------------------------------------------------------

  function revealLines(el, delay = 0) {
    if (reduced.matches) return;
    $$(".line-in", el).forEach((line, i) =>
      line.animate(
        [{ transform: "translateY(108%)" }, { transform: "translateY(0)" }],
        { duration: 800, delay: delay + i * 90, easing: ease, fill: "backwards" },
      ),
    );
  }

  function revealBlock(el, delay = 0) {
    if (reduced.matches) return;
    el.animate(
      [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }],
      { duration: 650, delay, easing: ease, fill: "backwards" },
    );
  }

  revealLines($(".hero h1"));
  const closeH = $(".close h2");
  revealBlock($(".hero-side"), 250);
  revealBlock($(".rig"), 380);

  const seen = new WeakSet();
  const reveal = (el) => {
    if (seen.has(el)) return;
    seen.add(el);
    if (el.tagName === "H2") revealLines(el);
    else revealBlock(el);
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px" });
    $$("[data-reveal]").forEach((el) => io.observe(el));
    io.observe(closeH);
  }

  // ---- the strip: the demo's link state ------------------------------------

  const strip = $("#strip");
  const stateText = $("#stateText");
  let liveTimer = 0;
  function live() {
    if (strip.dataset.state !== "live") {
      strip.dataset.state = "live";
      stateText.textContent = "Link live";
    }
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      strip.dataset.state = "idle";
      stateText.textContent = "Link idle";
    }, 1400);
  }

  // ---- rulers, as on the phone's pad ---------------------------------------

  function drawRulers(svg) {
    const el = svg.parentElement;
    const paint = () => {
      const w = el.clientWidth, h = el.clientHeight, step = 12;
      const tick = (long) => (long ? 9 : 5);
      let d = "";
      for (let x = step, i = 1; x < w; x += step, i++) {
        const t = tick(i % 5 === 0);
        d += `M${x} 0v${t}M${x} ${h}v${-t}`;
      }
      for (let y = step, i = 1; y < h; y += step, i++) {
        const t = tick(i % 5 === 0);
        d += `M0 ${y}h${t}M${w} ${y}h${-t}`;
      }
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4"/>`;
    };
    paint();
    new ResizeObserver(paint).observe(el);
  }
  drawRulers($("#rulers"));
  drawRulers($("#grulers"));

  // ---- the rig --------------------------------------------------------------
  //
  // The finger's path is sampled at 60 Hz, each sample stamped with when it was
  // touched. Each takes a trip across a simulated link. In "replayed" mode the
  // cursor reads the path off at (now - delay), in finger time, the way the
  // desktop app does; in "on arrival" mode it jumps to whatever landed last,
  // which is what the app did before and what makes a jittery link visible.

  const pad = $("#pad"), finger = $("#finger"), screen = $("#screen");
  const cursor = $("#cursor"), ghost = $("#ghost"), canvas = $("#trail");
  const ctx = canvas.getContext("2d");
  const rBehind = $("#rBehind"), rLate = $("#rLate");

  const rig = {
    link: "clean", mode: "replay",
    down: false, pos: { x: 0.5, y: 0.5 }, lastInput: -1e9,
    stroke: 0, lastSample: 0, lastArrival: 0, wasFinger: false,
    pending: [], buf: [], jitter: 0, delay: 8, behind: 8, late: 0,
    trail: [], fingerTrail: [], visible: true,
  };

  const MIN_DELAY = 8, MAX_DELAY = 60;
  const net = () => {
    if (rig.link === "clean") return 1 + Math.random() * 1.5;
    const spike = Math.random() < 0.035 ? 22 + Math.random() * 24 : 0;
    return -6 * Math.log(1 - Math.random()) + spike;
  };

  const rect = { w: 1, h: 1, dpr: 1 };
  function sizeCanvas() {
    rect.dpr = Math.min(devicePixelRatio || 1, 2);
    rect.w = screen.clientWidth; rect.h = screen.clientHeight;
    canvas.width = rect.w * rect.dpr; canvas.height = rect.h * rect.dpr;
  }
  sizeCanvas();
  new ResizeObserver(sizeCanvas).observe(screen);

  let colors = { ink: "#16181b", sig: "#c43f08" };
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    colors = { ink: cs.getPropertyValue("--ink").trim(), sig: cs.getPropertyValue("--signal-deep").trim() };
  }
  readColors();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);

  function padPoint(e) {
    const r = pad.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  }
  pad.addEventListener("pointerdown", (e) => {
    pad.setPointerCapture(e.pointerId);
    rig.down = true; pad.classList.add("down");
    rig.pos = padPoint(e); rig.lastInput = performance.now(); live(); pad.classList.add("touched");
  });
  pad.addEventListener("pointermove", (e) => {
    if (!rig.down) return;
    rig.pos = padPoint(e); rig.lastInput = performance.now(); live();
  });
  const lift = () => { rig.down = false; pad.classList.remove("down"); rig.lastInput = performance.now(); };
  pad.addEventListener("pointerup", lift);
  pad.addEventListener("pointercancel", lift);
  pad.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    rig.pos = { x: clamp(rig.pos.x + d[0] * 0.05, 0, 1), y: clamp(rig.pos.y + d[1] * 0.05, 0, 1) };
    rig.keyUntil = performance.now() + 220; rig.lastInput = performance.now(); live();
  });

  /** Where the finger is, or null if it is off the pad. */
  function fingerAt(now) {
    if (rig.down || now < (rig.keyUntil || 0)) return rig.pos;
    if (now - rig.lastInput < 1800 || still()) return null;
    return {
      x: 0.5 + 0.36 * Math.sin(now * 0.00115),
      y: 0.5 + 0.3 * Math.sin(now * 0.0017 + 1),
    };
  }

  function setRadio(group, attr, value) {
    $$("button", group).forEach((b) => {
      const on = b.dataset[attr] === value;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }
  $$(".rig-bar .ctl").forEach((group) => {
    const radios = $$("button", group);
    group.addEventListener("keydown", (e) => {
      const n = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!n) return;
      e.preventDefault();
      const i = radios.indexOf(document.activeElement);
      const next = radios[(i + n + radios.length) % radios.length];
      next.focus(); next.click();
    });
    radios.forEach((r) => (r.tabIndex = r.getAttribute("aria-checked") === "true" ? 0 : -1));
    group.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.link) { rig.link = b.dataset.link; setRadio(group, "link", rig.link); }
      if (b.dataset.mode) { rig.mode = b.dataset.mode; setRadio(group, "mode", rig.mode); }
      rig.late = 0; rig.jitter = 0; rig.delay = MIN_DELAY;
      rig.pending.length = 0; rig.lastArrival = 0;
    });
  });

  function sample(now, f) {
    if (!f) { rig.wasFinger = false; return; }
    if (!rig.wasFinger) rig.stroke++;
    rig.wasFinger = true;
    if (now - rig.lastSample < 16) return;
    rig.lastSample = now;
    const arrival = Math.max(now + net(), rig.lastArrival);
    rig.lastArrival = arrival;
    rig.pending.push({ sent: now, arrival, x: f.x, y: f.y, s: rig.stroke });
  }

  function deliver(now) {
    while (rig.pending.length && rig.pending[0].arrival <= now) {
      const p = rig.pending.shift();
      const dev = p.arrival - p.sent;
      // Fast to rise, slow to fall: the delay opens up quickly and closes gently.
      rig.jitter += (dev > rig.jitter ? 0.35 : 0.02) * (dev - rig.jitter);
      rig.delay = clamp(MIN_DELAY + 1.6 * Math.max(0, rig.jitter - 1), MIN_DELAY, MAX_DELAY);
      if (dev > rig.delay) rig.late++;
      rig.buf.push(p);
    }
    while (rig.buf.length > 2 && rig.buf[1].sent < now - 1500) rig.buf.shift();
  }

  /** The path at finger-time `T`, never interpolating across a lift. */
  function pathAt(T) {
    const b = rig.buf;
    if (!b.length) return null;
    if (T <= b[0].sent) return { x: b[0].x, y: b[0].y };
    for (let i = b.length - 1; i > 0; i--) {
      if (b[i - 1].sent <= T) {
        const a = b[i - 1], c = b[i];
        if (T >= c.sent) return { x: c.x, y: c.y };
        if (a.s !== c.s) return { x: a.x, y: a.y };
        const k = (T - a.sent) / (c.sent - a.sent);
        return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k };
      }
    }
    return { x: b[0].x, y: b[0].y };
  }

  let shown = null;
  function frame(now) {
    const f = fingerAt(now);
    sample(now, f);
    deliver(now);

    // finger ring on the pad
    if (f) {
      finger.style.opacity = "1";
      finger.style.transform = `translate(${f.x * pad.clientWidth}px, ${f.y * pad.clientHeight}px)`;
    } else finger.style.opacity = "0";

    // the cursor
    let c = null;
    if (rig.mode === "arrival") {
      const last = rig.buf[rig.buf.length - 1];
      c = last ? { x: last.x, y: last.y } : null;
    } else c = pathAt(now - rig.delay);
    if (c) {
      shown = c;
      cursor.style.transform = `translate(${c.x * rect.w}px, ${c.y * rect.h}px)`;
    }
    if (f) {
      ghost.style.opacity = "1";
      ghost.style.transform = `translate(${f.x * rect.w}px, ${f.y * rect.h}px)`;
    } else ghost.style.opacity = "0";

    // readouts, smoothed so they can be read
    const last = rig.buf[rig.buf.length - 1];
    const lag = rig.mode === "replay" ? rig.delay : last ? now - last.sent : rig.behind;
    rig.behind += 0.1 * (lag - rig.behind);
    rBehind.textContent = Math.round(rig.behind);
    rLate.textContent = rig.late;

    // the paths: the finger's, thin, and what the cursor actually did, thick
    if (f) rig.fingerTrail.push({ t: now, x: f.x, y: f.y, s: rig.stroke });
    if (c && f) rig.trail.push({ t: now, x: c.x, y: c.y, s: rig.stroke });
    drawTrails(now);
  }

  function drawTrails(now) {
    const LIFE = 900;
    while (rig.trail.length && now - rig.trail[0].t > LIFE) rig.trail.shift();
    while (rig.fingerTrail.length && now - rig.fingerTrail[0].t > LIFE) rig.fingerTrail.shift();
    ctx.setTransform(rect.dpr, 0, 0, rect.dpr, 0, 0);
    ctx.clearRect(0, 0, rect.w, rect.h);
    ctx.lineCap = "square";
    const stroke = (pts, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].s !== pts[i - 1].s) continue;
        ctx.globalAlpha = clamp(1 - (now - pts[i].t) / LIFE, 0, 1) * (width > 2 ? 0.9 : 0.55);
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x * rect.w, pts[i - 1].y * rect.h);
        ctx.lineTo(pts[i].x * rect.w, pts[i].y * rect.h);
        ctx.stroke();
      }
    };
    stroke(rig.fingerTrail, colors.sig, 1.5);
    stroke(rig.trail, colors.ink, 2.5);
    ctx.globalAlpha = 1;
  }

  // Reduced motion: one still frame, and no loop. The cursor sits where the path
  // would have put it, so the screen is not empty.
  function stillRig() {
    cursor.style.transform = `translate(${0.58 * rect.w}px, ${0.4 * rect.h}px)`;
  }

  let raf = 0;
  const loop = () => { frame(performance.now()); raf = requestAnimationFrame(loop); };
  function runRig() {
    cancelAnimationFrame(raf);
    if (still()) return stillRig();
    if (rig.visible && !document.hidden) raf = requestAnimationFrame(loop);
  }
  whenVisible($("#rig"), (v) => { rig.visible = v; runRig(); });
  document.addEventListener("visibilitychange", runRig);
  reduced.addEventListener("change", runRig);

  // ---- gestures --------------------------------------------------------------

  const gpad = $("#gpad"), gf1 = $("#gf1"), gf2 = $("#gf2"), glog = $("#glog");
  const gTitle = $("#gTitle"), gBody = $("#gBody");

  const ts = (t, dur) => 4821 + Math.round(t * dur);
  const moves = (from, to, n, dur) =>
    Array.from({ length: n }, (_, i) => {
      const at = from + ((to - from) * (i + 0.5)) / n;
      return { at, msg: `{"t":"mouse_move","dx":${6 - (i % 3)},"dy":${-2 + (i % 4)},"ts":${ts(at, dur)}}` };
    });
  const lerp = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  const GESTURES = {
    move: {
      title: "Drag one finger",
      body: "The cursor follows. Moving never holds the button down, so a long, slow move cannot select everything it passes over.",
      dur: 3000, still: 0.5,
      at: (t) => ({ f: [{ x: lerp(0.18, 0.8, seg(t, 0.08, 0.9)), y: 0.62 - 0.26 * Math.sin(seg(t, 0.08, 0.9) * Math.PI) }], held: false }),
      events: moves(0.1, 0.9, 7, 3000),
    },
    tap: {
      title: "Tap",
      body: "A short touch that barely moves is a left click. The pad flushes any pending movement first, so a click can never land short of where you pointed.",
      dur: 2200, still: 0.3,
      at: (t) => ({ f: t > 0.25 && t < 0.36 ? [{ x: 0.5, y: 0.5 }] : [], held: false }),
      events: [{ at: 0.36, msg: '{"t":"mouse_click","button":"left"}' }],
    },
    right: {
      title: "Two-finger tap",
      body: "Two fingers down and up together is a right click.",
      dur: 2200, still: 0.3,
      at: (t) => ({ f: t > 0.25 && t < 0.36 ? [{ x: 0.4, y: 0.52 }, { x: 0.6, y: 0.46 }] : [], held: false }),
      events: [{ at: 0.36, msg: '{"t":"mouse_click","button":"right"}' }],
    },
    scroll: {
      title: "Two-finger drag",
      body: "Both fingers move together and the page scrolls. Positive dy scrolls down.",
      dur: 2800, still: 0.5,
      at: (t) => {
        const k = seg(t, 0.15, 0.85);
        return { f: t > 0.1 && t < 0.9 ? [{ x: 0.4, y: lerp(0.28, 0.72, k) }, { x: 0.6, y: lerp(0.28, 0.72, k) }] : [], held: false };
      },
      events: Array.from({ length: 6 }, (_, i) => ({ at: 0.2 + i * 0.12, msg: '{"t":"scroll","dx":0,"dy":3}' })),
    },
    hold: {
      title: "Hold, then drag",
      body: "Hold a finger still for 300 ms and the button goes down where the cursor already is. Lifting releases it. A double tap, then a drag, does the same. A move that has already travelled can never turn into a hold.",
      dur: 3600, still: 0.55,
      at: (t) => {
        const down = t > 0.08 && t < 0.86;
        const k = seg(t, 0.32, 0.78);
        return { f: down ? [{ x: lerp(0.3, 0.74, k), y: lerp(0.62, 0.4, k) }] : [], held: t > 0.2 && t < 0.86 };
      },
      events: [
        { at: 0.2, msg: '{"t":"mouse_down","button":"left"}' },
        ...moves(0.34, 0.76, 4, 3600),
        { at: 0.86, msg: '{"t":"mouse_up","button":"left"}' },
      ],
    },
  };

  let gKey = "move", gStart = performance.now(), gLast = 0, gVisible = true, gRaf = 0;
  let logLines = [];

  function renderLog(newest) {
    glog.innerHTML = logLines
      .slice(-4)
      .map((l, i, a) => `<span class="row ${l === newest ? "new" : i < a.length - 1 ? "old" : ""}">${l.replace(/</g, "&lt;")}</span>`)
      .join("");
  }

  function renderGesture(t, fireFrom = null) {
    const g = GESTURES[gKey];
    const s = g.at(t);
    [gf1, gf2].forEach((el, i) => {
      const p = s.f[i];
      if (!p) { el.style.opacity = "0"; return; }
      el.style.opacity = "1";
      el.style.transform = `translate(${p.x * gpad.clientWidth}px, ${p.y * gpad.clientHeight}px)`;
    });
    gpad.classList.toggle("held", s.held);
    gpad.classList.toggle("down", s.f.length > 0);
    if (fireFrom !== null) {
      let newest = null;
      for (const e of g.events) if (e.at > fireFrom && e.at <= t) { logLines.push(e.msg); newest = e.msg; }
      if (newest) renderLog(newest);
    }
  }

  let gCycle = 0;
  function gTick() {
    const g = GESTURES[gKey];
    const elapsed = Math.max(0, performance.now() - gStart);
    const cycle = Math.floor(elapsed / g.dur);
    const t = (elapsed % g.dur) / g.dur;
    if (cycle !== gCycle) { gCycle = cycle; logLines = []; renderLog(null); gLast = 0; }
    renderGesture(t, gLast);
    gLast = t;
    gRaf = requestAnimationFrame(gTick);
  }

  function selectGesture(key) {
    gKey = key;
    const g = GESTURES[key];
    gTitle.textContent = g.title;
    gBody.textContent = g.body;
    if (!reduced.matches) [gTitle, gBody].forEach((el, i) => el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: i * 50, easing: ease, fill: "backwards" }));
    logLines = []; gLast = 0; gCycle = 0; gStart = performance.now();
    $$(".tabs button").forEach((b) => {
      const on = b.dataset.g === key;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $("#p-gest").setAttribute("aria-labelledby", `t-${key}`);
    if (still()) stillGesture();
    else { glog.innerHTML = ""; }
  }

  // Reduced motion: the frame where the gesture is happening, with every message
  // it has sent so far -- the information, without the loop.
  function stillGesture() {
    const g = GESTURES[gKey];
    logLines = g.events.filter((e) => e.at <= g.still).map((e) => e.msg);
    renderGesture(g.still, null);
    renderLog(null);
  }

  function runGestures() {
    cancelAnimationFrame(gRaf);
    if (still()) return stillGesture();
    if (gVisible && !document.hidden) { gStart = performance.now() - gLast * GESTURES[gKey].dur; gCycle = 0; gRaf = requestAnimationFrame(gTick); }
  }
  whenVisible($(".gest"), (v) => { gVisible = v; runGestures(); });
  document.addEventListener("visibilitychange", runGestures);
  reduced.addEventListener("change", runGestures);

  const tabs = $$(".tabs button");
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => { selectGesture(b.dataset.g); runGestures(); });
    b.addEventListener("keydown", (e) => {
      const n = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      let j = n ? (i + n + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
      if (j < 0) return;
      e.preventDefault();
      tabs[j].focus(); selectGesture(tabs[j].dataset.g); runGestures();
    });
  });
  selectGesture("move");

  const pauseBtn = $("#pause");
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.setAttribute("aria-pressed", String(paused));
    pauseBtn.textContent = paused ? "Resume motion" : "Pause motion";
    runRig(); runGestures();
  });

  // ---- pairing: the line fills as the steps are reached ------------------------

  const steps = $("#steps"), stepItems = $$("li", steps);
  let ticking = false;
  function pairProgress() {
    ticking = false;
    const r = steps.getBoundingClientRect(), vh = innerHeight, line = vh * 0.62;
    steps.style.setProperty("--p", clamp((line - r.top) / r.height, 0, 1).toFixed(3));
    stepItems.forEach((li) => li.classList.toggle("reached", li.getBoundingClientRect().top < line));
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(pairProgress); } }, { passive: true });
  addEventListener("resize", pairProgress);
  pairProgress();

  // ---- the bars --------------------------------------------------------------

  const bars = $("#bars");
  whenVisible(bars, (v) => {
    if (!v || bars.dataset.done || reduced.matches) return;
    bars.dataset.done = "1";
    $$(".track i", bars).forEach((bar, i) =>
      bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 900, delay: 120 + i * 140, easing: ease, fill: "backwards" }),
    );
    $$("[data-count]", bars).forEach((el, i) => {
      const to = parseFloat(el.dataset.count), start = performance.now() + 120 + (i + 1) * 140;
      const step = (now) => {
        const k = clamp((now - start) / 900, 0, 1);
        el.textContent = (to * (1 - Math.pow(1 - k, 4))).toFixed(1);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  // ---- modifiers: off, armed, held ---------------------------------------------

  const modLog = $("#modLog"), modState = $("#modState");
  const modLines = [];
  const NEXT = { off: "armed", armed: "held", held: "off" };
  $("#mods").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mod]");
    if (!b) return;
    const key = b.dataset.mod, from = b.dataset.s, to = NEXT[from];
    b.dataset.s = to;
    b.setAttribute("aria-label", `${key}, ${to}`);
    let line, say;
    if (to === "armed") { line = `// ${key} armed: the next key carries it`; say = `${key} is armed. The next keystroke carries it, then it clears.`; }
    else if (to === "held") { line = `{"t":"mod_down","key":"${key}"}`; say = `${key} is held. It stays down on the computer until you tap it again.`; }
    else { line = from === "held" ? `{"t":"mod_up","key":"${key}"}` : `// ${key} cleared`; say = `${key} is off.`; }
    modLines.push(line);
    modState.textContent = say;
    modLog.innerHTML = modLines.slice(-3).map((l, i, a) => `<span class="row ${i === a.length - 1 ? "new" : "old"}">${l}</span>`).join("");
  });

  // ---- zoom crops the source ------------------------------------------------------

  const zr = $("#zoomRange"), zo = $("#zoomOut"), zs = $("#zoomScene"), zscreen = $("#zoomScreen");
  const zc = $(".cursor", zs);
  function zoom() {
    const z = parseFloat(zr.value), W = zscreen.clientWidth, H = zscreen.clientHeight;
    const px = 0.52 * W, py = 0.36 * H;
    const tx = clamp(W / 2 - px * z, W - W * z, 0), ty = clamp(H / 2 - py * z, H - H * z, 0);
    zs.style.transformOrigin = "0 0";
    zs.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
    zc.style.transformOrigin = "0 0";
    zc.style.transform = `scale(${1 / Math.sqrt(z)})`;
    zo.textContent = `${z.toFixed(1).replace(/\.0$/, "")}×`;
  }
  zr.addEventListener("input", zoom);
  new ResizeObserver(zoom).observe(zscreen);
  zoom();

  // ---- downloads ---------------------------------------------------------------
  //
  // A button is a link only once there is something to link to. Until then it says
  // so, rather than pointing at nothing.

  const links = window.LAZYMOUSE_LINKS || {};
  $$("[data-dl]").forEach((a) => {
    const url = links[a.dataset.dl];
    if (!url) {
      a.setAttribute("role", "link");
      a.setAttribute("aria-disabled", "true");
      a.setAttribute("aria-label", a.dataset.soon);
      return;
    }
    a.href = url;
    a.classList.remove("soon");
    a.rel = "noopener";
    $(".tag", a)?.remove();
    $(`[data-note="${a.dataset.dl}"]`)?.remove();
  });
})();
