"use strict";

(function () {
  const STORE_KEY = "cuentas_claras_bank_cache_v1";

  function profileId() {
    return String(window.state?.activeProfileId || localStorage.getItem("cc_active_profile") || "personal");
  }

  async function api(path, options = {}) {
    const response = await fetch(`/api/plaid${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo conectar con el servidor");
    return data;
  }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function saveSync(data) {
    const old = loadCache();
    const byId = new Map((old.transactions || []).map((x) => [x.transaction_id, x]));
    for (const tx of data.added || []) byId.set(tx.transaction_id, tx);
    for (const tx of data.modified || []) byId.set(tx.transaction_id, tx);
    for (const tx of data.removed || []) byId.delete(tx.transaction_id);
    localStorage.setItem(STORE_KEY, JSON.stringify({
      accounts: data.accounts || old.accounts || [],
      transactions: [...byId.values()],
      syncedAt: data.syncedAt,
    }));
  }

  function message(text, bad = false) {
    const el = document.getElementById("bank-status-text");
    if (!el) return;
    el.textContent = text;
    el.style.color = bad ? "#c62828" : "inherit";
  }

  async function refresh() {
    message("Actualizando movimientos…");
    const data = await api("/sync-transactions", {
      method: "POST",
      body: JSON.stringify({ profileId: profileId() }),
    });
    saveSync(data);
    message(`Actualizado: ${data.added.length} nuevos, ${data.modified.length} cambiados`);
    renderSummary();
  }

  async function connect() {
    message("Abriendo conexión segura…");
    const token = await api("/create-link-token", {
      method: "POST",
      body: JSON.stringify({ profileId: profileId() }),
    });
    if (!window.Plaid) throw new Error("Plaid Link no pudo cargarse");
    const handler = window.Plaid.create({
      token: token.linkToken,
      onSuccess: async (publicToken) => {
        await api("/exchange-public-token", {
          method: "POST",
          body: JSON.stringify({ profileId: profileId(), publicToken }),
        });
        message("Banco conectado. Descargando movimientos…");
        await refresh();
      },
      onExit: (error) => message(error ? "La conexión no se completó" : "Conexión cancelada", Boolean(error)),
    });
    handler.open();
  }

  function renderSummary() {
    const cache = loadCache();
    const count = (cache.transactions || []).length;
    const date = cache.syncedAt ? new Date(cache.syncedAt).toLocaleString() : "Nunca";
    const el = document.getElementById("bank-summary");
    if (el) el.textContent = `${count} movimientos guardados · Última actualización: ${date}`;
  }

  function installPanel() {
    if (document.getElementById("bank-panel")) return;
    const panel = document.createElement("section");
    panel.id = "bank-panel";
    panel.style.cssText = "position:fixed;right:14px;bottom:82px;z-index:9999;width:min(340px,calc(100vw - 28px));background:var(--card,#fff);color:inherit;border:1px solid rgba(127,127,127,.25);border-radius:18px;padding:14px;box-shadow:0 12px 35px rgba(0,0,0,.18);display:none";
    panel.innerHTML = `
      <strong>Conexión bancaria</strong>
      <p id="bank-summary" style="font-size:12px;opacity:.75;margin:6px 0 12px"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="bank-connect" type="button">Conectar banco</button>
        <button id="bank-refresh" type="button">Actualizar ahora</button>
      </div>
      <p id="bank-status-text" style="font-size:13px;margin:10px 0 0">Solo lectura: no mueve dinero.</p>`;
    document.body.appendChild(panel);

    const toggle = document.createElement("button");
    toggle.id = "bank-toggle";
    toggle.type = "button";
    toggle.textContent = "🏦 Banco";
    toggle.style.cssText = "position:fixed;right:14px;bottom:20px;z-index:10000;border:0;border-radius:999px;padding:12px 16px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.22)";
    document.body.appendChild(toggle);

    toggle.onclick = () => { panel.style.display = panel.style.display === "none" ? "block" : "none"; renderSummary(); };
    document.getElementById("bank-connect").onclick = () => connect().catch((e) => message(e.message, true));
    document.getElementById("bank-refresh").onclick = () => refresh().catch((e) => message(e.message, true));
    renderSummary();
  }

  window.addEventListener("DOMContentLoaded", installPanel);
})();
