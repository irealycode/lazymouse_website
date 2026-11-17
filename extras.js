/* The ghost at work. Plain JS, no dependencies.
 *
 *  - Carrier: the ghost from the desktop app's buddy.ts. It holds the pointer with an arm; the
 *    pointer moves, the ghost lags behind on a spring, its eyes stay on the hand.
 *  - The hero: it pulls a heart diagram onto the screen and explains it part by part.
 *  - The trackpad demo: it carries the demo's cursor.
 *  - Takes over: it changes the wallpaper, click by click.
 *  - The footer: the word, in ghosts that lean and look at your cursor.
 *
 * Everything loops only while on screen. Under prefers-reduced-motion each demo shows one
 * still frame that says what it shows.
 */
(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tpl = $("#ghostTpl");
  const SVGNS = "http://www.w3.org/2000/svg";

  /** Tracks whether an element is on screen and the tab is visible. */
  function watch(el) {
    const s = { on: false };
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { s.on = e.isIntersecting; }, { threshold: 0.02 }).observe(el);
    else s.on = true;
    s.live = () => s.on && !document.hidden;
    return s;
  }

  /** A clock that only runs while `live()`: sleeps and tweens pause off-screen. */
  function director(live) {
    let last = performance.now(), t = 0;
    const tick = (now) => { if (live()) t += Math.min(34, now - last); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const sleep = (ms) => new Promise((res) => { const end = t + ms; const f = () => (t >= end ? res() : requestAnimationFrame(f)); f(); });
    const tween = (ms, fn) => new Promise((res) => {
      const start = t;
      const f = () => { const k = clamp((t - start) / ms, 0, 1); fn(easeInOut(k), k); k >= 1 ? res() : requestAnimationFrame(f); };
      f();
    });
    return { sleep, tween };
  }

  // ---- the carrier ---------------------------------------------------------------------

  class Carrier {
    constructor(stage, { size = 44, arrow = false } = {}) {
      this.stage = stage;
      this.root = document.createElement("div");
      this.root.className = "carry" + (arrow ? " has-arrow" : "");
      this.root.setAttribute("aria-hidden", "true");
      this.root.innerHTML = `<svg class="armsvg"><circle class="ripple" r="4"/><path class="arm-edge"/><path class="arm-fill"/><circle class="hand"/></svg><svg class="arrow" viewBox="0 0 16 22"><path d="M1 1v17l4.5-4.2 3 6.8 2.8-1.2-3-6.6H14z"/></svg>`;
      this.ghost = tpl.content.firstElementChild.cloneNode(true);
      this.root.append(this.ghost);
      stage.append(this.root);
      this.root.style.setProperty("--gw", size + "px");
      this.size = size;
      [this.ripple, this.edge, this.fill, this.hand] = [".ripple", ".arm-edge", ".arm-fill", ".hand"].map((s) => $(s, this.root));
      this.arrow = $(".arrow", this.root);
      this.eyes = $(".g-eyes", this.ghost);
      this.blinkG = $(".g-blink", this.ghost);
      this.hx = this.hy = 0; this.gx = this.gy = 0; this.vx = this.vy = 0;
      this.grip = 0; this.gripTo = 0; this.side = 1; this.blinkAt = performance.now() + 2000; this.lastT = performance.now();
      this.lookAt = null;
    }
    place(x, y) { this.hx = x; this.hy = y; this.gx = x + this.side * this.size * 1.05; this.gy = y - this.size * 0.95; }
    click() {
      this.ripple.animate([{ r: 3, opacity: 1 }, { r: 22, opacity: 0 }], { duration: 500, easing: "ease-out" });
      this.hand.animate([{ transform: "scale(1)" }, { transform: "scale(0.7)" }, { transform: "scale(1)" }], { duration: 260, transformOrigin: "center", transformBox: "fill-box" });
    }
    step(now) {
      const dt = Math.min(0.05, (now - this.lastT) / 1000); this.lastT = now;
      const w = this.stage.clientWidth;
      // Keep to the side with room.
      if (this.hx > w - this.size * 2.2) this.side = -1; else if (this.hx < this.size * 2.2) this.side = 1;
      const tx = this.hx + this.side * this.size * 1.05, ty = this.hy - this.size * 0.95;
      const K = 90, D = 11;
      this.vx += (K * (tx - this.gx) - D * this.vx) * dt; this.vy += (K * (ty - this.gy) - D * this.vy) * dt;
      this.gx += this.vx * dt; this.gy += this.vy * dt;
      this.grip = lerp(this.grip, this.gripTo, this.gripTo > this.grip ? 0.25 : 0.08);
      const gw = this.size, gh = this.size * 1.25;
      const lean = clamp(-this.vx * 0.04, -16, 16);
      this.ghost.style.transform = `translate(${(this.gx - gw / 2).toFixed(1)}px, ${(this.gy - gh / 2).toFixed(1)}px) rotate(${lean.toFixed(1)}deg)`;
      // Eyes on the hand (or whatever it looks at).
      const lx = this.lookAt ? this.lookAt.x : this.hx, ly = this.lookAt ? this.lookAt.y : this.hy;
      const a = Math.atan2(ly - this.gy, lx - this.gx), d = clamp(Math.hypot(lx - this.gx, ly - this.gy) / 60, 0, 1);
      this.eyes.setAttribute("transform", `translate(${(Math.cos(a) * 18 * d).toFixed(1)} ${(Math.sin(a) * 14 * d).toFixed(1)})`);
      if (now > this.blinkAt) { this.blinkAt = now + 2500 + Math.random() * 3000; this.blinkG.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0.1)" }, { transform: "scaleY(1)" }], { duration: 180 }); }
      // The arm, from the ghost's side to the hand: it sags, and straightens when pulled.
      const ax = this.gx - this.side * gw * 0.32, ay = this.gy + gh * 0.12;
      const span = Math.hypot(ax - this.hx, ay - this.hy);
      const sag = Math.max(0, 16 - span * 0.12) * (1 - this.grip * 0.6) + 5;
      const dpath = `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${((ax + this.hx) / 2).toFixed(1)} ${((ay + this.hy) / 2 + sag).toFixed(1)} ${this.hx.toFixed(1)} ${this.hy.toFixed(1)}`;
      const ew = Math.max(4, gw * 0.13);
      this.edge.setAttribute("d", dpath); this.edge.setAttribute("stroke-width", ew.toFixed(1));
      this.fill.setAttribute("d", dpath); this.fill.setAttribute("stroke-width", (ew - 2.2).toFixed(1));
      this.hand.setAttribute("cx", this.hx.toFixed(1)); this.hand.setAttribute("cy", this.hy.toFixed(1));
      this.hand.setAttribute("r", (Math.max(3, gw * 0.1) * (1 + this.grip * 0.2)).toFixed(1));
      this.ripple.setAttribute("cx", this.hx.toFixed(1)); this.ripple.setAttribute("cy", this.hy.toFixed(1));
      const op = this.grip.toFixed(3);
      this.edge.style.opacity = this.fill.style.opacity = this.hand.style.opacity = op;
      this.arrow.style.transform = `translate(${(this.hx - 1).toFixed(1)}px, ${(this.hy - 1).toFixed(1)}px)`;
    }
  }

  const carriers = [];
  const loop = (now) => { for (const c of carriers) if (c.live()) c.c.step(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const addCarrier = (stage, opts, live) => { const c = new Carrier(stage, opts); carriers.push({ c, live }); return c; };

  // Where a point inside an element is, in a stage's pixels.
  const within = (stage, el, fx = 0.5, fy = 0.5) => {
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - s.left + r.width * fx, y: r.top - s.top + r.height * fy };
  };

  // ---- the hero: "pull up a diagram of the heart and explain it" -------------------------------
  //
  // As the app does it (useAssistant.ts): find_picture puts a labelled diagram from Wikimedia
  // Commons on the screen like a sticker (sticker.html); explain_screen then has the app say an
  // intro, then each part with a loop round it and its name in a tag, arrows where blood flows
  // (pictureMarks.ts), then a wrap. The words are spoken, and captioned on the phone.

  // circlePath.ts, as it is.
  function smoothPath(points, closed = false) {
    const pts = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
    if (pts.length === 0) return "";
    const f = (n) => n.toFixed(1);
    if (pts.length < 3) return `M${f(pts[0][0])} ${f(pts[0][1])}` + pts.slice(1).map((p) => ` L${f(p[0])} ${f(p[1])}`).join("");
    const at = (i) => (closed ? pts[(i + pts.length) % pts.length] : pts[Math.max(0, Math.min(pts.length - 1, i))]);
    const last = closed ? pts.length : pts.length - 1;
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
    return closed ? `${d} Z` : d;
  }
  function arrowHead(points, length = 17, width = 18) {
    const [tx, ty] = points[points.length - 1];
    let from = points[points.length - 2] ?? [tx - 1, ty];
    for (let i = points.length - 2; i >= 0; i--) { from = points[i]; if (Math.hypot(tx - from[0], ty - from[1]) >= length) break; }
    const len = Math.hypot(tx - from[0], ty - from[1]) || 1;
    const [ux, uy] = [(tx - from[0]) / len, (ty - from[1]) / len];
    const [bx, by] = [tx - ux * length, ty - uy * length];
    const [px, py] = [-uy * (width / 2), ux * (width / 2)];
    const r = (v) => Math.round(v * 10) / 10;
    return `M${r(tx)},${r(ty)} L${r(bx + px)},${r(by + py)} L${r(bx - px)},${r(by - py)} Z`;
  }
  function shortened(points, by = 12) {
    if (points.length < 2) return points;
    const out = points.slice();
    const [tx, ty] = out[out.length - 1], [fx, fy] = out[out.length - 2];
    const len = Math.hypot(tx - fx, ty - fy);
    if (len <= by * 1.5) return out;
    out[out.length - 1] = [tx - ((tx - fx) / len) * by, ty - ((ty - fy) / len) * by];
    return out;
  }
  // pictureMarks.ts `shapesFor`, as it is.
  const tagWidth = (text) => text.length * 7.6 + 16;
  const inside = (tag, at) => {
    const half = tagWidth(tag.text) / 2;
    return { text: tag.text, x: Math.min(at.left + at.width - half - 2, Math.max(at.left + half + 2, tag.x)), y: Math.min(at.top + at.height - 13, Math.max(at.top + 13, tag.y)) };
  };
  const apart = (tag, placed, at) => {
    let { y } = tag;
    for (let tries = 0; tries < 12 && placed.some((t) => Math.abs(t.x - tag.x) < (tagWidth(t.text) + tagWidth(tag.text)) / 2 && Math.abs(t.y - y) < 24); tries++) {
      y = y + 26 < at.top + at.height - 13 ? y + 26 : y - 26;
    }
    return { ...tag, y };
  };
  function shapesFor(marks, at) {
    const px = (fx, fy) => [at.left + fx * at.width, at.top + fy * at.height];
    const tags = [], shapes = [];
    for (const item of marks.items.slice(0, 4)) {
      const [x0, y0] = px(item.x, item.y), [x1, y1] = px(item.x + item.w, item.y + item.h);
      const pad = Math.max(4, Math.min(10, Math.min(x1 - x0, y1 - y0) * 0.12));
      const round = (v) => Math.round(v * 10) / 10;
      const [l, t, r, b] = [round(x0 - pad), round(y0 - pad), round(x1 + pad), round(y1 + pad)];
      const radius = round(Math.min(14, (r - l) / 2, (b - t) / 2));
      const [lr, rr, tr, br] = [round(l + radius), round(r - radius), round(t + radius), round(b - radius)];
      const d = `M${lr},${t} H${rr} A${radius},${radius} 0 0 1 ${r},${tr} V${br} A${radius},${radius} 0 0 1 ${rr},${b} H${lr} A${radius},${radius} 0 0 1 ${l},${br} V${tr} A${radius},${radius} 0 0 1 ${lr},${t} Z`;
      let tag;
      if (item.label) {
        const above = t - 16 > at.top + 13;
        tag = apart(inside({ text: item.label, x: (l + r) / 2, y: above ? t - 16 : b + 16 }, at), tags, at);
        tags.push(tag);
      }
      shapes.push({ kind: "loop", d, tag });
    }
    for (const arrow of marks.arrows.slice(0, 4)) {
      const points = arrow.points.map(([x, y]) => px(x, y));
      if (points.length < 2) continue;
      let tag;
      if (arrow.label) {
        const [[sx, sy], [nx, ny]] = points;
        const len = Math.hypot(sx - nx, sy - ny) || 1;
        tag = apart(inside({ text: arrow.label, x: sx + ((sx - nx) / len) * 40, y: sy + ((sy - ny) / len) * 22 }, at), tags, at);
        tags.push(tag);
      }
      shapes.push({ kind: "arrow", d: smoothPath(shortened(points), false), head: arrowHead(points), tag });
    }
    return shapes;
  }

  (function heroTour() {
    const stage = $("#explain"), card = $("#stk"), pic = $("#stkPic"), layer = $("#stkMarks"), phoneEl = $("#heroPhone");
    if (!stage || !card || !pic || !layer) return;
    const phone = phoneEl && window.LMPhone ? window.LMPhone(phoneEl) : null;
    const w = watch(stage);
    const { sleep, tween } = director(w.live);
    const g = addCarrier(stage, { size: stage.clientWidth < 600 ? 30 : 40, arrow: true }, w.live);
    const el = (n, a) => { const e = document.createElementNS(SVGNS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

    // What the tour would give for this picture: the parts as the picture prints them, a box tight
    // round each part (not its label), arrows where blood comes in and goes out; the words as the
    // tour's instructions ask for them (show.ts `tourInstructions`, overview).
    const INTRO = "This is a diagram of the human heart, cut open from the front so you can see inside. It's a pump with four chambers that sends blood to your lungs, and then around your body.";
    const PARTS = [
      { items: [{ x: 0.35, y: 0.44, w: 0.14, h: 0.18, label: "Right atrium" }], arrows: [{ points: [[0.415, 0.25], [0.415, 0.36], [0.41, 0.5]], label: "Blood in" }],
        say: "This is the right atrium. Blood coming back from your body, low on oxygen, flows in through the superior vena cava and collects here before it drops into the chamber below." },
      { items: [{ x: 0.38, y: 0.6, w: 0.25, h: 0.22, label: "Right ventricle" }], arrows: [{ points: [[0.5, 0.72], [0.53, 0.52], [0.57, 0.36], [0.66, 0.3]], label: "To the lungs" }],
        say: "Below it is the right ventricle. When it squeezes, it pushes that blood up through the pulmonary artery to the lungs, to pick up fresh oxygen." },
      { items: [{ x: 0.63, y: 0.4, w: 0.09, h: 0.13, label: "Left atrium" }], arrows: [],
        say: "Blood full of oxygen comes back from the lungs through the pulmonary veins into the left atrium, then passes through the mitral valve into the chamber below." },
      { items: [{ x: 0.6, y: 0.5, w: 0.17, h: 0.36, label: "Left ventricle" }], arrows: [{ points: [[0.69, 0.74], [0.62, 0.52], [0.56, 0.32], [0.53, 0.1]], label: "Blood out" }],
        say: "This is the left ventricle, the strongest chamber, with the thickest wall. It pumps that fresh blood up through the aorta and out to the whole body." },
    ];
    const WRAP = "So blood goes from your body to the right side, out to the lungs, back to the left side, and out to your body again, with every beat.";

    let marks = null;
    const picRect = () => {
      const c = card.getBoundingClientRect(), r = pic.getBoundingClientRect();
      return { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height };
    };
    // sticker.ts `drawMarks`, drawn into the card.
    function drawMarks(animate) {
      layer.replaceChildren();
      layer.classList.toggle("drawing", animate);
      if (!marks) return;
      const at = picRect();
      if (at.width < 2) return;
      let delay = 0;
      for (const shape of shapesFor(marks, at)) {
        const gr = el("g", { class: shape.kind, style: `--delay:${delay}ms` });
        delay += shape.kind === "arrow" ? 900 : 180;
        const line = el("path", { class: "line", d: shape.d });
        gr.append(el("path", { class: "edge", d: shape.d }), line);
        if (shape.head) gr.append(el("path", { class: "flow", d: shape.d }), el("path", { class: "head-edge", d: shape.head }), el("path", { class: "head", d: shape.head }));
        layer.append(gr);
        if (shape.tag) {
          const tag = el("g", { class: "tag" });
          const text = el("text", { x: String(shape.tag.x), y: String(shape.tag.y) });
          text.textContent = shape.tag.text;
          const box = el("rect", { rx: "4", height: "22" });
          tag.append(box, text);
          gr.append(tag);
          const tw = text.getComputedTextLength() + 16;
          box.setAttribute("x", String(shape.tag.x - tw / 2));
          box.setAttribute("y", String(shape.tag.y - 11));
          box.setAttribute("width", String(tw));
        }
        gr.style.setProperty("--len", String(Math.ceil(line.getTotalLength())));
      }
    }
    new ResizeObserver(() => drawMarks(false)).observe(card);

    // The ghost by the pointer, resting beside the picture; its eyes go to what is being said.
    const rest = () => {
      const c = within(stage, card, 1, 0.62);
      return { x: Math.min(stage.clientWidth - 70, c.x + 46), y: c.y };
    };
    const lookAtMarks = () => {
      if (!marks || !marks.items[0]) { g.lookAt = null; return; }
      const it = marks.items[0], at = picRect(), c = within(stage, card, 0, 0);
      g.lookAt = { x: c.x + at.left + (it.x + it.w / 2) * at.width, y: c.y + at.top + (it.y + it.h / 2) * at.height };
    };
    const say = async (text) => {
      if (!phone) return sleep(text.split(" ").length * 300);
      phone.setVoice("speaking");
      const words = text.split(" ");
      for (let i = 1; i <= words.length; i++) {
        phone.reply(words.slice(0, i).join(" "));
        const last = words[i - 1];
        await sleep(230 + last.length * 18 + (/[.,]$/.test(last) ? 220 : 0));
      }
    };
    const moveHand = async (to, ms) => {
      const f = { x: g.hx, y: g.hy };
      await tween(ms, (k) => { g.hx = lerp(f.x, to.x, k); g.hy = lerp(f.y, to.y, k); });
    };
    // The ghost pulls the picture in from the side by its title bar, and lets go.
    async function pull() {
      const W = stage.clientWidth;
      card.style.transition = "none";
      card.style.transform = `translateX(${W}px)`;
      card.classList.add("on");
      const at = within(stage, card, 0, 0);
      const finalX = at.x - W, grabY = at.y + 18;
      g.place(W + 40, grabY);
      g.gripTo = 1;
      await sleep(200);
      await tween(1500, (k) => {
        const x = lerp(W + 40, finalX + 60, k);
        g.hx = x; g.hy = grabY;
        card.style.transform = `translateX(${(x - 60 - finalX).toFixed(1)}px)`;
      });
      card.style.transform = "";
      await sleep(150);
      g.gripTo = 0;
      await moveHand(rest(), 700);
      card.style.transition = "";
    }
    const P = phone || { setVoice() {}, you() {}, act: () => ({ set() {} }), reply() {}, busy() {}, clear() {} };

    function still() {
      card.classList.add("on");
      marks = { items: PARTS.flatMap((p) => p.items), arrows: [] };
      drawMarks(false);
      P.clear(); P.you("Pull up a diagram of the heart and explain it"); P.act("Did", "Finding a picture of human heart diagram"); P.act("Did", "Explaining the heart"); P.reply(WRAP); P.setVoice("listening");
      const r = rest(); g.place(r.x, r.y);
    }
    if (reduced.matches) { requestAnimationFrame(still); return; }

    async function run() {
      for (;;) {
        card.style.transition = "none"; card.classList.remove("on"); card.style.transform = ""; marks = null; drawMarks(false); g.lookAt = null;
        const r0 = rest(); g.place(r0.x, r0.y); g.gripTo = 0;
        P.clear();
        P.you("Pull up a diagram of the heart and explain it");
        P.setVoice("thinking"); P.busy(true);
        await sleep(500);
        const find = P.act("Doing", "Finding a picture of human heart diagram");
        await sleep(700);
        await pull();
        find.set("Did", "Finding a picture of human heart diagram");
        const ex = P.act("Doing", "Explaining the heart");
        await sleep(600);
        ex.set("Did", "Explaining the heart");
        await say(INTRO);
        for (const part of PARTS) {
          marks = { items: part.items, arrows: part.arrows };
          drawMarks(true);
          lookAtMarks();
          await sleep(300);
          await say(part.say);
          await sleep(500);
        }
        marks = null; drawMarks(false); g.lookAt = null;
        await say(WRAP);
        P.busy(false); P.setVoice("listening");
        await sleep(5000);
      }
    }
    // Start once the page has loaded, the picture is decoded and the browser is idle, so the first
    // pull is not fighting the page's own start-up for frames.
    const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise((res) => addEventListener("load", res, { once: true }));
    const decoded = pic.decode ? pic.decode().catch(() => {}) : Promise.resolve();
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const idle = () => new Promise((res) => ("requestIdleCallback" in window ? requestIdleCallback(() => res(), { timeout: 700 }) : setTimeout(res, 300)));
    Promise.all([loaded, decoded, fonts]).then(idle).then(() => requestAnimationFrame(() => run()));
  })();

  // ---- the trackpad demo: the ghost carries the demo's cursor -----------------------------------

  (function rigGhost() {
    const screen = $("#screen"), cursor = $("#cursor");
    if (!screen || !cursor) return;
    const w = watch(screen);
    const g = addCarrier(screen, { size: 30 }, w.live);
    let px = null, py = null, still = 0;
    const follow = () => {
      const p = within(screen, cursor, 0, 0);
      if (px !== null) {
        const moved = Math.hypot(p.x - px, p.y - py);
        still = moved > 0.4 ? 0 : still + 1;
        g.gripTo = still < 20 ? 1 : 0;
      } else g.place(p.x + 1, p.y + 1);
      px = p.x; py = p.y;
      g.hx = p.x + 3; g.hy = p.y + 5;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  })();

  // ---- takes over: change the wallpaper, click by click ---------------------------------------------

  (function takeover() {
    const stage = $("#takeover-stage");
    if (!stage) return;
    const win = $("#toWin"), icon = $("#toSettingsIcon"), item = $("#toWpItem"), grid = $("#toGrid"), valley = $("#toValley");
    const head = $("#toHead"), next = $("#toNext"), askB = $("#toAsk"), done = $("#toDone"), close = $("[data-close]", win);
    const steps = $$("#toSteps li");
    const w = watch(stage);
    const { sleep, tween } = director(w.live);
    const g = addCarrier(stage, { size: 36, arrow: true }, w.live);
    const mark = (i) => steps.forEach((li, j) => { li.classList.toggle("done", j < i); li.classList.toggle("now", j === i); });
    const moveTo = async (el, fx = 0.5, fy = 0.5, ms = 800) => {
      const t = within(stage, el, fx, fy), f = { x: g.hx, y: g.hy };
      await tween(ms, (k) => { g.hx = lerp(f.x, t.x, k); g.hy = lerp(f.y, t.y, k); });
    };
    const reset = () => {
      win.classList.remove("open"); grid.classList.remove("on"); item.classList.remove("sel"); head.textContent = "General";
      $$(".wp", grid).forEach((x, i) => x.classList.toggle("now", i === 0));
      next.classList.remove("on"); askB.classList.remove("on"); done.classList.remove("on"); mark(-1);
    };
    function stillFrame() {
      win.classList.add("open"); grid.classList.add("on"); item.classList.add("sel"); head.textContent = "Wallpaper";
      $$(".wp", grid).forEach((x) => x.classList.toggle("now", x === valley));
      next.classList.add("on"); done.classList.add("on"); mark(4);
      const p = within(stage, valley); g.place(p.x, p.y); g.gripTo = 0;
    }
    if (reduced.matches) { requestAnimationFrame(stillFrame); return; }
    async function run() {
      for (;;) {
        reset();
        const W = stage.clientWidth, H = stage.clientHeight;
        g.place(W * 0.55, H * 0.55); g.gripTo = 0;
        await sleep(700);
        askB.classList.add("on");
        await sleep(1500);
        askB.classList.remove("on");
        g.gripTo = 1; mark(0);
        await moveTo(icon, 0.5, 0.45, 1000);
        g.click(); icon.classList.remove("hop"); void icon.offsetWidth; icon.classList.add("hop");
        await sleep(450);
        win.classList.add("open");
        await sleep(700); mark(1);
        await moveTo(item, 0.4, 0.5, 900);
        g.click(); item.classList.add("sel"); head.textContent = "Wallpaper"; grid.classList.add("on");
        await sleep(700); mark(2);
        await moveTo(valley, 0.5, 0.5, 800);
        g.click();
        $$(".wp", grid).forEach((x) => x.classList.toggle("now", x === valley));
        next.classList.add("on");
        await sleep(900); mark(3);
        g.gripTo = 0;
        done.classList.add("on");
        await sleep(1400); mark(4);
        await sleep(1800);
        // Tidy up for the next round: close the window, put the lake back.
        g.gripTo = 1;
        await moveTo(close, 0.5, 0.5, 900);
        g.click(); win.classList.remove("open"); done.classList.remove("on");
        await sleep(500); g.gripTo = 0;
        next.classList.remove("on");
        await sleep(1200);
      }
    }
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(run));
  })();

  // ---- the footer word: every ghost leans and looks at the cursor -------------------------------------

  (function ghostWord() {
    const word = $("#ghostWord");
    if (!word || !tpl) return;
    const cells = $$("i", word);
    const ghosts = cells.map((c) => {
      const s = tpl.content.firstElementChild.cloneNode(true);
      s.setAttribute("class", "ghost-svg");
      c.append(s);
      return { el: s, eyes: $(".g-eyes", s), cx: 0, cy: 0, lean: 0, ex: 0, ey: 0 };
    });
    const w = watch(word);
    let mx = null, my = null, raf = 0;
    const measure = () => ghosts.forEach((g) => { const r = g.el.getBoundingClientRect(); g.cx = r.left + r.width / 2; g.cy = r.top + r.height / 2; });
    const frame = (now) => {
      raf = 0;
      measure();
      let moving = false;
      const idle = mx === null;
      for (const g of ghosts) {
        let tx, ty;
        if (idle) { const k = Math.sin(now / 900 + g.cx / 160); tx = g.cx + k * 120; ty = g.cy - 40; }
        else { tx = mx; ty = my; }
        const dx = tx - g.cx, dy = ty - g.cy, d = Math.hypot(dx, dy) || 1;
        const leanTo = clamp(dx / 9, -24, 24) * clamp(600 / (d + 240), 0.6, 1);
        const exTo = (dx / d) * 18 * clamp(d / 80, 0, 1), eyTo = (dy / d) * 14 * clamp(d / 80, 0, 1);
        g.lean = lerp(g.lean, leanTo, 0.18); g.ex = lerp(g.ex, exTo, 0.25); g.ey = lerp(g.ey, eyTo, 0.25);
        if (Math.abs(g.lean - leanTo) > 0.05 || Math.abs(g.ex - exTo) > 0.05) moving = true;
        g.el.style.transform = `translateX(${(g.lean * 0.12).toFixed(2)}px) rotate(${g.lean.toFixed(2)}deg)`;
        g.eyes.setAttribute("transform", `translate(${g.ex.toFixed(1)} ${g.ey.toFixed(1)})`);
      }
      if (w.live() && !reduced.matches && (moving || idle)) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && !reduced.matches) raf = requestAnimationFrame(frame); };
    addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; mx = e.clientX; my = e.clientY; kick(); }, { passive: true });
    addEventListener("scroll", kick, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { if (e.isIntersecting) kick(); }).observe(word);
    document.addEventListener("visibilitychange", kick);
  })();

  // ---- the remote scene's packets are SMIL; stop them under reduced motion -------------------------------

  const link = $(".rs-link");
  const motion = () => { if (link && link.pauseAnimations) reduced.matches ? link.pauseAnimations() : link.unpauseAnimations(); };
  motion();
  reduced.addEventListener("change", motion);
})();
