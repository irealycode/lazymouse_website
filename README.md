# LazyMouse — website

The marketing page. Plain HTML, CSS and JavaScript: no build step, no
dependencies. Open `index.html` in a browser, or serve the folder with anything
(`npx serve website`).

```
index.html      the page
styles.css      tokens and layout (the same paper / ink / vermilion as the apps)
main.js         every demo and reveal
config.js       the two download links (empty until they exist)
assets/         logo.svg (from desktop/scripts/make-icon.mjs), two renders of the phone app
```

Add `?theme=light` to force the light scheme; the page otherwise follows the
system.

## What is on it, and why

Each demo answers a question rather than decorating:

- **The hero rig** samples a finger path at 60 Hz, stamps each sample, sends it
  across a simulated link and plays it back the way the desktop's `motion.rs`
  does. `Replayed` against `On arrival` and `Clean` against `Jittery Wi-Fi` show
  the smoothness claim instead of asserting it. The top strip's fill is the
  demo's link state, as in the desktop app.
- **Gestures** loop the five gestures and print the real protocol messages each
  one sends.
- **Ask** is the desktop with Audacity open and LazyMouse running, and the phone's Ask tab beside it, one scene that plays once when it is mostly on screen (Replay plays it again). The ghost is a port of the desktop app's own (`desktop/src/buddy.ts`, `src-tauri/src/buddy.rs`, `frame.ts`): the arc and timing of its flights, its spring, the ring, arm and label when it points, the barrier it grows into when it frames something big, the eyes and the blink. The phone is `AssistantPanel.tsx`: the rows, the band, the ruler of 36 ticks. The explanation is the app's own tour: for each part the ghost is sent there and the voice says just that part. Under reduced motion it shows one still frame.
- **Pairing** fills its line as the steps are reached.
- **The numbers in the smoothness section** are the measured ones from
  `PROJECT.md` and `desktop/scripts/smoothness.mjs`. Change them there first.

## Motion rules

- Reveals start from a state that is already visible (backwards-filled Web
  Animations), so nothing is blank if an observer never fires.
- Loops pause off-screen and in a hidden tab, there is a visible **Pause motion**
  control, and under `prefers-reduced-motion` nothing loops: each demo shows one
  still frame.

## Honest gaps

- **Downloads.** The product is closed-source and free, distributed as a Windows
  installer and an iPhone app from the App Store, so the site never shows code to
  install. Put the two URLs in `config.js`; until then each button reads as
  "coming soon" instead of linking to nothing. iPhone only, by design.
- The phone images are `react-native-web` renders of the app's own source, not
  device screenshots. Replace `assets/app-*.png` with real ones when available.
