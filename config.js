/* Where the downloads live. The only file to edit when they exist.
 *
 * Leave a value empty and its button says "coming soon" instead of linking to
 * nothing. Fill it in and the button becomes the download.
 *
 *   windows  the installer, e.g. a GitHub release asset (.exe / .msi)
 *   linux    the AppImage, e.g. a GitHub release asset (LazyMouse_<version>_amd64.AppImage).
 *            Setting it also shows the Linux install notes (.deb and .rpm, X11, sound)
 *   ios      the App Store page, or a TestFlight public link
 *   apply    where "Apply to test" emails go (empty: the support address)
 *   wishlist the Formspree endpoint the wishlist page posts to, e.g. "https://formspree.io/f/abcdwxyz"
 *            (empty: the page offers an email to the support address instead)
 *   support  the address people write to, shown on the privacy and support pages
 *            (the App Store needs both pages to name a way to reach you)
 */
window.LAZYMOUSE_LINKS = {
  windows: "https://github.com/irealycode/lazymouse_releases/releases/download/1.0.1/LazyMouse_1.0.1_x64_en-US.msi",
  linux: "https://github.com/irealycode/lazymouse_releases/releases/download/1.0.1/LazyMouse_1.0.1_amd64.AppImage",
  ios: "",
  apply: "",
  wishlist: "",
  support: "info@sovereignco.net",
};
