(() => {"use strict";const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=false;const still=()=>reduced.matches||paused;const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));const live=()=>{};function whenVisible(el,fn){new IntersectionObserver(([e])=>fn(e.isIntersecting)).observe(el);}document.addEventListener('site-motion',e=>{paused=e.detail;runRig();});
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

const tpl=$('#ghostTpl');const lerp=(a,b,t)=>a+(b-a)*t;  class Carrier {
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


const carrier=new Carrier(screen,{size:30});new ResizeObserver(()=>{carrier.size=Math.max(14,Math.min(30,screen.clientWidth*.04));carrier.root.style.setProperty('--gw',carrier.size+'px');}).observe(screen);carrier.place(screen.clientWidth*.5,screen.clientHeight*.5);let active=false,carried=0,previous={x:0,y:0},quiet=0;
function carryFrame(now){carried=0;if(!active||document.hidden)return;const p=cursor.getBoundingClientRect(),r=screen.getBoundingClientRect();const x=p.left-r.left,y=p.top-r.top;quiet=Math.hypot(x-previous.x,y-previous.y)>.4?0:quiet+1;previous={x,y};carrier.hx=x+3;carrier.hy=y+5;carrier.gripTo=quiet<20?1:0;carrier.step(now);if(!still())carried=requestAnimationFrame(carryFrame);}
new IntersectionObserver(([e])=>{active=e.isIntersecting;if(active&&!carried){carrier.lastT=performance.now();carried=requestAnimationFrame(carryFrame)}}).observe(screen);
document.addEventListener('visibilitychange',()=>{if(active&&!carried&&!document.hidden)carried=requestAnimationFrame(carryFrame)});document.addEventListener('site-motion',()=>{if(active&&!carried)carried=requestAnimationFrame(carryFrame)});
})();