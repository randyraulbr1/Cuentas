"use strict";
(function () {
  if (window.Plaid) return;
  const script = document.createElement("script");
  script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
  script.async = true;
  script.onerror = function () {
    console.error("No se pudo cargar Plaid Link");
  };
  document.head.appendChild(script);
})();
