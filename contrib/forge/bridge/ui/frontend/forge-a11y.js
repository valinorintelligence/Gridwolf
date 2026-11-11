// FORGE accessibility helper for the Gridwolf front end (f4). The stock bundle ships icon-only buttons, unlabeled
// inputs and some pages without a heading. This script adds accessible names and a page heading at runtime; it
// changes no visible text and no behaviour, and it never overrides a name the page already provides.
(function () {
  "use strict";
  var LABELS = [
    ["trash", "Delete"], ["download", "Download"], ["refresh", "Refresh"], ["rotate", "Refresh"], ["copy", "Copy"],
    ["pencil", "Edit"], ["pen", "Edit"], ["save", "Save"], ["eye-off", "Hide"], ["eye", "View"], ["external", "Open in new tab"],
    ["chevron-down", "Expand"], ["chevron-up", "Collapse"], ["chevron-right", "Open"], ["chevron-left", "Back"],
    ["play", "Run"], ["plus", "Add"], ["check", "Confirm"], ["circle-x", "Remove"], ["x", "Close"], ["file", "Open file"],
    ["share", "Share"], ["send", "Send"], ["upload", "Upload"], ["filter", "Filter"], ["search", "Search"],
    ["user", "Account menu"], ["more", "More actions"], ["arrow-right", "Open"], ["zap", "Run"], ["git", "Compare"],
  ];
  function iconName(el) {
    var s = el.querySelector("svg");
    if (!s) return "";
    var cls = (s.getAttribute("class") || "").split(/\s+/);
    for (var i = 0; i < cls.length; i++) {
      if (cls[i].indexOf("lucide-") === 0) return cls[i].slice(7).replace(/-?\d+$/, "");
    }
    return "";
  }
  function hasName(el) {
    if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")) return true;
    if ((el.innerText || "").trim()) return true;
    if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return true;
    if (el.closest("label")) return true;
    return !!el.getAttribute("placeholder") && /^(input|textarea)$/i.test(el.tagName);
  }
  function context(el) {
    var row = el.closest("tr, li, article, [data-row]");
    if (!row) return "";
    var t = (row.innerText || "").trim().split("\n")[0].trim();
    return t ? " " + t.slice(0, 48) : "";
  }
  function nameButton(el) {
    var icon = iconName(el), label = "";
    for (var i = 0; i < LABELS.length; i++) {
      if (icon.indexOf(LABELS[i][0]) === 0) { label = LABELS[i][1]; break; }
    }
    el.setAttribute("aria-label", (label || "Action") + context(el));
  }
  function nameField(el) {
    var prev = el.previousElementSibling, t = prev ? (prev.innerText || "").trim() : "";
    if (!t && el.parentElement) {
      var p = el.parentElement.firstElementChild;
      if (p && p !== el) t = (p.innerText || "").trim();
    }
    if (!t) t = el.type === "date" ? "Date" : el.tagName === "TEXTAREA" ? "Text editor" : "Input";
    el.setAttribute("aria-label", t.slice(0, 60));
  }
  function activeNav() {
    var a = document.querySelector('a[aria-current="page"], aside a.active, aside a[class*="border-accent"], aside a[class*="bg-accent"]');
    return a ? (a.innerText || "").trim() : (document.title || "Gridwolf").replace(/\s*-.*$/, "");
  }
  function pass() {
    var els = document.querySelectorAll('button, [role=button], input:not([type=hidden]), select, textarea');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (hasName(el)) continue;
      if (/^(input|select|textarea)$/i.test(el.tagName)) nameField(el); else nameButton(el);
    }
    var main = document.querySelector("main");
    if (main && !document.querySelector("h1") && !main.querySelector("[data-forge-h1]")) {
      var h = document.createElement("h1");
      h.className = "forge-sr-only";
      h.setAttribute("data-forge-h1", "");
      h.textContent = activeNav() || "Gridwolf";
      main.insertBefore(h, main.firstChild);
    }
    var mine = document.querySelector("[data-forge-h1]");
    if (mine && document.querySelectorAll("h1").length > 1) mine.remove();
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; pass(); }, 150);
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
