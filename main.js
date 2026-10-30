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

  // ---- ask: the desktop with the ghost, and the phone talking to it ------------------------
  // The ghost is the desktop app's own (desktop/src/buddy.ts and src-tauri/src/buddy.rs, frame.ts),
  // ported as it is: the flight along an arc, eased, taking 480 to 1000 ms; the spring that makes it
  // lag its pointer; the ring and arm when it points at something small; the barrier it grows into
  // round something big; the eyes that slide up to 24 of its own units; the label; the blink. The
  // phone is the Ask tab (mobile/src/components/AssistantPanel.tsx): the rows, the band and the
  // ruler of 36 ticks that rises with the voice. The explanation is the app's own tour: for each part,
  // the ghost is sent there and the voice is asked to say just that part.
  (() => {
    const deskEl = $("#desk");
    if (!deskEl) return;
    const sceneEl = $("#scene");
    const plane = $("#plane"), layer = $("#gl");
    const GHOST = {
      body: "M78.76 0.14C78.76 2.72 78.76 5.28 78.76 7.9C78.76 10.51 78.76 13.12 78.76 15.81C78.76 18.5 78.76 21.21 78.76 24.04C78.76 26.87 78.76 29.74 78.76 32.78C78.76 35.81 78.76 38.92 78.76 42.26C78.76 45.59 78.76 49.03 78.76 52.79C78.76 56.55 79.67 61.36 78.76 64.81C77.85 68.25 76.44 72.07 73.3 73.45C70.16 74.84 63.05 71.75 59.91 73.11C56.78 74.47 56.28 78.48 54.48 81.61C52.67 84.73 51.44 89.25 49.08 91.84C46.71 94.44 43.55 96.34 40.29 97.19C37.02 98.03 33.2 98.18 29.48 96.9C25.76 95.63 21.38 90.96 17.95 89.56C14.52 88.16 11.85 88.34 8.9 88.51C5.95 88.69 3.24 89.34 0.22 90.59C-2.79 91.84 -5.84 94.21 -9.19 96.01C-12.53 97.82 -16.39 100.74 -19.85 101.42C-23.32 102.11 -26.9 101.37 -30 100.12C-33.11 98.86 -35.91 96.26 -38.47 93.88C-41.04 91.49 -43.05 88.2 -45.4 85.79C-47.75 83.38 -49.17 80.24 -52.57 79.42C-55.97 78.6 -62.11 81.54 -65.8 80.86C-69.49 80.18 -72.66 78.03 -74.73 75.34C-76.8 72.65 -77.62 68.49 -78.22 64.73C-78.82 60.97 -78.3 56.53 -78.31 52.79C-78.33 49.04 -78.31 45.59 -78.31 42.26C-78.31 38.92 -78.31 35.81 -78.31 32.78C-78.31 29.74 -78.31 26.87 -78.31 24.04C-78.31 21.21 -78.31 18.5 -78.31 15.81C-78.31 13.12 -78.31 10.51 -78.31 7.9C-78.31 5.28 -78.31 2.72 -78.31 0.14C-78.31 -2.45 -78.35 -5.02 -78.31 -7.63C-78.26 -10.23 -78.21 -12.85 -78.04 -15.49C-77.87 -18.12 -77.62 -20.78 -77.27 -23.45C-76.92 -26.12 -76.47 -28.81 -75.92 -31.51C-75.38 -34.22 -74.8 -36.97 -74.01 -39.68C-73.21 -42.38 -72.19 -45.01 -71.17 -47.73C-70.16 -50.45 -69.2 -53.3 -67.92 -55.98C-66.64 -58.65 -65.1 -61.24 -63.47 -63.78C-61.84 -66.32 -60.06 -68.82 -58.14 -71.22C-56.21 -73.62 -54.15 -75.98 -51.93 -78.18C-49.71 -80.39 -47.36 -82.57 -44.83 -84.45C-42.3 -86.32 -39.54 -87.92 -36.74 -89.42C-33.95 -90.91 -31.03 -92.26 -28.06 -93.41C-25.08 -94.56 -22 -95.53 -18.9 -96.31C-15.79 -97.1 -12.61 -97.71 -9.42 -98.13C-6.23 -98.56 -2.99 -98.9 0.22 -98.87C3.44 -98.84 6.66 -98.36 9.85 -97.93C13.04 -97.5 16.24 -97.06 19.34 -96.29C22.44 -95.51 25.52 -94.48 28.46 -93.25C31.4 -92.02 34.22 -90.46 36.98 -88.91C39.74 -87.35 42.53 -85.85 45.02 -83.95C47.51 -82.05 49.73 -79.7 51.92 -77.49C54.11 -75.29 56.24 -73.06 58.15 -70.69C60.07 -68.32 61.83 -65.82 63.44 -63.29C65.04 -60.76 66.45 -58.11 67.77 -55.49C69.1 -52.87 70.35 -50.25 71.39 -47.58C72.44 -44.91 73.26 -42.15 74.04 -39.45C74.82 -36.75 75.5 -34.07 76.07 -31.39C76.65 -28.71 77.14 -26.04 77.48 -23.38C77.82 -20.72 77.9 -18.04 78.11 -15.41C78.32 -12.78 78.63 -10.21 78.74 -7.62C78.85 -5.03 78.76 -2.45 78.76 0.14Z",
      attentive: [{"d":"M-10.5 -11.5A10.5 10.5 0 0 1 0 -22L0 -22A10.5 10.5 0 0 1 10.5 -11.5L10.5 11.5A10.5 10.5 0 0 1 0 22L0 22A10.5 10.5 0 0 1 -10.5 11.5Z","m":[0.96,-0.08,0.05,0.99,-21.39,-9.01]},{"d":"M-10.5 -11.5A10.5 10.5 0 0 1 0 -22L0 -22A10.5 10.5 0 0 1 10.5 -11.5L10.5 11.5A10.5 10.5 0 0 1 0 22L0 22A10.5 10.5 0 0 1 -10.5 11.5Z","m":[0.96,-0.01,0.05,0.99,23.94,-11.23]}],
      excited: [{"d":"M-20 -8A20 20 0 0 1 0 -28L0 -28A20 20 0 0 1 20 -8L20 8A20 20 0 0 1 0 28L0 28A20 20 0 0 1 -20 8Z","m":[0.97,-0.08,0.13,0.96,-17.83,25.32]},{"d":"M-20 -8A20 20 0 0 1 0 -28L0 -28A20 20 0 0 1 20 -8L20 8A20 20 0 0 1 0 28L0 28A20 20 0 0 1 -20 8Z","m":[0.86,0.08,-0.19,0.96,42.81,23.14]}],
    };
    const NS = "http://www.w3.org/2000/svg";
    const make = (tag, attrs = {}, parent) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (parent) parent.append(n);
      return n;
    };

    // ----- the ghost (buddy.ts and buddy.rs) -----
    const ANCHOR = { x: 100, y: 90 };
    const HAND = { x: ANCHOR.x + 5, y: ANCHOR.y + 8 };
    const POINTER_PX = 20, LAG = 0.8, STIFFNESS = 90, DAMPING = 11, GAZE = 24, FRAME_PAD = 16;
    const RATIO = 172 / 215;
    const TINT = "#fb6a22";
    const GHOST_SIZE = 2.4; // a multiple of the pointer; the setting runs from 0.5 to 5

    const ease3 = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    function arcBent(from, to, t, bend, most) {
      const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
      if (d < 1) return { x: to.x, y: to.y };
      let nx = -dy / d, ny = dx / d;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const push = Math.min(d * bend, most);
      const c = { x: (from.x + to.x) / 2 + nx * push, y: (from.y + to.y) / 2 + ny * push };
      const u = 1 - t;
      return { x: u * u * from.x + 2 * u * t * c.x + t * t * to.x, y: u * u * from.y + 2 * u * t * c.y + t * t * to.y };
    }
    const flightMs = (d) => clamp(380 + d * 0.32, 480, 1000);
    const approach = (from, to, dt, rate) => from + (to - from) * Math.min(1, dt * rate);

    class Ghost {
      constructor(host, width, height) {
        this.W = width; this.H = height;
        this.t = 0; // its own clock, in ms: it can be run ahead for a still frame
        this.px = POINTER_PX * GHOST_SIZE;
        this.live = { x: 0, y: 0 };
        this.anchor = { x: 0, y: 0 };
        this.prevAnchor = null;
        this.act = null;
        this.request = null;
        this.on = false;
        this.clickedAt = -1e4;
        this.s = {
          x: 0, y: 0, vx: 0, vy: 0, pendX: 0, pendY: 0,
          pointing: false, framing: false, pointAmt: 0, framingAmt: 0, aimX: 0, aimY: 0, ring: 12, label: "",
          flipToX: false, flipToY: false, flipX: 0, flipY: 0, grip: 0, presence: 0, bobPhase: 0,
          gx: 0, gy: 0, arrived: 0, excitedUntil: 0, nextBlink: 1500, blinkUntil: 0, held: false,
        };
        this.build(host);
      }

      build(host) {
        // The frame (a second window on the desktop) goes under the ghost's own.
        this.frame = document.createElement("div");
        this.frame.className = "gframe";
        this.frame.innerHTML = '<div class="barrier"><div class="eyes"><i></i><i></i></div></div>';
        this.barrier = this.frame.firstChild;
        host.append(this.frame);

        this.cursor = make("svg", { class: "g-cursor", viewBox: "-1 -1 14 21", width: "14", height: "21" });
        make("path", { d: "M0 0L0 16L3.8 12.6L6.6 18.8L9.2 17.6L6.4 11.6L11.4 11.6Z", fill: "#fff", stroke: "#000", "stroke-width": "1.1", "stroke-linejoin": "round" }, this.cursor);
        host.append(this.cursor);

        this.win = document.createElement("div");
        this.win.className = "g-win g-ghostwin";
        host.append(this.win);

        const props = make("svg", { viewBox: "0 0 280 260", width: "280", height: "260" }, this.win);
        const arm = make("g", { opacity: "0" }, props);
        this.armEdge = make("path", { fill: "none", stroke: "#16181b", "stroke-linecap": "round" }, arm);
        this.armFill = make("path", { fill: "none", stroke: TINT, "stroke-linecap": "round" }, arm);
        this.hand = make("circle", { fill: TINT, stroke: "#16181b" }, arm);
        this.armG = arm;
        this.rippleEdge = make("circle", { fill: "none", stroke: "#16181b", opacity: "0" }, props);
        this.ripple = make("circle", { fill: "none", stroke: TINT, opacity: "0" }, props);
        this.ringEdge = make("circle", { fill: "none", stroke: "#16181b", opacity: "0" }, props);
        this.ringFill = make("circle", { fill: "none", stroke: TINT, opacity: "0" }, props);
        this.pill = make("g", { opacity: "0" }, props);
        this.pillBox = make("rect", { x: "0", y: "0", rx: "10", fill: "#16181b", "stroke-width": "1.5", stroke: TINT }, this.pill);
        this.pillText = make("text", { "text-anchor": "middle", fill: "#ffffff", "font-size": "11", "font-weight": "600", "font-family": "'Segoe UI', system-ui, sans-serif" }, this.pill);

        const w = this.px * RATIO;
        this.svg = make("svg", { viewBox: "-86 -106 172 215", width: w.toFixed(2), height: this.px.toFixed(2) }, this.win);
        this.svg.style.willChange = "transform";
        const id = `gmask-${Math.random().toString(36).slice(2, 8)}`;
        const mask = make("mask", { id, maskUnits: "userSpaceOnUse", x: "-158", y: "-158", width: "316", height: "316" });
        make("path", { d: GHOST.body, fill: "#fff" }, mask);
        this.eyesG = make("g", {}, mask);
        this.blinkG = make("g", {}, this.eyesG);
        this.eyesHolder = make("g", {}, this.blinkG);
        const defs = make("defs", {}, this.svg);
        defs.append(mask);
        make("rect", { x: "-158", y: "-158", width: "316", height: "316", fill: TINT, mask: `url(#${id})` }, this.svg);
        this.face = null;
        this.wear("attentive");
      }

      wear(face) {
        if (this.face === face) return;
        this.face = face;
        this.eyesHolder.replaceChildren();
        for (const eye of GHOST[face]) make("path", { d: eye.d, fill: "#000", transform: `matrix(${eye.m.join(" ")})` }, this.eyesHolder);
      }

      /** The pointer (the system's, drawn here). It is where the ghost's anchor is when it is not showing something. */
      setPointer(x, y) {
        this.live = { x, y };
        this.cursor.style.transform = `translate(${x}px, ${y}px)`;
        if (!this.act && !this.prevAnchor) this.anchor = { x, y };
      }

      start() {
        this.on = true;
        this.s.arrived = this.t;
        this.s.excitedUntil = this.t + 1400;
      }
      stop() {
        this.on = false;
        this.s.presence = 0;
        this.act = null;
        this.request = null;
        this.closeFrame(true);
        this.prevAnchor = null;
        for (const k of ["x", "y", "vx", "vy", "pendX", "pendY", "pointAmt", "framingAmt", "grip", "gx", "gy"]) this.s[k] = 0;
        this.s.pointing = this.s.framing = false;
        this.render(0);
      }

      /** What the phone asks for (see `show` in buddy.rs). A box in plane pixels. */
      show(box, label, frame, hold) { this.request = { kind: "show", ...box, label, frame, hold }; }
      clear() { this.request = { kind: "clear" }; }
      get home() { return this.act === null; }

      flips(to, ghost) {
        const room = { x: 8 + 0.55 * ghost + 90, y: 8 + 0.5 * ghost + 60 };
        return { x: to.x + room.x > this.W, y: to.y + room.y > this.H };
      }

      sendHome(from) {
        const a = this.act;
        if (!a || a.phase === "back") return;
        if (a.framed) { this.closeFrame(false); a.framed = false; }
        a.phase = "back"; a.since = this.t; a.from = from; a.took = 520;
      }

      openFrame(a) {
        const pad = FRAME_PAD;
        const w = a.what.right - a.what.left + 2 * pad, h = a.what.bottom - a.what.top + 2 * pad;
        const f = this.frame;
        f.style.display = "block";
        f.style.transform = `translate(${a.what.left - pad}px, ${a.what.top - pad}px)`;
        f.style.width = `${w}px`; f.style.height = `${h}px`;
        const height = this.px, width = height * RATIO;
        const b = this.barrier;
        window.clearTimeout(this.liveTimer);
        b.className = "barrier";
        const place = (box) => { b.style.left = `${box.left}px`; b.style.top = `${box.top}px`; b.style.width = `${box.width}px`; b.style.height = `${box.height}px`; };
        this.blob = { left: pad - width / 2, top: pad - height / 2, width, height };
        place(this.blob);
        void b.offsetWidth;
        b.className = "barrier go";
        b.style.opacity = "1";
        requestAnimationFrame(() => {
          b.classList.add("open");
          place({ left: pad, top: pad, width: Math.max(8, w - 2 * pad), height: Math.max(8, h - 2 * pad) });
        });
        this.liveTimer = window.setTimeout(() => b.classList.add("live"), 620);
        this.place = place;
      }
      closeFrame(now) {
        window.clearTimeout(this.liveTimer);
        const b = this.barrier;
        b.classList.remove("live", "open");
        if (this.blob && this.place) this.place(this.blob);
        window.clearTimeout(this.hideTimer);
        if (now) { b.style.opacity = "0"; this.frame.style.display = "none"; return; }
        window.setTimeout(() => { b.style.opacity = "0"; }, 380);
        this.hideTimer = window.setTimeout(() => { if (!this.act || !this.act.framed) this.frame.style.display = "none"; }, 500);
      }

      /** Advances the clock by `dtMs` and draws. */
      step(dtMs) {
        this.t += dtMs;
        const now = this.t;
        const dt = Math.min(0.05, dtMs / 1000);
        const live = this.live;
        const ghost = this.px;

        // ---- what the desktop's thread does (buddy.rs `run`) ----
        const req = this.request; this.request = null;
        if (req && this.on) {
          const here = this.act ? this.anchor : live;
          if (req.kind === "show") {
            const same = this.act && this.act.phase === "held" && this.act.what.frame === req.frame &&
              this.act.what.left === req.left && this.act.what.top === req.top && this.act.what.right === req.right && this.act.what.bottom === req.bottom;
            if (same) {
              this.act.since = now; this.act.what.hold = req.hold; this.act.what.label = req.label;
            } else {
              if (this.act && this.act.framed) this.closeFrame(false);
              const rest = { x: 8 + 0.55 * ghost, y: 8 + 0.5 * ghost };
              let to, ring = 0;
              if (req.frame) to = { x: req.left - rest.x, y: req.top - rest.y };
              else {
                to = { x: (req.left + req.right) / 2, y: (req.top + req.bottom) / 2 };
                const reach = Math.max(req.right - req.left, req.bottom - req.top);
                ring = clamp(reach / 2 + 6, 9, 34);
              }
              const flip = this.flips(to, ghost);
              this.act = {
                what: { left: req.left, top: req.top, right: req.right, bottom: req.bottom, label: req.label, frame: req.frame, hold: req.hold },
                phase: "out", since: now, from: { ...here }, to, took: flightMs(Math.hypot(to.x - here.x, to.y - here.y)),
                framed: false, flip, ring,
              };
            }
          } else if (this.act) this.sendHome(here);
        }

        let finished = false;
        if (!this.act) this.anchor = { ...live };
        else {
          const a = this.act, elapsed = now - a.since;
          if (a.phase === "out") {
            const t = elapsed / a.took;
            this.anchor = arcBent(a.from, a.to, ease3(t), 0.2, 260);
            if (t >= 1) {
              this.anchor = { ...a.to }; a.phase = "held"; a.since = now;
              if (a.what.frame) { this.openFrame(a); a.framed = true; }
            }
          } else if (a.phase === "held") {
            this.anchor = { ...a.to };
            const long = a.what.hold ?? (a.what.frame ? 8000 : 6000);
            if (elapsed >= long) this.sendHome(this.anchor);
          } else {
            const t = elapsed / a.took;
            this.anchor = arcBent(a.from, live, ease3(t), 0.2, 260);
            finished = t >= 1;
          }
        }
        if (finished) { this.act = null; this.anchor = { ...live }; }

        // ---- the beat, and what the page does with it (buddy.ts) ----
        const s = this.s, a = this.act;
        const beat = { pointing: false, framing: false, ring: 0, label: "", flipX: false, flipY: false, aimX: 0, aimY: 0 };
        if (a) {
          if (a.phase === "held") {
            beat.pointing = !a.what.frame; beat.framing = a.what.frame; beat.ring = a.ring; beat.label = a.what.label;
            if (a.what.frame) {
              const mid = { x: (a.what.left + a.what.right) / 2, y: (a.what.top + a.what.bottom) / 2 };
              const dx = mid.x - this.anchor.x, dy = mid.y - this.anchor.y, len = Math.max(1, Math.hypot(dx, dy));
              beat.aimX = Math.round((dx / len) * 100) / 100; beat.aimY = Math.round((dy / len) * 100) / 100;
            }
          }
          beat.flipX = a.flip.x; beat.flipY = a.flip.y;
        }
        s.pointing = beat.pointing; s.framing = beat.framing; s.ring = beat.ring || s.ring; s.label = beat.label;
        s.aimX = beat.aimX; s.aimY = beat.aimY; s.flipToX = beat.flipX; s.flipToY = beat.flipY;
        if (this.prevAnchor) {
          s.pendX -= (this.anchor.x - this.prevAnchor.x) * LAG;
          s.pendY -= (this.anchor.y - this.prevAnchor.y) * LAG;
        }
        this.prevAnchor = { ...this.anchor };
        // The window follows the anchor.
        this.win.style.transform = `translate(${(this.anchor.x - ANCHOR.x).toFixed(2)}px, ${(this.anchor.y - ANCHOR.y).toFixed(2)}px)`;
        this.render(dt);
      }

      render(dt) {
        const now = this.t, s = this.s, px = this.px;
        const feed = Math.min(1, dt * 22);
        const max = 20 + px * 0.8;
        s.x = clamp(s.x + s.pendX * feed, -max, max);
        s.y = clamp(s.y + s.pendY * feed, -max, max);
        s.pendX -= s.pendX * feed; s.pendY -= s.pendY * feed;
        s.vx += (-STIFFNESS * s.x - DAMPING * s.vx) * dt;
        s.vy += (-STIFFNESS * s.y - DAMPING * s.vy) * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;

        const gripTo = s.held || s.pointing ? 1 : 0;
        s.grip = approach(s.grip, gripTo, dt, gripTo ? 12 : 6);
        s.presence = approach(s.presence, this.on ? 1 : 0, dt, 8);
        s.pointAmt = approach(s.pointAmt, s.pointing ? 1 : 0, dt, 9);
        s.framingAmt = approach(s.framingAmt, s.framing ? 1 : 0, dt, 9);
        s.flipX = approach(s.flipX, s.flipToX ? 1 : 0, dt, 8);
        s.flipY = approach(s.flipY, s.flipToY ? 1 : 0, dt, 8);
        const sx = 1 - 2 * s.flipX, sy = 1 - 2 * s.flipY;

        const w = px * RATIO, h = px;
        const rest = { x: 8 + px * 0.55, y: 8 + px * 0.5 };
        const near = { x: 5 + px * 0.45, y: 4 + px * 0.38 };
        const clearance = s.pointAmt * s.ring * 0.7;
        const rx = (rest.x + (near.x - rest.x) * s.grip + clearance) * sx;
        const ry = (rest.y + (near.y - rest.y) * s.grip + clearance) * sy;
        const busy = s.grip;
        s.bobPhase += dt * (2.2 + busy * 3);
        const bob = Math.sin(s.bobPhase) * (1.4 + px * 0.04) * (1 - busy * 0.4);
        const hop = Math.max(0, 1 - (now - s.arrived) / 500);
        const cx = ANCHOR.x + rx + s.x;
        const cy = ANCHOR.y + ry + s.y + bob - Math.sin(hop * Math.PI) * px * 0.4;

        const tilt = clamp(s.vx * 0.05 + s.x * 0.12, -22, 22);
        const stretch = 1 + Math.min(0.22, Math.hypot(s.x, s.y) / (100 + px * 4));
        const since = now - this.clickedAt;
        const press = since < 220 ? Math.sin((since / 220) * Math.PI) * 0.14 : 0;
        const scale = s.presence * (1 + s.grip * 0.06) * (1 - press);
        this.svg.style.transform = `translate(${(cx - w / 2).toFixed(2)}px, ${(cy - h / 2).toFixed(2)}px) rotate(${tilt.toFixed(2)}deg) scale(${(scale / Math.sqrt(stretch)).toFixed(3)}, ${(scale * stretch).toFixed(3)})`;
        this.svg.style.opacity = String(Math.min(1, s.presence * 1.4));

        this.wear(now < s.excitedUntil ? "excited" : "attentive");
        const pa = s.pointAmt, reach = s.ring * 0.72;
        const hx = HAND.x + (ANCHOR.x + sx * reach - HAND.x) * pa;
        const hy = HAND.y + (ANCHOR.y + sy * reach - HAND.y) * pa;
        const fa = s.framingAmt;
        const toX = (hx - cx) * (1 - fa) + s.aimX * 60 * fa;
        const toY = (hy - cy) * (1 - fa) + s.aimY * 60 * fa;
        const dist = Math.hypot(toX, toY) || 1;
        const pull = Math.min(1, dist / 12);
        s.gx = approach(s.gx, (toX / dist) * GAZE * pull, dt, 14);
        s.gy = approach(s.gy, (toY / dist) * GAZE * pull, dt, 14);
        this.eyesG.setAttribute("transform", `translate(${s.gx.toFixed(2)} ${s.gy.toFixed(2)})`);

        if (now > s.nextBlink) { s.blinkUntil = now + 110; s.nextBlink = now + 2200 + ((Math.sin(now) + 1) / 2) * 3200; }
        const k = now < s.blinkUntil ? 0.12 : 1, pivot = -10;
        this.blinkG.setAttribute("transform", `translate(0 ${pivot}) scale(1 ${k}) translate(0 ${-pivot})`);

        const ax = cx - Math.sign(cx - hx || 1) * (w * 0.32), ay = cy + h * 0.12;
        const span = Math.hypot(ax - hx, ay - hy);
        const sag = (Math.max(0, 16 - span * 0.12) * (1 - s.grip * 0.6) + 5) * Math.min(1, px / 40);
        const d = `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${((ax + hx) / 2).toFixed(1)} ${((ay + hy) / 2 + sag).toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`;
        const edge = Math.max(3.2, px * 0.13);
        this.armEdge.setAttribute("d", d); this.armEdge.setAttribute("stroke-width", edge.toFixed(2));
        this.armFill.setAttribute("d", d); this.armFill.setAttribute("stroke-width", (edge - 2).toFixed(2));
        this.hand.setAttribute("cx", hx.toFixed(1)); this.hand.setAttribute("cy", hy.toFixed(1));
        this.hand.setAttribute("r", (Math.max(2.8, px * 0.1) * (1 + s.grip * 0.2)).toFixed(2)); this.hand.setAttribute("stroke-width", "1.2");
        this.armG.setAttribute("opacity", (s.grip * s.presence).toFixed(3));

        const throb = 1 + Math.sin((now / 1000) * 5) * 0.08;
        const ringR = Math.max(1, s.ring * (0.55 + 0.45 * pa) * throb);
        for (const [c, wd] of [[this.ringEdge, 5.5], [this.ringFill, 3]]) {
          c.setAttribute("cx", String(ANCHOR.x)); c.setAttribute("cy", String(ANCHOR.y));
          c.setAttribute("r", ringR.toFixed(2)); c.setAttribute("stroke-width", String(wd)); c.setAttribute("opacity", pa.toFixed(3));
        }
        const age = since / 520, liveRip = age >= 0 && age < 1 ? 1 - age : 0;
        for (const [c, wd] of [[this.rippleEdge, 5], [this.ripple, 2.5]]) {
          c.setAttribute("cx", String(ANCHOR.x)); c.setAttribute("cy", String(ANCHOR.y));
          c.setAttribute("r", (4 + (1 - liveRip) * (14 + px * 0.5)).toFixed(2)); c.setAttribute("stroke-width", String(wd));
          c.setAttribute("opacity", (liveRip * 0.95).toFixed(3));
        }

        const naming = Math.max(pa, fa);
        const name = s.label.length > 24 ? `${s.label.slice(0, 23)}…` : s.label;
        if (this.pillText.textContent !== name) this.pillText.textContent = name;
        const pillW = name ? name.length * 6.6 + 18 : 0, pillH = 20;
        const pillY = sy > 0 ? cy + h / 2 + 6 : cy - h / 2 - pillH - 6;
        const pillX = clamp(cx - pillW / 2, 4, 276 - pillW);
        this.pillBox.setAttribute("width", pillW.toFixed(1)); this.pillBox.setAttribute("height", String(pillH));
        this.pillText.setAttribute("x", String(pillW / 2)); this.pillText.setAttribute("y", String(pillH / 2 + 4));
        this.pill.setAttribute("transform", `translate(${pillX.toFixed(1)} ${pillY.toFixed(1)}) scale(${(0.7 + 0.3 * naming).toFixed(3)})`);
        this.pill.setAttribute("opacity", (name ? naming * s.presence : 0).toFixed(3));
      }
    }

    const ghost = new Ghost(layer, 1000, 625);
    const REST_POINTER = { x: 520, y: 330 };
    ghost.setPointer(REST_POINTER.x, REST_POINTER.y);
    ghost.stop();

    // The ghost is drawn while the scene is on screen; off it, nothing runs.
    let visible = false, raf = 0, lastFrame = 0;
    const loop = (t) => {
      raf = 0;
      if (!visible || document.hidden || still()) return;
      ghost.step(Math.min(50, t - lastFrame));
      lastFrame = t;
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (raf || !visible || document.hidden || still()) return;
      lastFrame = performance.now();
      raf = requestAnimationFrame(loop);
    };
    /** For a still frame: the ghost's own time, run on until it has got there and settled. */
    const settle = (ms = 2600) => { for (let t = 0; t < ms; t += 16) ghost.step(16); };

    // ----- the screen: Audacity's two tracks -----
    function wave(el, seed, shape) {
      let r = seed;
      const rnd = () => { r = (r * 1664525 + 1013904223) % 4294967296; return r / 4294967296; };
      let top = "", bottom = "";
      for (let x = 0; x <= 480; x += 2) {
        const env = shape(x / 480);
        const a = Math.min(56, 3 + env * 52 * (0.45 + 0.55 * rnd()));
        top += `${x ? "L" : "M"}${x},${(60 - a).toFixed(1)}`;
        bottom = `L${x},${(60 + a).toFixed(1)}` + bottom;
      }
      el.innerHTML = `<line x1="0" y1="60" x2="480" y2="60"/><path d="${top}${bottom}Z"/>`;
    }
    wave($("#wf1"), 7, (u) => { const g = Math.max(0, Math.sin(u * 22) * Math.sin(u * 5.3 + 1)); return 0.18 + 0.82 * g * g; });
    wave($("#wf2"), 19, (u) => 0.28 + 0.5 * Math.abs(Math.sin(u * 9)) + 0.18 * Math.sin(u * 31) ** 2);

    // ----- the phone (AssistantPanel.tsx) -----
    for (const body of $$(".ph .gb")) body.setAttribute("d", GHOST.body);
    for (const holder of $$(".ph .ge")) {
      for (const eye of GHOST.attentive) make("path", { d: eye.d, transform: `matrix(${eye.m.join(" ")})` }, holder);
    }
    const phLog = $("#phLog"), phWord = $("#phWord"), phRuler = $("#phRuler"), phHush = $("#phHush"), phMute = $("#phMute");
    const TICKS = 36, TICK_MAX = 26;
    phRuler.innerHTML = "<i></i>".repeat(TICKS);
    const ticks = [...phRuler.children];
    let levels = new Array(TICKS).fill(0);
    const drawLevels = () => levels.forEach((l, i) => { ticks[i].style.height = `${(2 + l * TICK_MAX).toFixed(1)}px`; });
    drawLevels();
    const WORDS = { listening: "Listening", thinking: "Thinking", speaking: "Speaking" };
    let voice = "listening", beat = 0;
    function setVoice(v) {
      voice = v;
      phWord.textContent = WORDS[v];
      phHush.classList.toggle("hidden", v !== "speaking");
    }
    // The ruler rises with whoever is making sound: the voice while it speaks, the microphone while it listens.
    // Speech sits low on the scale; the square root lifts it into view (the app does the same).
    function pushLevel() {
      beat++;
      let level = 0;
      if (voice === "speaking") {
        const syl = Math.abs(Math.sin(beat * 0.93) * Math.cos(beat * 0.37));
        level = (0.12 + 0.55 * syl) * (0.55 + 0.45 * Math.sin(beat * 0.21) ** 2);
      } else if (voice === "listening") level = 0.004 + 0.006 * Math.abs(Math.sin(beat * 1.3));
      levels = [...levels.slice(1), Math.min(1, Math.sqrt(level) * 1.4)];
      drawLevels();
    }

    function row(html, cls) {
      const d = document.createElement("div");
      d.className = cls;
      d.innerHTML = html;
      phLog.append(d);
      return d;
    }
    const rowYou = (text) => row(`<b>You</b><span class="faint">${text}</span>`, "ph-row-you");
    const rowDid = (word, text, detail) => row(`<b>${word}</b><div><span>${text}</span>${detail ? `<em>${detail}</em>` : ""}</div>`, "ph-row-did");
    const rowAsst = () => row('<b>Assistant</b><span></span>', "ph-row-asst");

    // ----- the explanation: the app's own tour, one part at a time -----
    const boxOf = (el) => {
      const pr = plane.getBoundingClientRect(), r = el.getBoundingClientRect(), k = pr.width / 1000;
      return { left: (r.left - pr.left) / k, top: (r.top - pr.top) / k, right: (r.right - pr.left) / k, bottom: (r.bottom - pr.top) / k };
    };
    const STOPS = [
      { el: "#aud", label: "Audacity", frame: true, say: "This is Audacity, a sound editor, with one recording open." },
      { el: "#audRecord", label: "Record", frame: false, say: "The red circle starts recording from your microphone." },
      { el: "#audTracks", label: "Tracks", frame: true, say: "These two tracks are the sound itself, and taller means louder." },
    ];
    const TOUR_HOLD_MS = 12000;

    let run = 0;
    const wait = (ms, id) => new Promise((res) => setTimeout(() => res(id === run), still() ? 0 : ms));
    let ticker = 0;
    const startTicker = () => { if (!ticker && !still()) ticker = window.setInterval(pushLevel, 70); };
    const stopTicker = () => { window.clearInterval(ticker); ticker = 0; };

    function reset() {
      stopTicker();
      phLog.textContent = "";
      levels = new Array(TICKS).fill(0);
      drawLevels();
      setVoice("listening");
      ghost.stop();
    }

    async function speak(span, text, id) {
      setVoice("speaking");
      if (still()) { span.textContent = text; return id === run; }
      const words = text.split(" ");
      for (let i = 1; i <= words.length; i++) {
        span.textContent = words.slice(0, i).join(" ");
        const last = words[i - 1];
        if (!(await wait(250 + last.length * 22 + (/[.,]$/.test(last) ? 240 : 0), id))) return false;
      }
      return true;
    }

    async function play() {
      const id = ++run;
      reset();
      if (still()) {
        // One still frame: everything said, the ghost standing on the last part.
        rowYou("What am I looking at?").querySelector("span").classList.remove("faint");
        rowDid("Did", "Explaining the screen", "3 parts on screen 1");
        for (const stop of STOPS) { const r = rowAsst(); r.lastChild.textContent = stop.say; }
        ghost.start();
        const last = STOPS[STOPS.length - 1];
        ghost.show(boxOf($(last.el)), last.label, last.frame, TOUR_HOLD_MS);
        settle(1800);
        setVoice("listening");
        return;
      }
      ghost.start();
      startTicker();
      wake();
      if (!(await wait(900, id))) return;
      // You speak, and what you said arrives a moment later.
      const you = rowYou("…");
      if (!(await wait(1500, id))) return;
      you.querySelector("span").textContent = "What am I looking at?";
      you.querySelector("span").classList.remove("faint");
      setVoice("thinking");
      if (!(await wait(500, id))) return;
      const did = rowDid("Doing", "Explaining the screen");
      if (!(await wait(2000, id))) return;
      did.innerHTML = "<b>Did</b><div><span>Explaining the screen</span><em>3 parts on screen 1</em></div>";
      if (!(await wait(300, id))) return;
      for (const stop of STOPS) {
        // For each part: the ghost is sent there, and the voice says just that part.
        ghost.show(boxOf($(stop.el)), stop.label, stop.frame, TOUR_HOLD_MS);
        const asst = rowAsst();
        if (!(await speak(asst.lastChild, stop.say, id))) return;
        setVoice("thinking");
        if (!(await wait(700, id))) return;
      }
      ghost.clear();
      setVoice("listening");
      await wait(2400, id);
      if (id === run) stopTicker();
    }

    $("#sceneReplay").addEventListener("click", () => { started = true; play(); });

    // ----- fitting: the phone's size follows the screen's -----
    const fit = () => {
      const wide = matchMedia("(min-width: 861px)").matches;
      const ps = wide ? (deskEl.clientHeight - 32) / 844 : Math.min(0.82, (sceneEl.clientWidth - 32) / 390);
      sceneEl.style.setProperty("--ps", String(Math.max(0.3, ps)));
      plane.style.transform = `scale(${deskEl.clientWidth / 1000})`;
    };
    new ResizeObserver(fit).observe(deskEl);
    fit();

    let started = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) wake();
      }, { threshold: 0.05 }).observe(deskEl);
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting || started) return;
        started = true;
        io.disconnect();
        setTimeout(play, 500);
      }, { threshold: 0.7 });
      io.observe(deskEl);
    } else { visible = true; started = true; play(); }
    document.addEventListener("visibilitychange", wake);
    $("#pause").addEventListener("click", () => setTimeout(wake, 0));
    reduced.addEventListener("change", () => { if (!reduced.matches) wake(); });
  })();

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
