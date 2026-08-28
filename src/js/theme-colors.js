"use strict";

(function () {
  const KEY = "cuentas-claras:accent-theme";
  const THEMES = ["black", "blue", "green", "purple", "red"];

  function loadAccentTheme() {
    try {
      const saved = localStorage.getItem(KEY);
      return THEMES.indexOf(saved) !== -1 ? saved : "black";
    } catch (e) {
      return "black";
    }
  }

  function applyAccentTheme(name, shouldSave) {
    const theme = THEMES.indexOf(name) !== -1 ? name : "black";
    document.documentElement.setAttribute("data-accent-theme", theme);
    if (shouldSave) {
      try { localStorage.setItem(KEY, theme); } catch (e) {}
    }
    document.querySelectorAll(".theme-color-btn").forEach((btn) => {
      const active = btn.dataset.accentChoice === theme;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function labelText() {
    return typeof LANG !== "undefined" && LANG === "en" ? "Style color" : "Color del estilo";
  }

  function choiceLabel(name) {
    const en = typeof LANG !== "undefined" && LANG === "en";
    const labels = en
      ? { black: "Black", blue: "Blue", green: "Green", purple: "Purple", red: "Red" }
      : { black: "Negro", blue: "Azul", green: "Verde", purple: "Morado", red: "Rojo" };
    return labels[name];
  }

  function injectPicker() {
    const root = document.getElementById("root");
    if (!root || document.querySelector(".theme-color-picker")) return;

    const titles = Array.from(root.querySelectorAll(".opt-section-title"));
    const prefTitle = titles.find((el) => {
      const txt = (el.textContent || "").trim().toLowerCase();
      return txt === "preferencias" || txt === "preferences";
    });
    if (!prefTitle) return;

    const panel = prefTitle.closest(".panel");
    if (!panel) return;

    const rows = panel.querySelectorAll(":scope > .opt-row");
    let themeRow = null;
    rows.forEach((row) => {
      const txt = (row.querySelector(".opt-row-label")?.textContent || "").trim().toLowerCase();
      if (txt === "tema" || txt === "theme") themeRow = row;
    });

    const row = document.createElement("div");
    row.className = "opt-row theme-color-row";
    row.innerHTML = '<span class="opt-row-label">' + labelText() + '</span><div class="theme-color-picker" role="group" aria-label="' + labelText() + '"></div>';

    const picker = row.querySelector(".theme-color-picker");
    const current = loadAccentTheme();
    THEMES.forEach((name) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-color-btn" + (name === current ? " active" : "");
      btn.dataset.accentChoice = name;
      btn.title = choiceLabel(name);
      btn.setAttribute("aria-label", choiceLabel(name));
      btn.setAttribute("aria-pressed", name === current ? "true" : "false");
      picker.appendChild(btn);
    });

    if (themeRow && themeRow.nextSibling) panel.insertBefore(row, themeRow.nextSibling);
    else panel.appendChild(row);
  }

  applyAccentTheme(loadAccentTheme(), false);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".theme-color-btn");
    if (!btn) return;
    applyAccentTheme(btn.dataset.accentChoice, true);
  });

  const observer = new MutationObserver(() => injectPicker());
  const appRoot = document.getElementById("root");
  if (appRoot) observer.observe(appRoot, { childList: true, subtree: true });
  injectPicker();
})();
