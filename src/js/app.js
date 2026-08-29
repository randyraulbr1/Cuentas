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
  state.job = Object.assign({ nombre: "", pagoHora: "18", pagoDia: "", frecuenciaPago: "semanal", diaPago: "", horasExtraDespues: "40", multiplicadorExtra: "1.5", tipoLaboral: "w2", impuestoPct: "18", descansoPagado: false, limiteAlmuerzo: "30", horarioDias: [false, false, false, false, false, false, false], horarioInicio: "09:00", horarioFin: "17:00", horarioRecordar: false, horarioUltimoRecordatorio: "", horarioUltimoRecordatorioSalida: "" }, d.job || {});
  if (!state.job.pagoHora) state.job.pagoHora = "18";
  if (!state.job.tipoLaboral) state.job.tipoLaboral = "w2";
  if (String(state.job.impuestoPct || "").trim() === "") state.job.impuestoPct = state.job.tipoLaboral === "1099" ? "28" : "18";
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
  const url = new URL(location.href);
  url.searchParams.set("_upd", Date.now());
  location.href = url.toString();
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
  if (el.id === "purchase-time-input") {
    state.evaluarCompraMonto = sanitizeNum(el.value);
    const output = root.querySelector("#purchase-time-result");
    if (output) output.textContent = textoGastoEnTiempo(state.evaluarCompraMonto);
    return;
  }
  if (el.id === "job-tax-slider") {
    state.job.impuestoPct = String(Math.max(0, Math.min(60, Math.round(Number(el.value) || 0))));
    const output = root.querySelector("#job-tax-value");
    if (output) output.textContent = state.job.impuestoPct + "%";
    scheduleSave();
    return;
  }
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
  if (scope === "agregarTurno") { state.agregarTurnoForm[el.dataset.field] = el.value; rerenderPreservingFocus(); return; }
  if (scope === "trabajoCalHoras") { state.trabajoCalHorasInput = sanitizeNum(el.value); rerenderPreservingFocus(); return; }
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
    if (f === "horarioInicio" || f === "horarioFin") {
      const digits = el.value.replace(/[^0-9]/g, "").slice(0, 4);
      const formatted = digits.length >= 3 ? digits.slice(0, 2) + ":" + digits.slice(2) : digits;
      el.value = formatted;
      state.job[f] = formatted;
      if (f === "horarioInicio" && digits.length === 4) {
        const hh = parseInt(digits.slice(0, 2), 10), mm = parseInt(digits.slice(2), 10);
        if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
          const fin = new Date(2000, 0, 1, hh, mm);
          fin.setHours(fin.getHours() + 8);
          state.job.horarioFin = String(fin.getHours()).padStart(2, "0") + ":" + String(fin.getMinutes()).padStart(2, "0");
        }
      }
      scheduleSave(); rerenderPreservingFocus(); return;
    }
    const raw = f === "nombre";
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

/* Deslizar para confirmar (empezar break / terminar trabajo) */
let slideDrag = null;
root.addEventListener("pointerdown", (e) => {
  const handle = e.target.closest(".slide-handle");
  if (!handle) return;
  const track = handle.closest(".slide-track");
  const wrap = handle.closest(".slide-confirm");
  if (!track || !wrap) return;
  const trackRect = track.getBoundingClientRect();
  const maxX = Math.max(trackRect.width - handle.offsetWidth - 6, 10);
  slideDrag = { handle, track, wrap, maxX, startX: e.clientX };
  handle.style.transition = "";
  try { handle.setPointerCapture(e.pointerId); } catch (err) {}
  window.__slideDragging = true;
});
root.addEventListener("pointermove", (e) => {
  if (!slideDrag) return;
  const dx = e.clientX - slideDrag.startX;
  const left = Math.min(Math.max(3 + dx, 3), slideDrag.maxX);
  slideDrag.handle.style.left = left + "px";
});
function endSlideDrag(e) {
  if (!slideDrag) return;
  const dx = e.clientX - slideDrag.startX;
  const left = Math.min(Math.max(3 + dx, 3), slideDrag.maxX);
  const frac = slideDrag.maxX > 3 ? (left - 3) / (slideDrag.maxX - 3) : 0;
  const action = slideDrag.wrap.dataset.slideAction;
  const handle = slideDrag.handle;
  window.__slideDragging = false;
  if (frac >= 0.45) {
    handle.style.transition = "left .12s ease";
    handle.style.left = slideDrag.maxX + "px";
    slideDrag = null;
    setTimeout(() => {
      if (action === "empezarBreak") empezarBreak();
      else if (action === "terminarTrabajo") terminarTrabajo();
      else if (action === "terminarBreak") terminarBreak();
      else if (action === "empezarTrabajo") empezarTrabajo();
    }, 110);
  } else {
    handle.style.transition = "left .2s ease";
    handle.style.left = "3px";
    slideDrag = null;
  }
}
root.addEventListener("pointerup", endSlideDrag);
root.addEventListener("pointercancel", endSlideDrag);

/* Linea movil tipo trading en el grafico de Flujo de caja */
function svgPointFromClientX(svg, clientX) {
  try {
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = 0;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  } catch (e) { return null; }
}
function updateCashflowCrosshair(svg, clientX) {
  const buckets = window.__cashflowBuckets;
  const geom = window.__cashflowGeom;
  if (!buckets || !buckets.length || !geom) return;
  const pt = svgPointFromClientX(svg, clientX);
  if (!pt) return;
  const plotW = geom.width - geom.left - geom.right;
  let idx = Math.round((pt.x - geom.left - geom.step / 2) / geom.step);
  idx = Math.max(0, Math.min(buckets.length - 1, idx));
  const item = buckets[idx];
  const x = geom.left + geom.step * (idx + 0.5);
  const line = svg.querySelector("#cf-crosshair");
  if (line) { line.setAttribute("x1", x); line.setAttribute("x2", x); line.style.display = "block"; }
  const readout = document.getElementById("cf-readout");
  if (readout) {
    const positive = item.tipo === "income";
    readout.textContent = (positive ? "+" : "\u2212") + sym() + fmt0(item.valor) + "  \u00b7  " + item.etiqueta + (item.descripcion ? " \u00b7 " + item.descripcion : "");
    readout.classList.remove("positive", "negative");
    readout.classList.add(positive ? "positive" : "negative");
  }
}
function resetCashflowReadout() {
  const readout = document.getElementById("cf-readout");
  if (!readout) return;
  readout.textContent = readout.dataset.default || "";
  readout.classList.remove("positive", "negative");
  readout.classList.add(readout.dataset.defaultCls || "positive");
  const svg = document.getElementById("cf-svg");
  const line = svg && svg.querySelector("#cf-crosshair");
  if (line) line.style.display = "none";
}
let cashflowDragging = false;
root.addEventListener("pointerdown", (e) => {
  const svg = e.target.closest("#cf-svg");
  if (!svg) return;
  cashflowDragging = true;
  try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  updateCashflowCrosshair(svg, e.clientX);
});
root.addEventListener("pointermove", (e) => {
  if (!cashflowDragging) return;
  const svg = document.getElementById("cf-svg");
  if (svg) updateCashflowCrosshair(svg, e.clientX);
});
function endCashflowDrag() {
  if (!cashflowDragging) return;
  cashflowDragging = false;
  resetCashflowReadout();
}
root.addEventListener("pointerup", endCashflowDrag);
root.addEventListener("pointercancel", endCashflowDrag);
root.addEventListener("pointerleave", endCashflowDrag);

root.addEventListener("scroll", (e) => {
  if (e.target && e.target.id === "bank-expense-picker") {
    state.bankExpenseScrollTop = e.target.scrollTop;
    try { sessionStorage.setItem("bankExpenseScrollTop", String(e.target.scrollTop)); } catch (error) {}
  }
}, true);

root.addEventListener("click", (e) => {
  const directTab = e.target.closest(".tab-btn[data-id]");
  if (directTab) { e.preventDefault(); goTab(directTab.dataset.id); return; }
  let closedSomethingOnOutsideClick = false;
  if (!e.target.closest(".cc-card") && state.expandedCloudCardIds && Object.keys(state.expandedCloudCardIds).some((key) => state.expandedCloudCardIds[key])) {
    state.expandedCloudCardIds = {};
    closedSomethingOnOutsideClick = true;
  }
  if (state.trabajoCalSelectedDate && !e.target.closest("#trabajo-calendar-panel")) {
    state.trabajoCalSelectedDate = null;
    closedSomethingOnOutsideClick = true;
  }
  if (state.editingJob && !e.target.closest("#trabajo-job-panel")) {
    state.editingJob = false;
    closedSomethingOnOutsideClick = true;
  }
  if (e.target.classList && e.target.classList.contains("options-overlay")) {
    if (state.showConsentimiento) { state.showConsentimiento = false; render(); return; }
    if (state.showExport) { state.showExport = false; state.exportCopied = false; render(); return; }
    if (state.showTxDetalle) { state.showTxDetalle = null; render(); return; }
    return;
  }
  const btn = e.target.closest("[data-action]");
  if (!btn) { if (closedSomethingOnOutsideClick) render(); return; }
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const freq = btn.dataset.freq;
  const payType = btn.dataset.type;
  const map = {
    actualizar: actualizarApp, undo: undo,
    selectNavOrder: () => { state.navOrderSelected = id; render(); },
    moveNavLeft: () => {
      const order = normalizeNavOrder(state.navOrderDraft);
      const index = order.indexOf(state.navOrderSelected);
      if (index > 0) { const temp = order[index - 1]; order[index - 1] = order[index]; order[index] = temp; state.navOrderDraft = order; render(); }
    },
    moveNavRight: () => {
      const order = normalizeNavOrder(state.navOrderDraft);
      const index = order.indexOf(state.navOrderSelected);
      if (index >= 0 && index < order.length - 1) { const temp = order[index + 1]; order[index + 1] = order[index]; order[index] = temp; state.navOrderDraft = order; render(); }
    },
    confirmNavOrder: () => {
      state.navOrder = normalizeNavOrder(state.navOrderDraft);
      state.navOrderDraft = state.navOrder.slice();
      state.navOrderSaved = true;
      saveSettings(); render();
      setTimeout(() => { state.navOrderSaved = false; render(); }, 1400);
    },
    setBankExpenseSort: () => {
      state.bankExpenseSort = id === "monto" || id === "nombre" ? id : "fecha";
      state.bankExpenseScrollTop = 0;
      try { sessionStorage.setItem("bankExpenseScrollTop", "0"); } catch (error) {}
      saveSettings(); render();
    },
    setJobW2: () => { state.job.tipoLaboral = "w2"; state.job.impuestoPct = "18"; scheduleSave(); render(); },
    setJob1099: () => { state.job.tipoLaboral = "1099"; state.job.impuestoPct = "28"; scheduleSave(); render(); },
    toggleSubscriptionReview: () => { state.subscriptionReviewOpen = !state.subscriptionReviewOpen; render(); },
    openSubscriptionAssist: () => { state.subscriptionAssistKey = id; state.subscriptionAssistCopied = false; render(); },
    closeSubscriptionAssist: () => { state.subscriptionAssistKey = null; state.subscriptionAssistCopied = false; render(); },
    copySubscriptionDraft: () => { const box = root.querySelector("#subscription-draft"); if (box && navigator.clipboard) navigator.clipboard.writeText(box.value).then(() => { state.subscriptionAssistCopied = true; render(); }).catch(() => { box.select(); }); },
    markSubscriptionCanceled: () => { toggleSuscripcionCancelada(id); state.subscriptionAssistKey = null; render(); },
    confirmReset: () => { state.confirmReset = true; render(); },
    cancelReset: () => { state.confirmReset = false; render(); },
    resetAll: resetAll,
    addSub: addSub, removeSub: () => removeSub(id), askDeleteSub: () => askDeleteSub(id), cancelDeleteSub: cancelDeleteSub, toggleEditSubs: toggleEditSubs,
    toggleSubPagado: () => toggleSubPagado(id), confirmPagoSub: confirmPagoSub, cancelPagoSub: cancelPagoSub,
    addSubPreset: () => addSubPreset(id),
    addSubFromBankTx: () => addSubFromBankTx(id),
    addDetectedSubscription: () => addDetectedSubscription(id),
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
    trabajoCalPrevMonth: trabajoCalPrevMonth,
    trabajoCalNextMonth: trabajoCalNextMonth,
    trabajoCalSelectDay: () => trabajoCalSelectDay(id),
    trabajoCalGuardarHoras: trabajoCalGuardarHoras,
    trabajoCalQuitarTurno: () => trabajoCalQuitarTurno(id),
    dismissBreakLock: () => { state.breakLockDismissed = true; render(); },
    abrirBanco: abrirBanco,
    requestWorkNotifPermission: requestWorkNotifPermission,
    askEmpezarBreak: askEmpezarBreak,
    cancelEmpezarBreak: cancelEmpezarBreak,
    setCashflowPeriod: () => setCashflowPeriod(id),
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
    setTrabajoPeriodo: () => { state.trabajoPeriodoDefault = id; scheduleSave(); render(); },
    setTextSizeChico: () => setTextSize("pequeno"), setTextSizeNormal: () => setTextSize("normal"), setTextSizeGrande: () => setTextSize("grande"),
    aplicarSugerenciaExtra: () => { state.extraPagoDeuda = String(id); scheduleSave(); render(); },
    verDiaSemana: () => { state.diaSemanaSel = state.diaSemanaSel === Number(id) ? null : Number(id); render(); },
    abrirIconPicker: () => { state.iconPickerSubId = state.iconPickerSubId === id ? null : id; render(); },
    cerrarIconPicker: () => { state.iconPickerSubId = null; render(); },
    elegirIconoSub: () => {
      const partes = id.split("|");
      const sub = state.subs.find((x) => x.id === partes[0]);
      if (sub) { sub.icono = partes[1]; sub.iconManual = true; state.iconPickerSubId = null; scheduleSave(); render(); }
    },
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
  if (map[action]) {
    try { map[action](); } catch (err) {
      console.error("action '" + action + "' error:", err);
      try {
        root.innerHTML = '<div style="padding:40px 24px;text-align:center;font-family:inherit;">' +
          '<div style="font-size:15px;font-weight:700;margin-bottom:8px;">Se encontr\u00f3 un error al hacer esa acci\u00f3n</div>' +
          '<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px;word-break:break-word;">' + esc(String(err && err.message || err)) + '</div>' +
          '<button style="padding:12px 22px;border-radius:12px;border:none;background:var(--accent);color:var(--accent-contrast);font-weight:700;font-family:inherit;" onclick="location.reload()">Recargar</button>' +
          '</div>';
      } catch (e2) {}
    }
  }
});

(async function boot() {
  try { history.replaceState({ ccTab: "inicio", ccOverlay: null }, ""); } catch (e) {}
  applyTheme(); applyTextSize();
  const androidShell = new URLSearchParams(location.search).get("app") === "android" ||
    /305SaveAndroid\//.test(navigator.userAgent);

  // En el APK la seguridad es nativa (PIN + biometría de Android).
  // La capa web no muestra un segundo bloqueo.
  try { state.appLocked = !androidShell && !!localStorage.getItem(PIN_HASH_KEY); } catch (error) { state.appLocked = false; }
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
  let activeId = (function () { try { return localStorage.getItem(ACTIVE_KEY); } catch (e) { return null; } })();
  // El APK usa una sola cuenta. La crea silenciosamente la primera vez y la abre siempre.
  if (androidShell) {
    if (state.profiles.length === 0) {
      const firstProfile = { id: uid(), nombre: "Mi cuenta" };
      state.profiles.push(firstProfile);
      saveProfiles(state.profiles);
      activeId = firstProfile.id;
      try { localStorage.setItem(ACTIVE_KEY, activeId); } catch (error) {}
    } else if (!activeId || !state.profiles.some((p) => p.id === activeId)) {
      activeId = state.profiles[0].id;
      try { localStorage.setItem(ACTIVE_KEY, activeId); } catch (error) {}
    }
  }
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
    const registrationPromise = window.__swRegistrationPromise || navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
    registrationPromise.then((reg) => {
      if (!reg) return;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
      setInterval(() => reg.update().catch(() => {}), 15 * 60 * 1000);
    }).catch(() => {});
  });
}
