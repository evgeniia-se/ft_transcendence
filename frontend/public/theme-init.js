// Applies the saved theme before the page paints, so a dark-theme user never sees a white flash.
// A file of its own (not an inline <script>) so the Content-Security-Policy can forbid inline scripts.
try {
  var t = localStorage.getItem("ft_theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {
  // storage unavailable: the browser's own light/dark preference applies
}
