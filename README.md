# LazyMouse — website

The marketing site at lazymouse.sovereignco.net. Plain HTML, CSS and JavaScript: no build step,
no dependencies. Serve the folder with any static server (`python -m http.server`).

```
index.html       the page: hero → deep search → explanations → drawings → notch and notes → jobs → remote
wishlist.html    the invite wishlist, one question at a time (wishlist.css, wishlist.js)
config.js        download links, the support address and the Formspree endpoint for the wishlist
styles.css, new.css, refined.css, notch.css, light.css
                 the page's styles, in load order; light.css holds the latest changes
main.js, more.js, refined.js, notch.js, phone.js, v1-drag.js, veil.js
                 the demos and interactions
demos/           local fonts (subset WOFF2) and the working ghost's animation
shots/           renders of the real app windows (WebP)
assets/          logo, wallpapers, phone renders
privacy.html, support.html, legal.js, legal.css
                 the legal pages, in the previous site's look
CNAME            the custom domain for GitHub Pages
```

## The wishlist

The form posts to Formspree. Put the form's endpoint in `config.js`:

```js
wishlist: "https://formspree.io/f/your-id",
```

Until it is set, sending says the wishlist isn't open yet and offers the support address.

## Lightweight demonstrations

The page uses no application iframes, Three.js, WebGL, model calls or native APIs.

- Research tabs swap compressed WebP renders of the real research window. Additional views load only on selection.
- Notes reuse the real app's paper texture, curl, tape, typography and drawn checklist paths, with hover/focus previews and local checklist toggles.
- Jobs use small HTML state changes and sample tasks. The working ghost keeps the app's own CSS animation sequences.
- The remote phone uses the real trackpad image. `v1-drag.js` keeps the timestamped input replay, sample interpolation and spring-driven ghost carrier. It runs only while the section is visible.
- The screen tour starts only on arrival and pauses when off screen.
- Loops pause off screen and in a hidden tab, there is a visible **Pause motion** control, and under `prefers-reduced-motion` nothing loops.

Demos use sample data.
