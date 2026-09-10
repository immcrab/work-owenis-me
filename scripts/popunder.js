/* Injected by scripts/inject-ads.py during the Pages build.
 * Opens a sponsor page on some button/link clicks, frequency-capped.
 * Disabled unless the build replaces __POPUNDER_URL__ with a real URL
 * (repo Actions variable POPUNDER_URL). */
(function () {
  var URL_ = "__POPUNDER_URL__";
  if (!URL_ || URL_.indexOf("__POPUNDER") === 0) return;

  var KEY = "_lp_ts";
  var GAP_MS = 3 * 60 * 1000; // at most one every 3 min
  var CHANCE = 0.35;          // ~1 in 3 eligible clicks

  function eligible(el) {
    return el && el.closest &&
      el.closest("button, a, .btn, [role='button'], input[type='submit']");
  }

  document.addEventListener("click", function (e) {
    if (!eligible(e.target)) return;
    var last = 0;
    try { last = +(localStorage.getItem(KEY) || 0); } catch (_) {}
    if (Date.now() - last < GAP_MS) return;
    if (Math.random() > CHANCE) return;
    try { localStorage.setItem(KEY, Date.now()); } catch (_) {}
    var w = window.open(URL_, "_blank");
    if (w) { try { w.blur(); window.focus(); } catch (_) {} }
  }, true);
})();
