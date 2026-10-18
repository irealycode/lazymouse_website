/* The small amount of script the privacy and support pages need: where to write to.
 * The address lives in config.js (`support`), the one file edited at launch; until
 * it is set the pages say so rather than showing a dead link.
 */
(() => {
  const links = window.LAZYMOUSE_LINKS || {};
  if (!links.support) return;
  document.querySelectorAll("[data-contact]").forEach((el) => {
    const a = document.createElement("a");
    a.href = `mailto:${links.support}`;
    a.textContent = links.support;
    el.textContent = "Write to ";
    el.append(a, ".");
  });
})();
