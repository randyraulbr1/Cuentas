"use strict";

let plaidScriptPromise = null;
function loadPlaidScript() {
  if (window.Plaid) return Promise.resolve();
  if (plaidScriptPromise) return plaidScriptPromise;
  plaidScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("no-plaid-script"));
    document.head.appendChild(script);
  });
  return plaidScriptPromise;
}

const DEVICE_CREDS_KEY = "auth:device-credentials";

async function ensureCloudSession() {
  if (state.authUser) return { ok: true };
  let creds;
  try { creds = await idbGet(DEVICE_CREDS_KEY); } catch (e) {}
  if (!creds) {
    creds = { email: "device-" + uid() + "@local.cuentasclaras.app", password: uid() + uid() };
    try { await idbSet(DEVICE_CREDS_KEY, creds); } catch (e) {}
  }
  let r = await apiRegister(creds.email, creds.password);
  if (!r.ok) r = await apiLogin(creds.email, creds.password);
  return r;
}

function resetConexionNube() {
  clearAuthSession();
  try { idbSet(DEVICE_CREDS_KEY, null); } catch (e) {}
  state.authToken = null; state.authUser = null;
  state.cloudAccounts = []; state.cloudTransactions = []; state.cloudInstitutions = []; state.cloudLastSync = "";
  state.cloudErrorMsg = ""; state.cloudBusy = false;
  render();
}

async function iniciarConectarBanco() {
  state.cloudErrorMsg = "";
  state.cloudBusy = true;
  render();

  try {
    const sessionRes = await ensureCloudSession();
    if (!sessionRes.ok) {
      state.cloudBusy = false;
      state.cloudErrorMsg = sessionRes.error;
      render();
      return;
    }

    const linkRes = await apiCreateLinkToken();
    if (!linkRes.ok) {
      state.cloudBusy = false;
      state.cloudErrorMsg = linkRes.error;
      render();
      return;
    }

    try {
      await loadPlaidScript();
    } catch (e) {
      state.cloudBusy = false;
      state.cloudErrorMsg = t("apiErrorPlaidScript");
      render();
      return;
    }

    state.cloudBusy = false;
    render();

    const handler = window.Plaid.create({
      token: linkRes.data.link_token,
      onSuccess: async (public_token) => {
        state.cloudBusy = true; state.cloudErrorMsg = ""; render();
        const exch = await apiExchangePublicToken(public_token);
        if (!exch.ok) { state.cloudBusy = false; state.cloudErrorMsg = exch.error; render(); return; }
        const sync = await apiSyncTransactions();
        if (!sync.ok) { state.cloudBusy = false; state.cloudErrorMsg = sync.error; render(); return; }
        await refrescarDatosNube();
        state.cloudBusy = false;
        state.cloudFlash = t("bancoConectadoMsg");
        render();
        setTimeout(() => { state.cloudFlash = ""; rerenderPreservingFocus(); }, 2200);
      },
      onExit: (err) => {
        if (err) { state.cloudErrorMsg = t("apiErrorPlaidExit"); render(); }
      },
    });
    handler.open();
  } catch (e) {
    state.cloudBusy = false;
    state.cloudErrorMsg = t("apiErrorGenerico") + " (" + (e && e.message ? e.message : "?") + ")";
    render();
  }
}

async function actualizarDatosNube() {
  state.cloudErrorMsg = "";
  state.cloudBusy = true;
  render();
  const sync = await apiSyncTransactions();
  if (!sync.ok) { state.cloudBusy = false; state.cloudErrorMsg = sync.error; render(); return; }
  const r = await refrescarDatosNube();
  state.cloudBusy = false;
  if (!r.ok) state.cloudErrorMsg = r.error;
  else { state.cloudFlash = t("datosActualizadosMsg"); setTimeout(() => { state.cloudFlash = ""; rerenderPreservingFocus(); }, 2200); }
  render();
}

function askDisconnectBank(plaidItemId) { state.confirmDisconnectId = plaidItemId; render(); }
function cancelDisconnectBank() { state.confirmDisconnectId = null; render(); }
async function confirmDisconnectBank(plaidItemId) {
  state.cloudBusy = true; render();
  const r = await apiDisconnectBank(plaidItemId, false);
  state.confirmDisconnectId = null;
  if (!r.ok) { state.cloudBusy = false; state.cloudErrorMsg = r.error; render(); return; }
  await refrescarDatosNube();
  state.cloudBusy = false;
  render();
}
