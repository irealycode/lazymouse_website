/* The phone's Ask tab, as AssistantPanel.tsx draws it now (the Focus view): the talking ghost in
 * the middle with its rings and dots (TalkingGhost.tsx, ghostMotion.ts), the state word, and the
 * captions of where the conversation is (captions.ts): what you said, the last two things done, and
 * the latest reply. The dock is Mute, Stop (only while there is something to stop), Type and End.
 *
 * Shared by the hero and the Audacity scene. Plain JS. `LMPhone(root)` returns the controls.
 */
(() => {
  "use strict";
  const WORDS = { idle: "", connecting: "Connecting", listening: "Listening", thinking: "Thinking", speaking: "Speaking" };
  /** The end of a long reply, as the app shows it while it speaks (captions.ts `tail`). */
  const tail = (text, max) => {
    if (text.length <= max) return text;
    const cut = text.slice(text.length - max);
    const space = cut.indexOf(" ");
    return "…" + (space > 0 && space < 24 ? cut.slice(space + 1) : cut);
  };
  window.LMPhone = function LMPhone(root) {
    const $ = (s) => root.querySelector(s);
    const ghost = $(".ap-ghost"), word = $(".ap-word"), you = $(".ap-you"), acts = $(".ap-acts"), reply = $(".ap-reply");
    const hint = $(".ap-hint"), stop = $(".ap-stop");
    const api = {
      voice: "idle",
      setVoice(v) {
        api.voice = v;
        ghost.dataset.v = v;
        word.textContent = WORDS[v] || "";
        word.hidden = !WORDS[v];
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
        reply.textContent = tail(text || "", 170);
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
