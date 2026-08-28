"use strict";

function applyTheme() { document.documentElement.setAttribute("data-theme", state.theme); }
function applyTextSize() { document.documentElement.setAttribute("data-textsize", state.textSize); }
function setTextSize(v) { state.textSize = v; applyTextSize(); saveSettings(); render(); }

async function enterProfile(id) {
  if (saveTimeout) { clearTimeout(saveTimeout); saveUserDataNow(); }
  state.activeProfileId = id;
  try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
  const d = await loadUserData(id);
  state.ingreso = d.ingreso != null ? d.ingreso : "";
  state.subs = d.subs || [];
  state.cards = d.cards || [];
  state.savingsRate = d.savingsRate != null ? d.savingsRate : 20;
  state.ahorroActual = d.ahorroActual != null ? d.ahorroActual : "";
  state.debito = d.debito != null ? d.debito : "";
  state.cash = d.cash != null ? d.cash : "";
  state.bankTransactions = d.bankTransactions || [];
  state.categoriaAprendida = d.categoriaAprendida || {};
  state.goals = d.goals || [];
  state.suscripcionesCanceladas = d.suscripcionesCanceladas || [];
  state.notasTransacciones = d.notasTransacciones || {};
  state.suscripcionesManuales = d.suscripcionesManuales || [];
  state.suscripcionesFrecuencia = d.suscripcionesFrecuencia || {};
  state.gastosFijosReconocidos = d.gastosFijosReconocidos || [];
  // Migra los pagos fijos bancarios antiguos a la lista principal editable.
  state.gastosFijosReconocidos.forEach((gf) => {
    if (!state.subs.some((sub) => sub.merchantKey === gf.merchantKey)) {
      state.subs.push({ id: gf.id || uid(), nombre: gf.nombre || "", monto: String(gf.monto || ""),
        categoria: "otro", icono: "receipt", merchantKey: gf.merchantKey, pagadoMes: "" });
    }
  });
  state.gastosFijosReconocidos = [];
  state.showMarcarGastoFijo = false; state.nombreGastoFijoTemp = "";
  state.historialMesesVisibles = 3; state.pagosMesesVisibles = 3; state.historialMesAbierto = null; state.historialVista = "compras";
  state.editingGoals = false; state.confirmDeleteGoalId = null;
  state.consentimientoAceptado = !!d.consentimientoAceptado;
  state.consentimientoFecha = d.consentimientoFecha || "";
  state.showConsentimiento = false;
  state.bankPendingCategoria = state.bankTransactions.filter((tx) => !tx.categoria).map((tx) => tx.id);
  state.bankImportMsg = "";
  state.confirmDeleteBankTxId = null;
  state.metaAhorro = d.metaAhorro != null ? d.metaAhorro : "";
  state.history = d.history || [];
  state.payFrequency = d.payFrequency || "mensual";
  state.ultimoPago = d.ultimoPago || "";
  state.proximoPagoAjuste = d.proximoPagoAjuste || "";
  state.ingresosLog = d.ingresosLog || [];
  state.loans = d.loans || [];
  state.job = Object.assign({ nombre: "", pagoHora: "18", pagoDia: "", frecuenciaPago: "semanal", diaPago: "", horasExtraDespues: "40", multiplicadorExtra: "1.5", impuestoPct: "", descansoPagado: false, limiteAlmuerzo: "30", horarioDias: [false, false, false, false, false, false, false], horarioInicio: "09:00", horarioFin: "17:00", horarioRecordar: false, horarioUltimoRecordatorio: "" }, d.job || {});
  if (!state.job.pagoHora) state.job.pagoHora = "18";
  if (!state.job.limiteAlmuerzo) state.job.limiteAlmuerzo = "30";
  state.turnos = d.turnos || [];
  state.turnoActivo = d.turnoActivo || null;
  state.pagosTrabajo = d.pagosTrabajo || [];
  state.resultado = null; state.confirmReset = false;
  state.expandedCardIds = {}; state.confirmDeleteSubId = null; state.confirmDeleteCardId = null; state.confirmDeleteHistoryKey = null; state.payingTarget = null; state.payingSubId = null; state.payFormMonto = ""; state.confirmDeleteLoanId = null;
  state.autoPagoNotif = null;
  state.editingJob = false; state.confirmTerminarTrabajo = false; state.confirmDeleteTurnoId = null; state.expandedTurnoIds = {};
  state.showPagoTrabajo = false; state.pagoTrabajoForm = null; state.workPagoFlash = false; state.confirmDeletePagoTrabajoId = null;
  processAutoPayments();
  stopTimerLoop();
  if (state.turnoActivo) startTimerLoop();
  undoStack.length = 0;
  state.screen = "app";
  render();
  saveUserDataNow();
}

function createProfile() {
  const name = (state.newProfileName || "").trim();
  if (!name) return;
  const p = { id: uid(), nombre: name };
  state.profiles.push(p); saveProfiles(state.profiles); state.newProfileName = "";
  enterProfile(p.id);
}

let pinUnlockSequence = 0;
let biometricUnlockSequence = 0;
let biometricAbortController = null;

function pinQuickCheck(pin) {
  let hash = 2166136261;
  const value = "305-save-pin-v1:" + pin;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function pinDigestWithTimeout(pin) {
  return Promise.race([
    pinDigest(pin),
    new Promise((resolve, reject) => setTimeout(() => reject(new Error("PIN_TIMEOUT")), 2500))
  ]);
}

async function pinDigest(pin) {
  const data = new TextEncoder().encode("305-save-local-pin:" + pin);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function setupBiometric() {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    state.pinError = LANG === "es" ? "Este navegador no permite usar la huella. Puedes seguir usando el PIN." : "This browser does not support biometrics. You can keep using the PIN.";
    render(); return;
  }
  state.biometricBusy = true; state.pinError = ""; render();
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = await navigator.credentials.create({ publicKey: {
      challenge,
      rp: { name: "305 Save", id: location.hostname },
      user: { id: userId, name: "305-save-local", displayName: "305 Save" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
      attestation: "none"
    } });
    if (!credential) throw new Error("No credential");
    localStorage.setItem(BIOMETRIC_CRED_KEY, bytesToBase64Url(credential.rawId));
    state.pinError = LANG === "es" ? "Huella activada correctamente." : "Biometrics enabled.";
  } catch (error) {
    state.pinError = LANG === "es" ? "No se activó la huella. Inténtalo otra vez o usa el PIN." : "Biometrics were not enabled. Try again or use the PIN.";
  }
  state.biometricBusy = false; render();
}

async function unlockBiometric() {
  if (!window.PublicKeyCredential || !navigator.credentials) { state.pinError = LANG === "es" ? "La huella no está disponible. Usa el PIN." : "Biometrics unavailable. Use the PIN."; render(); return; }
  let credentialId = "";
  try { credentialId = localStorage.getItem(BIOMETRIC_CRED_KEY) || ""; } catch (error) {}
  if (!credentialId) { state.pinError = LANG === "es" ? "Primero activa la huella en Opciones." : "Enable biometrics in Options first."; render(); return; }
  const biometricRunId = ++biometricUnlockSequence;
  biometricAbortController = typeof AbortController !== "undefined" ? new AbortController() : null;
  const biometricWatchdog = setTimeout(() => {
    if (biometricRunId !== biometricUnlockSequence) return;
    if (biometricAbortController) { try { biometricAbortController.abort(); } catch (error) {} }
    state.biometricBusy = false;
  }, 13000);
  state.biometricBusy = true; state.pinError = ""; render();
  try {
    const assertion = await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: base64UrlToBytes(credentialId), transports: ["internal"] }],
      userVerification: "required",
      timeout: 12000
    }, signal: biometricAbortController ? biometricAbortController.signal : undefined });
    if (!assertion) throw new Error("No assertion");
    if (biometricRunId !== biometricUnlockSequence) return;
    state.appLocked = false; state.pinInput = ""; state.pinError = "";
  } catch (error) {
    if (biometricRunId !== biometricUnlockSequence) return;
    state.pinError = LANG === "es" ? "No se pudo comprobar la huella. Usa el PIN o vuelve a intentarlo." : "Biometric verification failed. Use the PIN or try again.";
  }
  clearTimeout(biometricWatchdog);
  if (biometricRunId === biometricUnlockSequence) { state.biometricBusy = false; biometricAbortController = null; render(); }
}

async function savePin() {
  const pin = String(state.pinSetupInput || "").replace(/\D/g, "").slice(0, 6);
  if (pin.length !== 6) { state.pinError = LANG === "es" ? "El PIN debe tener exactamente 6 números." : "PIN must contain exactly 6 digits."; render(); return; }
  state.pinBusy = true;
  try {
    const digest = await pinDigest(pin);
    localStorage.setItem(PIN_HASH_KEY, digest);
    localStorage.setItem(PIN_QUICK_KEY, pinQuickCheck(pin));
    localStorage.setItem(PIN_ATTEMPTS_KEY, "0");
    localStorage.removeItem(PIN_LOCK_KEY);
    state.pinSetupInput = ""; state.pinError = "";
  } catch (error) {
    state.pinError = LANG === "es" ? "No se pudo guardar el PIN en este teléfono." : "PIN could not be saved on this device.";
  }
  state.pinBusy = false; render();
}

function lockApp() {
  state.pinInput = ""; state.pinError = ""; state.biometricAutoTried = false; state.appLocked = true; render();
}

function askResetPin() { state.confirmPinReset = true; state.pinError = ""; render(); }
function cancelResetPin() { state.confirmPinReset = false; render(); }
function confirmResetPin() {
  try {
    localStorage.removeItem(PIN_HASH_KEY);
    localStorage.removeItem(PIN_QUICK_KEY);
    localStorage.removeItem(PIN_ATTEMPTS_KEY);
    localStorage.removeItem(PIN_LOCK_KEY);
    localStorage.removeItem(BIOMETRIC_CRED_KEY);
  } catch (error) {}
  state.pinInput = ""; state.pinError = ""; state.confirmPinReset = false;
  state.biometricAutoTried = false; state.appLocked = false;
  render();
}

async function unlockPin() {
  if (state.pinBusy) return;
  let lockUntil = 0;
  try { lockUntil = Number(localStorage.getItem(PIN_LOCK_KEY)) || 0; } catch (error) {}
  if (lockUntil > Date.now()) { render(); return; }
  const pin = String(state.pinInput || "").replace(/\D/g, "").slice(0, 6);
  if (pin.length !== 6) { state.pinError = LANG === "es" ? "Escribe los 6 números." : "Enter all 6 digits."; render(); return; }

  const runId = ++pinUnlockSequence;
  state.pinBusy = true; state.pinError = ""; render();
  try {
    const quickExpected = localStorage.getItem(PIN_QUICK_KEY) || "";
    let valid = false;
    if (quickExpected) {
      valid = pinQuickCheck(pin) === quickExpected;
    } else {
      const expected = localStorage.getItem(PIN_HASH_KEY) || "";
      const actual = await pinDigestWithTimeout(pin);
      if (runId !== pinUnlockSequence) return;
      valid = !!expected && actual === expected;
      if (valid) localStorage.setItem(PIN_QUICK_KEY, pinQuickCheck(pin));
    }
    if (runId !== pinUnlockSequence) return;
    if (valid) {
      localStorage.setItem(PIN_ATTEMPTS_KEY, "0"); localStorage.removeItem(PIN_LOCK_KEY);
      state.pinInput = ""; state.pinError = ""; state.appLocked = false;
    } else {
      const attempts = (Number(localStorage.getItem(PIN_ATTEMPTS_KEY)) || 0) + 1;
      if (attempts >= 3) {
        localStorage.setItem(PIN_ATTEMPTS_KEY, "0");
        localStorage.setItem(PIN_LOCK_KEY, String(Date.now() + 5 * 60 * 1000));
        state.pinError = LANG === "es" ? "PIN incorrecto 3 veces. Bloqueado por 5 minutos." : "PIN incorrect 3 times. Locked for 5 minutes.";
      } else {
        localStorage.setItem(PIN_ATTEMPTS_KEY, String(attempts));
        state.pinError = (LANG === "es" ? "PIN incorrecto. Intentos restantes: " : "Incorrect PIN. Attempts remaining: ") + (3 - attempts) + ".";
      }
      state.pinInput = "";
    }
  } catch (error) {
    if (runId === pinUnlockSequence) state.pinError = LANG === "es" ? "La comprobación tardó demasiado. Toca Entrar otra vez o restablece el PIN." : "Verification took too long. Tap Unlock again or reset the PIN.";
  } finally {
    if (runId === pinUnlockSequence) { state.pinBusy = false; render(); }
  }
}

function addPinDigit(digit) {
  if (biometricAbortController) { try { biometricAbortController.abort(); } catch (error) {} biometricAbortController = null; }
  biometricUnlockSequence++;
  state.biometricBusy = false;
  if (state.pinInput.length >= 6) return;
  state.pinInput = (state.pinInput + String(digit).replace(/\D/g, "")).slice(0, 6);
  state.pinError = "";
  render();
}

function deletePinDigit() {
  pinUnlockSequence++;
  if (biometricAbortController) { try { biometricAbortController.abort(); } catch (error) {} biometricAbortController = null; }
  biometricUnlockSequence++;
  state.biometricBusy = false;
  state.pinBusy = false;
  state.pinInput = state.pinInput.slice(0, -1);
  state.pinError = "";
  render();
}

function switchUser() {
  if (saveTimeout) { clearTimeout(saveTimeout); saveUserDataNow(); }
  state.activeProfileId = null;
  try { localStorage.removeItem(ACTIVE_KEY); } catch (e) {}
  state.screen = "selector";
  render();
}

function askDeleteProfile(id) { state.confirmDeleteProfileId = id; render(); }

function cancelDeleteProfile() { state.confirmDeleteProfileId = null; render(); }

function deleteProfile(id) {
  state.profiles = state.profiles.filter((p) => p.id !== id);
  saveProfiles(state.profiles);
  deleteUserData(id);
  state.confirmDeleteProfileId = null;
  if (state.activeProfileId === id) { state.activeProfileId = null; state.screen = "selector"; }
  render();
}

function toggleTheme() { state.theme = state.theme === "dark" ? "light" : "dark"; saveSettings(); applyTheme(); render(); }

function toggleLang() { state.lang = state.lang === "es" ? "en" : "es"; LANG = state.lang; saveSettings(); render(); }

function toggleCurrency() { state.currency = state.currency === "usd" ? "eur" : "usd"; saveSettings(); render(); }

function setObjetivo(v) { state.objetivo = v; saveSettings(); render(); }

function setPayFrequency(f) { state.payFrequency = f; scheduleSave(); render(); }

function setSavingsRate(n) { state.savingsRate = Math.max(0, Math.min(100, Math.round(Number(n) || 0))); scheduleSave(); render(); }


function buildExportData() {
  const profile = state.profiles.find((p) => p.id === state.activeProfileId);
  return {
    perfil: profile ? profile.nombre : "",
    moneda: state.currency,
    frecuencia_pago: state.payFrequency,
    ingreso_mensual_fijo: state.payFrequency === "mensual" ? toNum(state.ingreso) : null,
    pagos_recibidos_este_mes: ingresosEsteMes().map((x) => toNum(x.monto)),
    pagos_fijos: state.subs.map((s) => ({ nombre: s.nombre, monto: toNum(s.monto), categoria: s.categoria, pagado_este_mes: s.pagadoMes === monthKey() })),
    tarjetas_de_credito: state.cards.map((c) => ({ nombre: c.nombre, saldo: toNum(c.saldo), limite: toNum(c.limite) || null, tasa_apr: toNum(c.apr) || null, pago_minimo: toNum(c.minimo) })),
    prestamos_a_plazos: state.loans.map((l) => ({ nombre: l.nombre, saldo_total: toNum(l.saldoTotal), monto_original: toNum(l.montoOriginal) || null, pago_por_cuota: toNum(l.montoPago), frecuencia: l.frecuencia, tasa_interes: toNum(l.tasa) || null, pago_automatico: !!l.automatico })),
    ahorro_actual: toNum(state.ahorroActual),
    meta_de_ahorro: toNum(state.metaAhorro) || null,
    dinero_en_debito: toNum(state.debito),
    porcentaje_ahorro_configurado: state.savingsRate,
    objetivo_financiero: state.objetivo,
    historial_mensual: state.history,
  };
}

function showExport() { pushOverlayNavState("export"); state.showExport = true; render(); }

function closeExport() {
  state.showExport = false; state.exportCopied = false;
  try { if (history.state && history.state.ccOverlay === "export") { history.back(); return; } } catch (e) {}
  render();
}

async function copyExport() {
  const ta = document.getElementById("export-textarea");
  if (!ta) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(ta.value);
    else { ta.select(); document.execCommand("copy"); }
    state.exportCopied = true;
    render();
    setTimeout(() => { state.exportCopied = false; render(); }, 1800);
  } catch (e) {
    ta.select();
  }
}

function goTab(id) {
  if (!["inicio", "cuentas", "trabajo", "tarjetas", "opciones"].includes(id)) return;
  if (state.activeTab !== id) {
    try { history.pushState({ ccTab: id, ccOverlay: null }, ""); } catch (e) {}
  }
  state.activeTab = id;
  state.showExport = false;
  state.showTxDetalle = null;
  state.showConsentimiento = false;
  state.expandedCloudCardIds = {};
  render();
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}

/* Los tres modos de ahorro también responden antes que cualquier panel superpuesto. */
document.addEventListener("click", (event) => {
  const savingsButton = event.target && event.target.closest ? event.target.closest("[data-savings-rate]") : null;
  if (!savingsButton) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  setSavingsRate(Number(savingsButton.dataset.savingsRate));
}, true);

/* La navegación inferior tiene prioridad sobre tarjetas, modales y cualquier otro botón. */
document.addEventListener("click", (event) => {
  const tabButton = event.target && event.target.closest ? event.target.closest(".tab-btn[data-id]") : null;
  if (!tabButton) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  goTab(tabButton.dataset.id);
}, true);

function pushOverlayNavState(overlayName) {
  try { history.pushState({ ccTab: state.activeTab, ccOverlay: overlayName }, ""); } catch (e) {}
}

window.addEventListener("popstate", (e) => {
  const s = e.state;
  if (!s) return; // se acabaron nuestros estados; deja que el navegador haga lo normal (salir/atras real)
  state.showExport = s.ccOverlay === "export";
  state.showTxDetalle = s.ccOverlay === "txDetalle" ? state.showTxDetalle : null;
  state.activeTab = s.ccTab || "inicio";
  render();
});

function goInicio() { goTab("inicio"); }

function verMesTendencia(mk) {
  const esMesActual = mk === monthKey();
  state.historialMesAbierto = esMesActual ? null : mk;
  goTab("historial");
}

async function actualizarApp() {
  try {
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; saveUserDataNow(); }
    try { sessionStorage.setItem("305-save-safe-update", String(Date.now())); } catch (error) {}
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.waiting) {
        reg.waiting.postMessage("SKIP_WAITING");
        navigator.serviceWorker.addEventListener("controllerchange", () => location.reload());
        return;
      }
      if (reg) { try { await reg.update(); } catch (e) {} }
    }
    if ("caches" in window) { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
  } catch (e) {}
  location.reload();
}

function inferPaymentVisual(name) {
  const value = String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const rules = [
    { words: ["renta", "alquiler", "rent", "casa", "apartamento", "mortgage", "hipoteca"], icon: "home", category: "renta" },
    { words: ["carro", "auto", "coche", "vehicle", "car payment"], icon: "car", category: "carro" },
    { words: ["seguro", "insurance", "geico", "progressive"], icon: "shield", category: "seguro" },
    { words: ["luz", "electric", "electricidad", "fpl", "power"], icon: "bulb", category: "luz" },
    { words: ["agua", "water"], icon: "droplet", category: "agua" },
    { words: ["gas"], icon: "flame", category: "gas" },
    { words: ["wifi", "internet", "router", "xfinity", "comcast"], icon: "wifi", category: "wifi" },
    { words: ["telefono", "phone", "mobile", "t-mobile", "verizon", "at&t"], icon: "phone", category: "telefono" },
    { words: ["gym", "gimnasio", "fitness"], icon: "dumbbell", category: "gym" },
    { words: ["netflix", "hulu", "disney", "streaming", "subscription", "suscripcion"], icon: "clapper", category: "streaming" },
    { words: ["comida", "restaurant", "restaurante", "food"], icon: "utensils", category: "otro" },
    { words: ["gasolina", "fuel", "shell", "chevron"], icon: "fuel", category: "carro" },
    { words: ["doctor", "medico", "salud", "hospital", "farmacia", "pharmacy"], icon: "medcross", category: "salud" },
    { words: ["escuela", "colegio", "school", "universidad"], icon: "book", category: "otro" },
    { words: ["prestamo", "loan", "credito"], icon: "bills", category: "otro" },
  ];
  for (const rule of rules) if (rule.words.some((word) => value.indexOf(word) !== -1)) return { icon: rule.icon, category: rule.category };
  return { icon: "tag", category: "otro" };
}

function sanitizeNum(str) {
  str = String(str).replace(/[^0-9.]/g, "");
  const parts = str.split(".");
  if (parts.length > 2) str = parts[0] + "." + parts.slice(1).join("");
  return str;
}

root.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "new-profile-input") { state.newProfileName = el.value; return; }
  if (el.id === "savings-rate-input") {
    state.savingsRate = Math.max(0, Math.min(100, Math.round(Number(el.value) || 0)));
    const valueLabel = root.querySelector(".opt-slider-val");
    if (valueLabel) valueLabel.textContent = state.savingsRate + "%";
    scheduleSave();
    return;
  }
  if (el.dataset.scope === "pinSetup") { state.pinSetupInput = el.value.replace(/\D/g, "").slice(0, 6); state.pinError = ""; return; }
  if (el.dataset.scope === "pinUnlock") { state.pinInput = el.value.replace(/\D/g, "").slice(0, 6); state.pinError = ""; return; }
  const scope = el.dataset.scope;
  if (!scope) return;
  if (scope === "ingreso") { state.ingreso = sanitizeNum(el.value); scheduleSave(); return; }
  if (scope === "ahorroActual") { state.ahorroActual = sanitizeNum(el.value); scheduleSave(); return; }
  if (scope === "debito") { state.debito = sanitizeNum(el.value); scheduleSave(); return; }
  if (scope === "agregarTurno") { state.agregarTurnoForm[el.dataset.field] = el.value; rerenderPreservingFocus(); return; }
  if (scope === "cash") { state.cash = sanitizeNum(el.value); scheduleSave(); return; }
  if (scope === "apiBaseUrl") { state.apiBaseUrl = el.value.trim(); saveSettings(); rerenderPreservingFocus(); return; }
  if (scope === "authEmail") { state.authEmail = el.value; rerenderPreservingFocus(); return; }
  if (scope === "authPassword") { state.authPassword = el.value; rerenderPreservingFocus(); return; }
  if (scope === "goal") {
    const g = state.goals.find((x) => x.id === el.dataset.id);
    if (!g) return;
    const f = el.dataset.field;
    g[f] = f === "nombre" ? el.value : sanitizeNum(el.value);
    scheduleSave(); rerenderPreservingFocus(); return;
  }
  if (scope === "historialSearch") { state.historialSearch = el.value; rerenderPreservingFocus(); return; }
  if (scope === "txNota") {
    state.notasTransacciones[el.dataset.id] = el.value;
    scheduleSave(); rerenderPreservingFocus(); return;
  }
  if (scope === "nombreGastoFijoTemp") { state.nombreGastoFijoTemp = el.value; rerenderPreservingFocus(); return; }
  if (scope === "montoConfirmarAhorro") { state.montoConfirmarAhorro = sanitizeNum(el.value); rerenderPreservingFocus(); return; }
  if (scope === "extraPagoDeuda") { state.extraPagoDeuda = sanitizeNum(el.value); rerenderPreservingFocus(); return; }
  if (scope === "payFormMonto") { state.payFormMonto = sanitizeNum(el.value); rerenderPreservingFocus(); return; }
  if (scope === "agregarTurno") {
    if (!state.agregarTurnoForm) return;
    state.agregarTurnoForm[el.dataset.field] = el.dataset.field === "fecha" ? el.value : sanitizeNum(el.value);
    rerenderPreservingFocus(); return;
  }
  if (scope === "metaAhorro") { state.metaAhorro = sanitizeNum(el.value); scheduleSave(); return; }
  if (scope === "savingsRate") { state.savingsRate = Number(el.value); scheduleSave(); rerenderPreservingFocus(); return; }
  if (scope === "ingresoLog") {
    const entry = state.ingresosLog.find((x) => x.id === el.dataset.id);
    if (!entry) return;
    entry.monto = sanitizeNum(el.value);
    scheduleSave(); rerenderPreservingFocus(); return;
  }
  if (scope === "ultimoPago") { state.ultimoPago = el.value; scheduleSave(); render(); return; }
  if (scope === "proximoPagoAjuste") { state.proximoPagoAjuste = el.value; scheduleSave(); render(); return; }
  if (scope === "sub") {
    const item = state.subs.find((x) => x.id === el.dataset.id);
    if (!item) return;
    const field = el.dataset.field;
    item[field] = field === "monto" ? sanitizeNum(el.value) : el.value;
    if (field === "nombre" && !item.iconManual) {
      const visual = inferPaymentVisual(el.value);
      item.icono = visual.icon;
      item.categoria = visual.category;
      const iconButton = document.getElementById("sub-icon-" + item.id);
      if (iconButton) iconButton.innerHTML = icon(visual.icon) + '<span class="sub-ico-edit">' + icon("pencil") + '</span>';
      const categorySelect = root.querySelector('[data-scope="sub"][data-id="' + item.id + '"][data-field="categoria"]');
      if (categorySelect) categorySelect.value = visual.category;
    }
    scheduleSave(); return;
  }
  if (scope === "card") {
    const item = state.cards.find((x) => x.id === el.dataset.id);
    if (!item) return;
    item[el.dataset.field] = el.dataset.field === "nombre" ? el.value : sanitizeNum(el.value);
    scheduleSave(); rerenderPreservingFocus(); return;
  }
  if (scope === "loan") {
    const item = state.loans.find((x) => x.id === el.dataset.id);
    if (!item) return;
    const f = el.dataset.field;
    item[f] = (f === "nombre" || f === "ultimoPago") ? el.value : sanitizeNum(el.value);
    if (f === "montoOriginal" && !String(item.saldoTotal || "").trim()) item.saldoTotal = sanitizeNum(el.value);
    scheduleSave(); rerenderPreservingFocus(); return;
  }
  if (scope === "job") {
    const f = el.dataset.field;
    const raw = f === "nombre" || f === "horarioInicio" || f === "horarioFin";
    state.job[f] = raw ? el.value : sanitizeNum(el.value);
    scheduleSave(); rerenderPreservingFocus(); return;
  }
  if (scope === "pagoTrabajo") {
    const f = el.dataset.field;
    const textFields = ["fecha", "metodo", "notas"];
    state.pagoTrabajoForm[f] = textFields.indexOf(f) !== -1 ? el.value : sanitizeNum(el.value);
    rerenderPreservingFocus(); return;
  }
  if (scope === "turno") {
    const item = state.turnos.find((x) => x.id === el.dataset.id);
    if (!item) return;
    const f = el.dataset.field;
    item[f] = f === "notas" ? el.value : sanitizeNum(el.value);
    scheduleSave(); rerenderPreservingFocus(); return;
  }
});

root.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.id === "new-profile-input") createProfile(); });

root.addEventListener("scroll", (e) => {
  if (e.target && e.target.id === "bank-expense-picker") {
    state.bankExpenseScrollTop = e.target.scrollTop;
    try { sessionStorage.setItem("bankExpenseScrollTop", String(e.target.scrollTop)); } catch (error) {}
  }
}, true);

root.addEventListener("click", (e) => {
  const directTab = e.target.closest(".tab-btn[data-id]");
  if (directTab) { e.preventDefault(); goTab(directTab.dataset.id); return; }
  let closedCloudCards = false;
  if (!e.target.closest(".cc-card") && state.expandedCloudCardIds && Object.keys(state.expandedCloudCardIds).some((key) => state.expandedCloudCardIds[key])) {
    state.expandedCloudCardIds = {};
    closedCloudCards = true;
  }
  if (e.target.classList && e.target.classList.contains("options-overlay")) {
    if (state.showConsentimiento) { state.showConsentimiento = false; render(); return; }
    if (state.showExport) { state.showExport = false; state.exportCopied = false; render(); return; }
    if (state.showTxDetalle) { state.showTxDetalle = null; render(); return; }
    return;
  }
  const btn = e.target.closest("[data-action]");
  if (!btn) { if (closedCloudCards) render(); return; }
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const freq = btn.dataset.freq;
  const payType = btn.dataset.type;
  const map = {
    actualizar: actualizarApp, undo: undo,
    confirmReset: () => { state.confirmReset = true; render(); },
    cancelReset: () => { state.confirmReset = false; render(); },
    resetAll: resetAll,
    addSub: addSub, removeSub: () => removeSub(id), askDeleteSub: () => askDeleteSub(id), cancelDeleteSub: cancelDeleteSub, toggleEditSubs: toggleEditSubs,
    toggleSubPagado: () => toggleSubPagado(id), confirmPagoSub: confirmPagoSub, cancelPagoSub: cancelPagoSub,
    addSubPreset: () => addSubPreset(id),
    addSubFromBankTx: () => addSubFromBankTx(id),
    toggleSubPresetPicker: () => {
      state.subPresetPicker = !state.subPresetPicker;
      render();
      if (state.subPresetPicker) setTimeout(() => {
        const picker = document.getElementById("bank-expense-picker");
        if (picker) {
          let savedScroll = 0;
          try { savedScroll = Number(sessionStorage.getItem("bankExpenseScrollTop")) || 0; } catch (error) {}
          picker.scrollTop = state.bankExpenseScrollTop || savedScroll;
        }
      }, 30);
    },
    toggleEditIngreso: toggleEditIngreso, toggleEditAhorro: toggleEditAhorro, toggleEditCards: toggleEditCards,
    addIngresoEntry: addIngresoEntry, removeIngresoEntry: () => removeIngresoEntry(id),
    addCard: addCard, removeCard: () => removeCard(id), askDeleteCard: () => askDeleteCard(id), cancelDeleteCard: cancelDeleteCard,
    toggleCardExpand: () => toggleCardExpand(id),
    addLoan: addLoan, removeLoan: () => removeLoan(id), askDeleteLoan: () => askDeleteLoan(id), cancelDeleteLoan: cancelDeleteLoan,
    toggleEditLoans: toggleEditLoans, setLoanFrec: () => setLoanFrec(id, freq),
    loanAutoOn: () => setLoanAuto(id, true), loanAutoOff: () => setLoanAuto(id, false),
    startImportarBanco: startImportarBanco, confirmTxCategoria: () => confirmTxCategoria(id),
    setAuthLogin: () => { state.authMode = "login"; state.authFormError = ""; render(); },
    setAuthRegister: () => { state.authMode = "register"; state.authFormError = ""; render(); },
    submitAuthForm: submitAuthForm, apiLogout: apiLogout, apiDeleteCloudAccount: apiDeleteCloudAccount,
    iniciarConectarBanco: iniciarConectarBanco, actualizarDatosNube: actualizarDatosNube, resetConexionNube: resetConexionNube,
    toggleEditGoals: toggleEditGoals, addGoal: addGoal, askDeleteGoal: () => askDeleteGoal(id), cancelDeleteGoal: cancelDeleteGoal, removeGoal: () => removeGoal(id),
    toggleCuentasHistorial: () => { state.cuentasHistorialAbierto = !state.cuentasHistorialAbierto; render(); },
    toggleCuentasAnalisis: () => { state.cuentasAnalisisAbierto = !state.cuentasAnalisisAbierto; render(); },
    setHistorialFiltro: () => { state.historialCategoriaFiltro = id || ""; render(); },
    setHistorialVista: () => { state.historialVista = id; state.historialCategoriaFiltro = ""; state.historialMesAbierto = null; render(); },
    verMasMesesHistorial: () => { state.historialMesesVisibles += 3; render(); },
    toggleMesHistorial: () => { state.historialMesAbierto = state.historialMesAbierto === id ? null : id; render(); },
    verMesTendencia: () => verMesTendencia(id),
    verMasMesesPagos: () => { state.pagosMesesVisibles += 3; render(); },
    toggleSuscripcionCancelada: () => toggleSuscripcionCancelada(id),
    verDetalleTx: () => verDetalleTx(id), cerrarDetalleTx: cerrarDetalleTx,
    marcarComoSuscripcion: () => marcarComoSuscripcion(id, freq),
    marcarComoPlazo: () => marcarComoPlazo(id),
    abrirMarcarGastoFijo: abrirMarcarGastoFijo, cancelarMarcarGastoFijo: cancelarMarcarGastoFijo, confirmarGastoFijo: confirmarGastoFijo,
    removeGastoFijoReconocido: () => removeGastoFijoReconocido(id),
    setFrecuenciaAuto: () => setFrecuenciaAuto(id, freq),
    setManualFrecuencia: () => setManualFrecuencia(id, freq),
    removeSuscripcionManual: () => removeSuscripcionManual(id),
    askDisconnectBank: () => askDisconnectBank(id), cancelDisconnectBank: cancelDisconnectBank,
    confirmDisconnectBank: () => confirmDisconnectBank(id),
    aceptarConsentimiento: aceptarConsentimiento, cancelarConsentimiento: cancelarConsentimiento,
    askDeleteBankTx: () => askDeleteBankTx(id), cancelDeleteBankTx: cancelDeleteBankTx, removeBankTx: () => removeBankTx(id),
    toggleEditJob: toggleEditJob,
    startAgregarTurno: startAgregarTurno,
    cancelAgregarTurno: cancelAgregarTurno,
    confirmAgregarTurno: confirmAgregarTurno,
    requestWorkNotifPermission: requestWorkNotifPermission,
    askEmpezarBreak: askEmpezarBreak,
    cancelEmpezarBreak: cancelEmpezarBreak,
    setCashflowPeriod: () => setCashflowPeriod(id),
    setCashflowMonth: () => { state.cashflowMonthOffset = Math.max(parseInt(id, 10) || 0, 0); render(); },
    setJobFrecuencia: () => updateJobField("frecuenciaPago", freq),
    setDescansoPagadoOn: () => updateJobField("descansoPagado", true),
    setDescansoPagadoOff: () => updateJobField("descansoPagado", false),
    toggleHorarioDia: () => { const di = toNum(id); state.job.horarioDias[di] = !state.job.horarioDias[di]; scheduleSave(); render(); },
    setHorarioRecordarOn: () => updateJobField("horarioRecordar", true),
    setHorarioRecordarOff: () => updateJobField("horarioRecordar", false),
    empezarTrabajo: empezarTrabajo, empezarBreak: empezarBreak, terminarBreak: terminarBreak,
    askTerminarTrabajo: askTerminarTrabajo, cancelTerminarTrabajo: cancelTerminarTrabajo, terminarTrabajo: terminarTrabajo,
    askDeleteTurno: () => askDeleteTurno(id), cancelDeleteTurno: cancelDeleteTurno, removeTurno: () => removeTurno(id),
    toggleExpandTurno: () => toggleExpandTurno(id),
    startPagoTrabajo: startPagoTrabajo, cancelPagoTrabajo: cancelPagoTrabajo, confirmPagoTrabajo: confirmPagoTrabajo,
    toggleTurnoSel: () => toggleTurnoSel(id),
    askDeletePagoTrabajo: () => askDeletePagoTrabajo(id), cancelDeletePagoTrabajo: cancelDeletePagoTrabajo, removePagoTrabajo: () => removePagoTrabajo(id),
    loanFuenteAhorro: () => setLoanFuente(id, "ahorro"), loanFuenteDebito: () => setLoanFuente(id, "debito"),
    startPago: () => startPago(payType, id), cancelPago: cancelPago, confirmPago: confirmPago,
    setPagoSourceAhorro: setPagoSourceAhorro, setPagoSourceDebito: setPagoSourceDebito, setPagoSourceCash: setPagoSourceCash, setPagoSourceNinguno: setPagoSourceNinguno,
    guardarMes: guardarMes, removeHistory: () => removeHistory(id), askDeleteHistory: () => askDeleteHistory(id), cancelDeleteHistory: cancelDeleteHistory,
    savePin: savePin, lockApp: lockApp, unlockPin: unlockPin, setupBiometric: setupBiometric, unlockBiometric: unlockBiometric, askResetPin: askResetPin, cancelResetPin: cancelResetPin, confirmResetPin: confirmResetPin, pinDigit: () => addPinDigit(id), pinDelete: deletePinDigit,
    toggleTheme: toggleTheme, toggleLang: toggleLang, toggleCurrency: toggleCurrency,
    setObjEquilibrado: () => setObjetivo("equilibrado"), setObjCredito: () => setObjetivo("credito"), setObjAhorro: () => setObjetivo("ahorro"),
    setLangEs: () => { if (state.lang !== "es") toggleLang(); },
    setLangEn: () => { if (state.lang !== "en") toggleLang(); },
    setCurUsd: () => { if (state.currency !== "usd") toggleCurrency(); },
    setCurEur: () => { if (state.currency !== "eur") toggleCurrency(); },
    setThemeLight: () => { if (state.theme !== "light") toggleTheme(); },
    setThemeDark: () => { if (state.theme !== "dark") toggleTheme(); },
    setTextSizeChico: () => setTextSize("pequeno"), setTextSizeNormal: () => setTextSize("normal"), setTextSizeGrande: () => setTextSize("grande"),
    aplicarSugerenciaExtra: () => { state.extraPagoDeuda = String(id); scheduleSave(); render(); },
    pedirSumarAhorro: () => { state.confirmSumarAhorro = true; render(); },
    cancelSumarAhorro: () => { state.confirmSumarAhorro = false; render(); },
    sumarAhorro100: () => { pushUndo(); state.ahorroActual = String(toNum(state.ahorroActual) + 100); state.confirmSumarAhorro = false; scheduleSave(); render(); },
    verDiaSemana: () => { state.diaSemanaSel = state.diaSemanaSel === Number(id) ? null : Number(id); render(); },
    abrirIconPicker: () => { state.iconPickerSubId = state.iconPickerSubId === id ? null : id; render(); },
    cerrarIconPicker: () => { state.iconPickerSubId = null; render(); },
    elegirIconoSub: () => {
      const partes = id.split("|");
      const sub = state.subs.find((x) => x.id === partes[0]);
      if (sub) { sub.icono = partes[1]; sub.iconManual = true; state.iconPickerSubId = null; scheduleSave(); render(); }
    },
    toggleSaldosInicio: () => { state.editingSaldosInicio = !state.editingSaldosInicio; render(); if (state.editingSaldosInicio) setTimeout(() => { const i = document.getElementById("debito-input"); if (i) i.focus(); }, 50); },
    toggleCardNube: () => {
      state.expandedCloudCardIds = state.expandedCloudCardIds || {};
      state.expandedCloudCardIds[id] = !state.expandedCloudCardIds[id];
      render();
    },
    abrirConfirmarAhorro: abrirConfirmarAhorro, cancelarConfirmarAhorro: cancelarConfirmarAhorro, confirmarAhorroMes: confirmarAhorroMes,
    setDebtAvalancha: () => { state.debtStrategy = "avalancha"; render(); }, setDebtBolaNieve: () => { state.debtStrategy = "bola_nieve"; render(); },
    setPayMensual: () => setPayFrequency("mensual"),
    setPayQuincenal: () => setPayFrequency("quincenal"),
    setPaySemanal: () => setPayFrequency("semanal"),
    setAhorroNormal: () => setSavingsRate(10),
    setAhorroMedio: () => setSavingsRate(20),
    setAhorroAgresivo: () => setSavingsRate(35),
    showExport: showExport, closeExport: closeExport, copyExport: copyExport,
    goTab: () => goTab(id), goInicio: goInicio,
    enterProfile: () => enterProfile(id),
    askDeleteProfile: () => askDeleteProfile(id),
    cancelDeleteProfile: cancelDeleteProfile,
    deleteProfile: () => deleteProfile(id),
    createProfile: createProfile,
  };
  if (map[action]) map[action]();
});

(async function boot() {
  try { history.replaceState({ ccTab: "inicio", ccOverlay: null }, ""); } catch (e) {}
  applyTheme(); applyTextSize();

  // Decide el bloqueo antes de esperar IndexedDB, el banco o el service worker.
  // Así una recarga lenta nunca muestra una pantalla intermedia que luego deje botones congelados.
  try { state.appLocked = !!localStorage.getItem(PIN_HASH_KEY); } catch (error) { state.appLocked = false; }
  state.pinBusy = false;
  state.biometricBusy = false;
  state.pinInput = "";
  state.pinError = "";
  if (state.appLocked) render();

  await ensureMigrated();
  const session = await loadAuthSession();
  if (session && session.token) {
    state.authToken = session.token;
    state.authUser = session.user;
  }
  const activeId = (function () { try { return localStorage.getItem(ACTIVE_KEY); } catch (e) { return null; } })();
  if (activeId && state.profiles.some((p) => p.id === activeId)) await enterProfile(activeId);
  else render();
  if (state.appLocked) render();
  if (state.authToken && state.apiBaseUrl) {
    const huboCache = await cargarCacheNube();
    if (huboCache && typeof syncFixedPaymentsFromBank === "function") syncFixedPaymentsFromBank();
    const necesitaCrearPerfilAuto = !state.activeProfileId && state.profiles.length === 0 && state.cloudInstitutions.length > 0;
    if (huboCache) {
      if (necesitaCrearPerfilAuto) {
        state.newProfileName = state.cloudInstitutions[0].institution_name || t("bancoDesconocido");
        createProfile();
      } else {
        render();
      }
    }
    if (!huboCache || cacheNubeVencido() || state.cloudAccounts.length === 0) {
      // Primero pide a Plaid cuentas/saldos y cualquier transaccion ya preparada.
      // Esto tambien recupera conexiones nuevas cuyo historial inicial aun estaba procesandose.
      apiSyncTransactions().then((syncRes) => {
        if (!syncRes.ok) state.cloudErrorMsg = syncRes.error;
        return refrescarDatosNube();
      }).then(() => {
        if (!state.activeProfileId && state.profiles.length === 0 && state.cloudInstitutions.length > 0) {
          state.newProfileName = state.cloudInstitutions[0].institution_name || t("bancoDesconocido");
          createProfile();
        } else {
          render();
        }
        if (state.cloudAccounts.length > 0 && state.cloudTransactions.length === 0) {
          [15000, 60000].forEach((delay) => setTimeout(async () => {
            if (state.cloudTransactions.length > 0 || !state.authToken) return;
            const retry = await apiSyncTransactions();
            if (retry.ok) await refrescarDatosNube();
            render();
          }, delay));
        }
      });
    }
  }
})();

/* Recupera controles si Android restaura la PWA desde memoria o interrumpe una huella. */
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  pinUnlockSequence++;
  biometricUnlockSequence++;
  if (biometricAbortController) { try { biometricAbortController.abort(); } catch (error) {} biometricAbortController = null; }
  state.pinBusy = false;
  state.biometricBusy = false;
  state.pinError = "";
  render();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !state.appLocked) return;
  if (state.pinBusy) { pinUnlockSequence++; state.pinBusy = false; }
  if (state.biometricBusy) {
    biometricUnlockSequence++;
    if (biometricAbortController) { try { biometricAbortController.abort(); } catch (error) {} biometricAbortController = null; }
    state.biometricBusy = false;
  }
  render();
});

setInterval(checkHorarioReminder, 60000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      const activarNuevo = (w) => { if (w) w.postMessage("SKIP_WAITING"); };
      if (reg.waiting) { UPDATE_AVAILABLE = true; activarNuevo(reg.waiting); render(); }
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) { UPDATE_AVAILABLE = true; activarNuevo(nw); render(); }
        });
      });
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
      reg.update().catch(() => {});
    }).catch(() => {});
    let ccReloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (ccReloaded) return; ccReloaded = true; UPDATE_AVAILABLE = true; if (!state.appLocked) render(); });
  });
}
