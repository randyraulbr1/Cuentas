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

        if (!state.activeProfileId) {
          const bankName = (exch.data && exch.data.plaid_item && exch.data.plaid_item.institution_name) || t("bancoDesconocido");
          state.newProfileName = bankName;
          createProfile();
        } else {
          render();
        }
        setTimeout(() => { state.cloudFlash = ""; rerenderPreservingFocus(); }, 2200);
      },
      onExit: (err, metadata) => {
        if (!err) return;
        const detail = {
          error_type: err.error_type || "",
          error_code: err.error_code || "",
          error_message: err.error_message || err.display_message || "",
          request_id: err.request_id || "",
          exit_status: metadata && metadata.status ? metadata.status : "",
          institution: metadata && metadata.institution ? metadata.institution.name : "",
        };
        console.error("PLAID_LINK_EXIT_ERROR:", detail);
        const parts = [
          detail.error_code || detail.error_type,
          detail.error_message,
          detail.request_id ? "request_id: " + detail.request_id : "",
        ].filter(Boolean);
        state.cloudErrorMsg = t("apiErrorPlaidExit") + (parts.length ? " — " + parts.join(" | ") : "");
        render();
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
  state.cloudBusy = true;
  state.cloudErrorMsg = "";
  state.confirmDisconnectId = null;

  // Quita inmediatamente de pantalla la conexión y cualquier dato bancario
  // almacenado localmente; el backend sigue siendo la fuente de verdad.
  state.cloudInstitutions = state.cloudInstitutions.filter((item) => String(item.id) !== String(plaidItemId));
  state.cloudAccounts = [];
  state.cloudTransactions = [];
  state.cloudLiabilities = {};
  state.cloudLastSync = "";
  await limpiarCacheNube();
  render();

  const r = await apiDisconnectBank(plaidItemId, false);
  if (!r.ok) {
    state.cloudBusy = false;
    state.cloudErrorMsg = r.error;
    render();
    return;
  }
  await refrescarDatosNube();
  state.cloudBusy = false;
  render();
}
