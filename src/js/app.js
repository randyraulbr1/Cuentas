"use strict";

function applyTheme() { document.documentElement.setAttribute("data-theme", state.theme); }

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
  state.job = d.job || { nombre: "", pagoHora: "", pagoDia: "", frecuenciaPago: "semanal", diaPago: "", horasExtraDespues: "40", multiplicadorExtra: "1.5", impuestoPct: "", descansoPagado: false };
  state.turnos = d.turnos || [];
  state.turnoActivo = d.turnoActivo || null;
  state.pagosTrabajo = d.pagosTrabajo || [];
  state.resultado = null; state.confirmReset = false; state.showOptions = false;
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

function switchUser() {
  if (saveTimeout) { clearTimeout(saveTimeout); saveUserDataNow(); }
  state.activeProfileId = null;
  try { localStorage.removeItem(ACTIVE_KEY); } catch (e) {}
  state.screen = "selector"; state.showOptions = false;
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

function setSavingsRate(n) { state.savingsRate = n; scheduleSave(); render(); }

function toggleOptions() { state.showOptions = !state.showOptions; render(); }

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

function showExport() { state.showExport = true; render(); }

function closeExport() { state.showExport = false; state.exportCopied = false; render(); }

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

function goTab(id) { state.activeTab = id; render(); window.scrollTo(0, 0); }

function goInicio() { goTab("inicio"); }

async function actualizarApp() {
  try {
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

function sanitizeNum(str) {
  str = String(str).replace(/[^0-9.]/g, "");
  const parts = str.split(".");
  if (parts.length > 2) str = parts[0] + "." + parts.slice(1).join("");
  return str;
}

root.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "new-profile-input") { state.newProfileName = el.value; return; }
  const scope = el.dataset.scope;
  if (!scope) return;
  if (scope === "ingreso") { state.ingreso = sanitizeNum(el.value); scheduleSave(); rerenderPreservingFocus(); return; }
  if (scope === "ahorroActual") { state.ahorroActual = sanitizeNum(el.value); scheduleSave(); rerenderPreservingFocus(); return; }
  if (scope === "debito") { state.debito = sanitizeNum(el.value); scheduleSave(); rerenderPreservingFocus(); return; }
  if (scope === "cash") { state.cash = sanitizeNum(el.value); scheduleSave(); rerenderPreservingFocus(); return; }
  if (scope === "apiBaseUrl") { state.apiBaseUrl = el.value.trim(); saveSettings(); rerenderPreservingFocus(); return; }
  if (scope === "authEmail") { state.authEmail = el.value; rerenderPreservingFocus(); return; }
  if (scope === "authPassword") { state.authPassword = el.value; rerenderPreservingFocus(); return; }
  if (scope === "payFormMonto") { state.payFormMonto = sanitizeNum(el.value); rerenderPreservingFocus(); return; }
  if (scope === "metaAhorro") { state.metaAhorro = sanitizeNum(el.value); scheduleSave(); rerenderPreservingFocus(); return; }
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
    item[el.dataset.field] = el.dataset.field === "monto" ? sanitizeNum(el.value) : el.value;
    scheduleSave(); rerenderPreservingFocus(); return;
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
    scheduleSave(); rerenderPreservingFocus(); return;
  }
  if (scope === "job") {
    const f = el.dataset.field;
    state.job[f] = f === "nombre" ? el.value : sanitizeNum(el.value);
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

root.addEventListener("click", (e) => {
  if (e.target.classList && e.target.classList.contains("options-overlay")) {
    if (state.showConsentimiento) { state.showConsentimiento = false; render(); return; }
    if (state.showExport) { state.showExport = false; state.exportCopied = false; render(); return; }
    state.showOptions = false; render(); return;
  }
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
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
    askDisconnectBank: () => askDisconnectBank(id), cancelDisconnectBank: cancelDisconnectBank,
    confirmDisconnectBank: () => confirmDisconnectBank(id),
    aceptarConsentimiento: aceptarConsentimiento, cancelarConsentimiento: cancelarConsentimiento,
    askDeleteBankTx: () => askDeleteBankTx(id), cancelDeleteBankTx: cancelDeleteBankTx, removeBankTx: () => removeBankTx(id),
    toggleEditJob: toggleEditJob,
    setJobFrecuencia: () => updateJobField("frecuenciaPago", freq),
    setDescansoPagadoOn: () => updateJobField("descansoPagado", true),
    setDescansoPagadoOff: () => updateJobField("descansoPagado", false),
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
    switchUser: switchUser,
    toggleTheme: toggleTheme, toggleLang: toggleLang, toggleCurrency: toggleCurrency,
    setObjEquilibrado: () => setObjetivo("equilibrado"), setObjCredito: () => setObjetivo("credito"), setObjAhorro: () => setObjetivo("ahorro"),
    setLangEs: () => { if (state.lang !== "es") toggleLang(); },
    setLangEn: () => { if (state.lang !== "en") toggleLang(); },
    setCurUsd: () => { if (state.currency !== "usd") toggleCurrency(); },
    setCurEur: () => { if (state.currency !== "eur") toggleCurrency(); },
    setThemeLight: () => { if (state.theme !== "light") toggleTheme(); },
    setThemeDark: () => { if (state.theme !== "dark") toggleTheme(); },
    setPayMensual: () => setPayFrequency("mensual"),
    setPayQuincenal: () => setPayFrequency("quincenal"),
    setPaySemanal: () => setPayFrequency("semanal"),
    setAhorroNormal: () => setSavingsRate(10),
    setAhorroMedio: () => setSavingsRate(20),
    setAhorroAgresivo: () => setSavingsRate(35),
    toggleOptions: toggleOptions,
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
  applyTheme();
  await ensureMigrated();
  const session = await loadAuthSession();
  if (session && session.token) {
    state.authToken = session.token;
    state.authUser = session.user;
  }
  const activeId = (function () { try { return localStorage.getItem(ACTIVE_KEY); } catch (e) { return null; } })();
  if (activeId && state.profiles.some((p) => p.id === activeId)) await enterProfile(activeId);
  else render();
  if (state.authToken && state.apiBaseUrl) {
    refrescarDatosNube().then(() => render());
  }
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      if (reg.waiting) { UPDATE_AVAILABLE = true; render(); }
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) { UPDATE_AVAILABLE = true; render(); }
        });
      });
    }).catch(() => {});
  });
}
