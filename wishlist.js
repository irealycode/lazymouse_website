/* The wishlist form, one question at a time. Answering a question slides it away and brings in
   the next; the ghost walks the line above to show how far along you are. A single-choice
   question moves on by itself; a pick-any question waits for Next. The last question brings in
   the button. It posts to Formspree (config.js `wishlist`); several picks in one question are
   sent as one line, "Windows, Linux". */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const links = window.LAZYMOUSE_LINKS || {};
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const form = $("#wishlist"), status = $("#wlStatus"), done = $("#wlDone"), submit = $(".wl-submit", form);
  const email = form.elements.email, back = $("#wlBack"), track = $("#wlTrack"), count = $("#wlCount");
  const holder = $("#wlSteps"), steps = $$(".wl-q", holder), dots = $$(".wl-dot", track);
  const label = submit.innerHTML;
  let at = 0, moving = false;

  // The walker is the nav's own ghost.
  const ghost = $(".strip .brand-ghost")?.cloneNode(true);
  if (ghost) { ghost.removeAttribute("class"); ghost.classList.add("ghost-svg", "brand-ghost"); $(".wl-walker", track).append(ghost); }
  const eyes = () => $(".wl-walker .g-eyes", track);

  const validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  const showEmailError = (bad) => { email.setAttribute("aria-invalid", String(bad)); $("#err-email").hidden = !bad; };
  const answered = (step) => step.dataset.step === "email" ? validEmail() : !!$("input:checked", step);

  // The line: filled up to the questions answered so far; the ghost stands at the end of the fill.
  function progress(walk, dir = 1) {
    const doneCount = steps.filter((s, i) => i < at || (i === at && s.dataset.last !== undefined && answered(s))).length;
    const p = doneCount / steps.length;
    track.style.setProperty("--p", p);
    track.setAttribute("aria-valuenow", String(doneCount));
    dots.forEach((d, i) => d.classList.toggle("on", i <= doneCount));
    count.textContent = `${at + 1} of ${steps.length}`;
    back.hidden = at === 0;
    eyes()?.setAttribute("transform", `translate(${dir * 9} 0)`);
    if (walk && !reduced.matches) {
      track.classList.remove("walking"); void track.offsetWidth; track.classList.add("walking");
      clearTimeout(progress.t); progress.t = setTimeout(() => track.classList.remove("walking"), 720);
    }
  }

  // Slide from the current question to question `to`: the old one leaves, the sheet eases to the
  // new one's height, the new one arrives from the side it is on.
  function go(to) {
    if (moving || to === at || to < 0 || to >= steps.length) return;
    const from = steps[at], next = steps[to], dir = to > at ? 1 : -1;
    if (reduced.matches) {
      from.hidden = true; next.hidden = false; at = to; progress(false, dir); focusIn(next); return;
    }
    moving = true;
    const h0 = holder.offsetHeight;
    from.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-48 * dir}px)` }], { duration: 220, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" })
      .finished.then(() => {
        from.hidden = true; from.getAnimations().forEach((a) => a.cancel());
        next.hidden = false; at = to; progress(true, dir);
        const h1 = holder.offsetHeight;
        holder.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 320, easing: "cubic-bezier(.22,1,.36,1)" });
        next.animate([{ opacity: 0, transform: `translateX(${48 * dir}px)` }, { opacity: 1, transform: "none" }], { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" })
          .finished.then(() => { moving = false; });
        focusIn(next);
      });
  }
  function focusIn(step) {
    const target = step.dataset.step === "email" ? email : $("input:checked", step) || $("input", step);
    target?.focus({ preventScroll: true });
  }

  function advance() {
    const step = steps[at];
    if (step.dataset.step === "email") {
      emailTried = true;
      if (!validEmail()) { showEmailError(true); email.focus(); return; }
      showEmailError(false);
    }
    if (!answered(step)) return;
    go(at + 1);
  }

  let emailTried = false;
  email.addEventListener("input", () => emailTried && showEmailError(!validEmail()));
  [email, form.elements.name].forEach((f) => f.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); advance(); }
  }));
  $$("[data-next]", form).forEach((b) => b.addEventListener("click", advance));
  back.addEventListener("click", () => go(at - 1));

  // A pick marks the question answered (its Next, or on the last one the button, comes in).
  // A single choice moves on by itself, after a beat to see it ticked.
  steps.forEach((step) => step.addEventListener("change", () => {
    const yes = answered(step);
    step.classList.toggle("answered", yes);
    if (step.dataset.last !== undefined) { progress(yes && !step.dataset.walked, 1); step.dataset.walked = yes ? "1" : ""; return; }
    if (yes && step.dataset.multi === undefined) setTimeout(() => { if (steps[at] === step) advance(); }, 380);
  }));

  progress(false);

  function say(html) { status.innerHTML = html; status.hidden = false; }
  const fallback = () => {
    const to = links.support;
    return to ? ` You can also email us at <a href="mailto:${to}?subject=${encodeURIComponent("LazyMouse wishlist")}">${to}</a>.` : "";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.hidden = true;
    if (!validEmail()) { go(0); return; }
    if (!links.wishlist) return say("The wishlist isn’t open just yet." + fallback());

    // One field per question; several picks joined.
    const data = new FormData(), raw = new FormData(form);
    for (const key of new Set(raw.keys())) data.append(key, raw.getAll(key).map((v) => String(v).trim()).filter(Boolean).join(", "));

    submit.disabled = true;
    submit.innerHTML = '<span class="wl-spin" aria-hidden="true"></span><span>Sending…</span>';
    try {
      const res = await fetch(links.wishlist, { method: "POST", body: data, headers: { Accept: "application/json" } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.errors?.map((x) => x.message).join(" ") || "");
      }
      const name = form.elements.name.value.trim();
      $("#wlDoneName").textContent = name ? `, ${name}` : "";
      form.hidden = true; done.hidden = false; done.focus();
      back.hidden = true; count.textContent = "Done";
      track.classList.add("cheer");
    } catch (err) {
      say((err.message ? `That didn’t go through: ${err.message}` : "That didn’t go through. Check your connection and try again.") + fallback());
    } finally {
      submit.disabled = false; submit.innerHTML = label;
    }
  });
})();
