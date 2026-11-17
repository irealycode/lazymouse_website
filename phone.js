/* The phone's Ask tab, as the app draws it now (mobile/src/components/AssistantPanel.tsx, HoldToTalk.tsx,
 * StatusStrip.tsx, Toolbar.tsx; colours from theme.ts, light scheme with the dark dock): the orange
 * connection pill, "Just ask.", the ghost with its state word (TalkingGhost.tsx: a voice ribbon while it
 * listens, dots while it thinks, rings while it speaks), the captions of where the conversation is, and
 * the dock with Hold to talk, Type and End above the four tabs.
 *
 * Shared by the hero and the Audacity scene: `LMPhone(root)` draws the phone into `root` and returns
 * its controls. Plain JS.
 */
(() => {
  "use strict";
  const WORDS = { idle: "Ready", connecting: "Connecting", listening: "Listening", thinking: "Thinking", speaking: "Speaking" };
  const BODY = "M78.76 0.14C78.76 2.72 78.76 5.28 78.76 7.9C78.76 10.51 78.76 13.12 78.76 15.81C78.76 18.5 78.76 21.21 78.76 24.04C78.76 26.87 78.76 29.74 78.76 32.78C78.76 35.81 78.76 38.92 78.76 42.26C78.76 45.59 78.76 49.03 78.76 52.79C78.76 56.55 79.67 61.36 78.76 64.81C77.85 68.25 76.44 72.07 73.3 73.45C70.16 74.84 63.05 71.75 59.91 73.11C56.78 74.47 56.28 78.48 54.48 81.61C52.67 84.73 51.44 89.25 49.08 91.84C46.71 94.44 43.55 96.34 40.29 97.19C37.02 98.03 33.2 98.18 29.48 96.9C25.76 95.63 21.38 90.96 17.95 89.56C14.52 88.16 11.85 88.34 8.9 88.51C5.95 88.69 3.24 89.34 0.22 90.59C-2.79 91.84 -5.84 94.21 -9.19 96.01C-12.53 97.82 -16.39 100.74 -19.85 101.42C-23.32 102.11 -26.9 101.37 -30 100.12C-33.11 98.86 -35.91 96.26 -38.47 93.88C-41.04 91.49 -43.05 88.2 -45.4 85.79C-47.75 83.38 -49.17 80.24 -52.57 79.42C-55.97 78.6 -62.11 81.54 -65.8 80.86C-69.49 80.18 -72.66 78.03 -74.73 75.34C-76.8 72.65 -77.62 68.49 -78.22 64.73C-78.82 60.97 -78.3 56.53 -78.31 52.79C-78.33 49.04 -78.31 45.59 -78.31 42.26C-78.31 38.92 -78.31 35.81 -78.31 32.78C-78.31 29.74 -78.31 26.87 -78.31 24.04C-78.31 21.21 -78.31 18.5 -78.31 15.81C-78.31 13.12 -78.31 10.51 -78.31 7.9C-78.31 5.28 -78.31 2.72 -78.31 0.14C-78.31 -2.45 -78.35 -5.02 -78.31 -7.63C-78.26 -10.23 -78.21 -12.85 -78.04 -15.49C-77.87 -18.12 -77.62 -20.78 -77.27 -23.45C-76.92 -26.12 -76.47 -28.81 -75.92 -31.51C-75.38 -34.22 -74.8 -36.97 -74.01 -39.68C-73.21 -42.38 -72.19 -45.01 -71.17 -47.73C-70.16 -50.45 -69.2 -53.3 -67.92 -55.98C-66.64 -58.65 -65.1 -61.24 -63.47 -63.78C-61.84 -66.32 -60.06 -68.82 -58.14 -71.22C-56.21 -73.62 -54.15 -75.98 -51.93 -78.18C-49.71 -80.39 -47.36 -82.57 -44.83 -84.45C-42.3 -86.32 -39.54 -87.92 -36.74 -89.42C-33.95 -90.91 -31.03 -92.26 -28.06 -93.41C-25.08 -94.56 -22 -95.53 -18.9 -96.31C-15.79 -97.1 -12.61 -97.71 -9.42 -98.13C-6.23 -98.56 -2.99 -98.9 0.22 -98.87C3.44 -98.84 6.66 -98.36 9.85 -97.93C13.04 -97.5 16.24 -97.06 19.34 -96.29C22.44 -95.51 25.52 -94.48 28.46 -93.25C31.4 -92.02 34.22 -90.46 36.98 -88.91C39.74 -87.35 42.53 -85.85 45.02 -83.95C47.51 -82.05 49.73 -79.7 51.92 -77.49C54.11 -75.29 56.24 -73.06 58.15 -70.69C60.07 -68.32 61.83 -65.82 63.44 -63.29C65.04 -60.76 66.45 -58.11 67.77 -55.49C69.1 -52.87 70.35 -50.25 71.39 -47.58C72.44 -44.91 73.26 -42.15 74.04 -39.45C74.82 -36.75 75.5 -34.07 76.07 -31.39C76.65 -28.71 77.14 -26.04 77.48 -23.38C77.82 -20.72 77.9 -18.04 78.11 -15.41C78.32 -12.78 78.63 -10.21 78.74 -7.62C78.85 -5.03 78.76 -2.45 78.76 0.14Z";
  const EYE = "M-10.5 -11.5A10.5 10.5 0 0 1 0 -22L0 -22A10.5 10.5 0 0 1 10.5 -11.5L10.5 11.5A10.5 10.5 0 0 1 0 22L0 22A10.5 10.5 0 0 1 -10.5 11.5Z";
  const ghost = (cls) => `<svg class="${cls}" viewBox="-86 -106 172 215"><path class="gb" d="${BODY}"/><g class="ge"><path d="${EYE}" transform="matrix(0.96 -0.08 0.05 0.99 -21.39 -9.01)"/><path d="${EYE}" transform="matrix(0.96 -0.01 0.05 0.99 23.94 -11.23)"/></g></svg>`;
  const SLIDERS = '<svg viewBox="0 0 24 24"><path d="M4 8h16M4 16h16"/><circle cx="14.5" cy="8" r="2.2" class="knob"/><circle cx="9.5" cy="16" r="2.2" class="knob"/></svg>';
  const MIC = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>';
  const KEYS = '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M6.5 10h1M10 10h1M13.5 10h1M17 10h.5M7 14h10"/></svg>';
  const TEMPLATE = `
  <div class="ap-status"><b>15:31</b><span class="ap-icons"><svg class="ic-sig" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg class="ic-wifi" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM2.9 6.3a7.2 7.2 0 0 1 10.2 0l-1.4 1.4a5.2 5.2 0 0 0-7.4 0zM.2 3.6a11 11 0 0 1 15.6 0l-1.4 1.4a9 9 0 0 0-12.8 0z"/></svg><svg class="ic-bat" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke-opacity=".45"/><rect x="2" y="2" width="17" height="9" rx="2"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" opacity=".45"/></svg></span></div>
  <div class="ap-strip"><span class="ap-pill"><i></i>Connected · This computer</span><span class="ap-opt">${SLIDERS}</span></div>
  <div class="ap-head"><b class="ap-title">Just ask.</b><p>A little help with your computer.</p>
    <div class="ap-chips"><span>Jobs</span><span>Notes &amp; routines</span><span class="ic">${SLIDERS}</span></div></div>
  <div class="ap-focus">
    <div class="ap-ghost" data-v="idle"><i class="ring o" style="--i:0"></i><i class="ring o" style="--i:1"></i><i class="ring o" style="--i:2"></i>${ghost("ap-big")}<span class="dots"><i></i><i></i><i></i></span><span class="ribbon">${"<i></i>".repeat(9)}</span></div>
    <p class="ap-word"></p>
    <div class="ap-caps">
      <p class="ap-hint">Say what you want done: “Play Blinding Lights”, “Open YouTube”.</p>
      <p class="ap-you" hidden></p>
      <div class="ap-acts"></div>
      <p class="ap-reply" hidden></p>
    </div>
    <p class="ap-all"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg><span>Whole conversation</span></p>
  </div>
  <div class="ap-dock">
    <div class="ap-hold">${MIC}<b class="ap-hold-label">Hold to talk</b></div>
    <p class="ap-dockhint">Mic off until you hold · release to send</p>
    <div class="ap-row"><span class="ap-type">${KEYS}<b>Type</b></span><span class="ap-stop"><svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5" class="fill"/></svg><b>Stop</b></span><span class="ap-end"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg><b>End</b></span></div>
  </div>
  <div class="ap-tabs"><span>${KEYS}<b>Keyboard</b></span><span><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/></svg><b>Screen</b></span><span><svg viewBox="0 0 24 24"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg><b>Files</b></span><span class="on"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H11l-5 4v-4H4z"/></svg><b>Ask</b></span></div>
  <i class="ap-home"></i>`;

  /** The end of a long reply, as the app shows it while it speaks (captions.ts `tail`). */
  const tail = (text, max) => {
    if (text.length <= max) return text;
    const cut = text.slice(text.length - max);
    const space = cut.indexOf(" ");
    return "…" + (space > 0 && space < 24 ? cut.slice(space + 1) : cut);
  };
  window.LMPhone = function LMPhone(root) {
    root.innerHTML = TEMPLATE;
    const $ = (s) => root.querySelector(s);
    const ghostEl = $(".ap-ghost"), word = $(".ap-word"), you = $(".ap-you"), acts = $(".ap-acts"), reply = $(".ap-reply");
    const hint = $(".ap-hint"), stop = $(".ap-stop"), holdLabel = $(".ap-hold-label"), dockHint = $(".ap-dockhint");
    const api = {
      voice: "idle",
      setVoice(v) {
        api.voice = v;
        ghostEl.dataset.v = v;
        root.dataset.v = v;
        word.textContent = WORDS[v] || "";
        // Holding the pill is listening: the pill turns orange and says what letting go does.
        const held = v === "listening";
        holdLabel.textContent = held ? "Release to send" : "Hold to talk";
        dockHint.textContent = held ? "Slide left to cancel" : "Mic off until you hold · release to send";
      },
      busy(on) { stop.classList.toggle("on", !!on); },
      you(text) {
        hint.hidden = true;
        you.hidden = !text;
        you.textContent = text ? `“${text}”` : "";
      },
      /** A row of what was done ("Doing" while it runs, then "Did"); the last two stay. */
      act(kind, text) {
        hint.hidden = true;
        const row = document.createElement("p");
        row.className = "ap-act";
        row.innerHTML = "<b></b><span></span>";
        const set = (k, t) => { row.firstChild.textContent = k; row.lastChild.textContent = t; };
        set(kind, text);
        acts.append(row);
        while (acts.children.length > 2) acts.firstChild.remove();
        return { set };
      },
      reply(text) {
        reply.hidden = !text;
        reply.textContent = tail(text || "", 150);
      },
      clear() {
        you.hidden = true; you.textContent = "";
        acts.replaceChildren();
        reply.hidden = true; reply.textContent = "";
        hint.hidden = false;
        api.busy(false);
        api.setVoice("idle");
      },
    };
    api.clear();
    return api;
  };
})();
