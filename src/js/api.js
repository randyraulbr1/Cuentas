"use strict";

/* ---------- cliente del backend (Cuenta en la nube / Plaid) ----------
   IndexedDB sigue siendo solo la cache local (velocidad + uso sin conexion).
   El backend es la fuente de verdad para todo lo relacionado a bancos conectados. */

const AUTH_SESSION_KEY = "auth:session";

async function loadAuthSession() {
  try {
    const s = await idbGet(AUTH_SESSION_KEY);
    return s || null;
  } catch (e) { return null; }
}
async function saveAuthSession(session) {
  try { await idbSet(AUTH_SESSION_KEY, session); } catch (e) {}
}
async function clearAuthSession() {
  try { await idbSet(AUTH_SESSION_KEY, null); } catch (e) {}
}

function apiUrl(path) {
  const base = (state.apiBaseUrl || "").replace(/\/$/, "");
  return base + path;
}

async function apiFetch(path, options) {
  options = options || {};
  if (!state.apiBaseUrl) {
    return { ok: false, status: 0, error: t("apiSinConfigurar") };
  }
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  if (state.authToken) headers.Authorization = "Bearer " + state.authToken;
  let resp;
  try {
    resp = await fetch(apiUrl(path), {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (e) {
    return { ok: false, status: 0, error: t("apiErrorRed") };
  }
  let data = null;
  try { data = await resp.json(); } catch (e) {}
  if (resp.status === 401 && state.authToken) {
    state.authToken = null; state.authUser = null;
    clearAuthSession();
    return { ok: false, status: 401, error: t("apiSesionExpirada") };
  }
  if (!resp.ok) {
    return { ok: false, status: resp.status, error: (data && data.error) || t("apiErrorGenerico") };
  }
  return { ok: true, status: resp.status, data: data };
}

async function apiRegister(email, password) {
  const r = await apiFetch("/api/auth/register", { method: "POST", body: { email, password } });
  if (r.ok) { await onAuthSuccess(r.data); }
  return r;
}
async function apiLogin(email, password) {
  const r = await apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
  if (r.ok) { await onAuthSuccess(r.data); }
  return r;
}
async function onAuthSuccess(data) {
  state.authToken = data.token;
  state.authUser = data.user;
  await saveAuthSession({ token: data.token, user: data.user });
}
async function apiLogout() {
  state.authToken = null;
  state.authUser = null;
  state.cloudAccounts = []; state.cloudTransactions = []; state.cloudInstitutions = []; state.cloudLastSync = "";
  await clearAuthSession();
  render();
}
async function apiDeleteCloudAccount() {
  const r = await apiFetch("/api/auth/delete-account", { method: "DELETE" });
  if (r.ok) await apiLogout();
  return r;
}
async function apiAcceptConsent() {
  return apiFetch("/api/auth/consent", { method: "POST" });
}

async function apiCreateLinkToken() {
  return apiFetch("/api/plaid/create-link-token", { method: "POST" });
}
async function apiExchangePublicToken(publicToken) {
  return apiFetch("/api/plaid/exchange-public-token", { method: "POST", body: { public_token: publicToken } });
}
async function apiSyncTransactions(plaidItemId) {
  return apiFetch("/api/plaid/sync-transactions", { method: "POST", body: plaidItemId ? { plaid_item_id: plaidItemId } : {} });
}
async function apiGetAccounts() {
  return apiFetch("/api/plaid/accounts");
}
async function apiGetTransactions() {
  return apiFetch("/api/plaid/transactions");
}
async function apiGetInstitutionsStatus() {
  return apiFetch("/api/plaid/institutions-status");
}
async function apiDisconnectBank(plaidItemId, keepTransactions) {
  return apiFetch("/api/plaid/disconnect", { method: "POST", body: { plaid_item_id: plaidItemId, keep_transactions: keepTransactions } });
}

function toggleAuthMode() { state.authMode = state.authMode === "login" ? "register" : "login"; state.authFormError = ""; render(); }
function updateAuthField(field, value) { state[field] = value; rerenderPreservingFocus(); }
async function submitAuthForm() {
  const email = (state.authEmail || "").trim();
  const password = state.authPassword || "";
  if (!email || !password) { state.authFormError = t("apiCamposRequeridos"); render(); return; }
  state.cloudBusy = true; state.authFormError = ""; render();
  const r = state.authMode === "register" ? await apiRegister(email, password) : await apiLogin(email, password);
  state.cloudBusy = false;
  if (!r.ok) { state.authFormError = r.error; render(); return; }
  state.authEmail = ""; state.authPassword = "";
  await refrescarDatosNube();
  render();
}

async function refrescarDatosNube() {
  const [accRes, txRes, instRes] = await Promise.all([apiGetAccounts(), apiGetTransactions(), apiGetInstitutionsStatus()]);
  if (accRes.ok) state.cloudAccounts = accRes.data.accounts;
  if (txRes.ok) state.cloudTransactions = txRes.data.transactions;
  if (instRes.ok) state.cloudInstitutions = instRes.data.items;
  state.cloudLastSync = new Date().toISOString();
  if (!accRes.ok) return accRes;
  if (!txRes.ok) return txRes;
  if (!instRes.ok) return instRes;
  return { ok: true };
}
